import path from "node:path";
import type { MonthlyReportAction, Prisma, RiskAssessment, RiskStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { monthlyReportUploadDirectory } from "../config/monthlyReportUpload.js";
import type { AuthenticatedUser } from "../types/auth.js";
import { HttpError } from "../utils/httpError.js";
import { riskBusinessDate as calendarDay, riskLevelFor, riskMetrics, riskReadyForStatus, riskScore, type RiskLevel } from "../utils/riskRules.js";
import type { RiskInput, RiskQuery, RiskUpdate } from "../utils/riskSchemas.js";
import { actorFor, auditAccess, findingAccess, getAudit, getFinding, isAuditAdmin, nextReference, type Actor } from "./audit.service.js";

const person = { id: true, firstName: true, lastName: true, departmentId: true, employeeCode: true } satisfies Prisma.EmployeeSelect;
const user = { id: true, email: true, employee: { select: person } } satisfies Prisma.UserSelect;
const evidence = { id: true, riskId: true, originalName: true, mimeType: true, size: true, createdAt: true, uploadedById: true, purpose: true, reviewStatus: true, reviewComment: true, reviewedAt: true, reviewedBy: { select: user } } satisfies Prisma.MonthlyReportAttachmentSelect;
const include = { department: true, responsibleEmployee: { select: person }, createdBy: { select: user }, reviewedBy: { select: user }, closedBy: { select: user }, audit: { select: { id: true, reference: true, title: true } }, finding: { select: { id: true, reference: true } }, capa: { select: { id: true, reference: true } } } satisfies Prisma.RiskAssessmentInclude;
type Risk = Prisma.RiskAssessmentGetPayload<{ include: typeof include }>;
const transactionOptions = { timeout: 60000, maxWait: 10000 };
function allow(value: boolean, message = "You do not have permission for this action"): asserts value { if (!value) throw new HttpError(403, message); }
function changed(count: number) { if (count !== 1) throw new HttpError(409, "The record changed. Refresh and try again."); }
function canManage(actor: Actor, risk: { departmentId: string }) { return isAuditAdmin(actor) || actor.role.name === "MANAGER" && actor.employee?.departmentId === risk.departmentId; }
function canMitigate(actor: Actor, risk: { departmentId: string; responsibleEmployeeId: string; status?: string }) { return canManage(actor, risk) || actor.role.name === "EMPLOYEE" && actor.employee?.id === risk.responsibleEmployeeId && !["ACCEPTED", "CLOSED"].includes(risk.status ?? ""); }
function riskAccess(actor: Actor): Prisma.RiskAssessmentWhereInput {
  if (isAuditAdmin(actor)) return {};
  if (actor.role.name === "MANAGER" && actor.employee) return { departmentId: actor.employee.departmentId };
  if (actor.role.name === "EMPLOYEE" && actor.employee) return { responsibleEmployeeId: actor.employee.id };
  if (actor.role.name === "AUDITOR") return { OR: [{ audit: auditAccess(actor) }, { finding: findingAccess(actor) }, { capa: { finding: findingAccess(actor) } }] };
  return { id: { in: [] } };
}
async function riskFor(actor: Actor, id: string) {
  const risk = await prisma.riskAssessment.findFirst({ relationLoadStrategy: "join", where: { AND: [{ id }, riskAccess(actor)] }, include });
  if (!risk) throw new HttpError(404, "Risk not found or not available in your scope");
  return risk;
}
async function configuration() { return prisma.riskScoringConfiguration.findUniqueOrThrow({ relationLoadStrategy: "join", where: { id: "default" } }); }
function levelsOf(config: { levels: Prisma.JsonValue }) { return config.levels as unknown as RiskLevel[]; }
async function serialize(actor: Actor, records: Risk[], levels: RiskLevel[]) {
  const auditIds = records.flatMap((row) => row.auditId ? [row.auditId] : []);
  const findingIds = records.flatMap((row) => row.findingId ? [row.findingId] : []);
  const [audits, findings] = await Promise.all([
    isAuditAdmin(actor) ? auditIds.map((id) => ({ id })) : auditIds.length ? prisma.internalAudit.findMany({ relationLoadStrategy: "join", where: { AND: [{ id: { in: auditIds } }, auditAccess(actor)] }, select: { id: true } }) : [],
    isAuditAdmin(actor) ? findingIds.map((id) => ({ id })) : findingIds.length ? prisma.auditFinding.findMany({ relationLoadStrategy: "join", where: { AND: [{ id: { in: findingIds } }, findingAccess(actor)] }, select: { id: true } }) : []
  ]);
  const visibleAudits = new Set(audits.map((row) => row.id)); const visibleFindings = new Set(findings.map((row) => row.id));
  return records.map((risk) => ({ ...risk, audit: risk.auditId && visibleAudits.has(risk.auditId) ? risk.audit : null, finding: risk.findingId && visibleFindings.has(risk.findingId) ? risk.finding : null, capa: risk.findingId && visibleFindings.has(risk.findingId) ? risk.capa : null,
    riskLevel: riskLevelFor(risk.riskScore, levels), residualRiskLevel: riskLevelFor(risk.residualRiskScore, levels), metrics: riskMetrics(risk),
    permissions: { canManage: canManage(actor, risk), canMitigate: risk.status !== "CLOSED" && canMitigate(actor, risk), canReview: risk.status !== "CLOSED" && canManage(actor, risk), canReopen: risk.status === "CLOSED" && canManage(actor, risk) }
  }));
}
async function log(tx: Prisma.TransactionClient, actor: Actor, riskId: string, action: MonthlyReportAction, comment: string, previousStatus?: string, newStatus?: string) { await tx.monthlyReportActionHistory.create({ data: { riskId, performedByUserId: actor.id, action, comment, previousStatus, newStatus } }); }
async function validateDirectory(departmentId: string, responsibleEmployeeId: string) {
  const [department, employee] = await Promise.all([
    prisma.department.findFirst({ relationLoadStrategy: "join", where: { id: departmentId, isActive: true }, select: { id: true } }),
    prisma.employee.findFirst({ relationLoadStrategy: "join", where: { id: responsibleEmployeeId, departmentId, employmentStatus: "ACTIVE", user: { isActive: true } }, select: { id: true } })
  ]);
  if (!department || !employee) throw new HttpError(400, "Select an active department and an active responsible person in that department");
}
async function validateLinks(auth: AuthenticatedUser, input: Pick<RiskInput, "auditId" | "findingId" | "capaId">) {
  let { auditId, findingId, capaId } = input;
  if (capaId) {
    const capa = await prisma.capa.findUnique({ relationLoadStrategy: "join", where: { id: capaId }, select: { findingId: true } });
    if (!capa) throw new HttpError(404, "Linked CAPA is unavailable");
    if (findingId && findingId !== capa.findingId) throw new HttpError(400, "CAPA and finding must belong together");
    findingId = capa.findingId;
  }
  if (findingId) {
    const finding = await getFinding(auth, findingId);
    if (auditId && auditId !== finding.auditId) throw new HttpError(400, "Audit and finding must belong together");
    auditId = finding.auditId;
  } else if (auditId) await getAudit(auth, auditId);
  return { auditId, findingId, capaId };
}
function datesAndScores(input: Pick<RiskInput, "targetDate" | "completionDate" | "reviewDate" | "likelihood" | "severity" | "residualLikelihood" | "residualSeverity" | "additionalMitigation">) {
  if ((input.residualLikelihood === null) !== (input.residualSeverity === null)) throw new HttpError(400, "Provide both residual likelihood and residual severity");
  if (input.additionalMitigation.trim() && !input.targetDate) throw new HttpError(400, "A mitigation target date is required");
  if (input.completionDate && input.completionDate > calendarDay(new Date())) throw new HttpError(400, "Completion date cannot be in the future");
  return { targetDate: input.targetDate ? new Date(input.targetDate) : null, completionDate: input.completionDate ? new Date(input.completionDate) : null, reviewDate: new Date(input.reviewDate), riskScore: riskScore(input.likelihood, input.severity), residualRiskScore: input.residualLikelihood !== null && input.residualSeverity !== null ? riskScore(input.residualLikelihood, input.residualSeverity) : null };
}
export async function getRisk(auth: AuthenticatedUser, id: string) {
  return riskDetails(await actorFor(auth), id);
}
async function riskDetails(actor: Actor, id: string) {
  const risk = await riskFor(actor, id);
  const [config, files, history] = await Promise.all([
    configuration(), prisma.monthlyReportAttachment.findMany({ relationLoadStrategy: "join", where: { riskId: id }, select: evidence, orderBy: { createdAt: "desc" } }),
    prisma.monthlyReportActionHistory.findMany({ relationLoadStrategy: "join", where: { riskId: id }, include: { performedByUser: { select: user } }, orderBy: { createdAt: "desc" } })
  ]);
  return { ...(await serialize(actor, [risk], levelsOf(config)))[0], evidence: files, history };
}
export async function riskOptions(auth: AuthenticatedUser, findingId?: string) {
  const actor = await actorFor(auth); let source: Awaited<ReturnType<typeof getFinding>> | undefined;
  if (findingId) source = await getFinding(auth, findingId);
  const canCreate = isAuditAdmin(actor) || actor.role.name === "MANAGER" && Boolean(actor.employee) || actor.role.name === "AUDITOR" && Boolean(source?.permissions.canManage);
  const departmentId = actor.role.name === "MANAGER" ? actor.employee?.departmentId : actor.role.name === "AUDITOR" ? source?.departmentId : undefined;
  const [config, departments, employees, audits, findings] = await Promise.all([
    configuration(), prisma.department.findMany({ relationLoadStrategy: "join", where: { isActive: true, ...(!isAuditAdmin(actor) && departmentId ? { id: departmentId } : {}) }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ relationLoadStrategy: "join", where: { employmentStatus: "ACTIVE", user: { isActive: true }, ...(isAuditAdmin(actor) ? {} : departmentId ? { departmentId } : actor.role.name === "AUDITOR" ? { assignedRisks: { some: riskAccess(actor) } } : { id: actor.employee?.id ?? "" }) }, select: person, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    prisma.internalAudit.findMany({ relationLoadStrategy: "join", where: auditAccess(actor), select: { id: true, reference: true, title: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.auditFinding.findMany({ relationLoadStrategy: "join", where: findingAccess(actor), select: { id: true, reference: true, auditId: true, departmentId: true, description: true, capa: { select: { id: true, reference: true } } }, orderBy: { createdAt: "desc" }, take: 500 })
  ]);
  return { config: { levels: levelsOf(config), version: config.version }, departments, employees, audits, findings, canCreate, canConfigure: isAuditAdmin(actor), source: source ? { id: source.id, auditId: source.auditId, departmentId: source.departmentId, responsibleEmployeeId: source.responsibleEmployeeId, description: source.description, reference: source.reference, capaId: source.capa?.id ?? null } : null };
}
function queryWhere(actor: Actor, query: RiskQuery, levels: RiskLevel[]): Prisma.RiskAssessmentWhereInput {
  const filters: Prisma.RiskAssessmentWhereInput[] = [riskAccess(actor)];
  for (const key of ["departmentId", "responsibleEmployeeId", "auditId", "findingId", "capaId", "category", "status"] as const) if (query[key]) filters.push({ [key]: query[key] });
  if (query.search) filters.push({ OR: ["reference", "title", "description", "processActivity", "category", "hazardSource"].map((key) => ({ [key]: { contains: query.search, mode: "insensitive" } })) });
  if (query.level) { const level = levels.find((item) => item.code === query.level); if (!level) throw new HttpError(400, "Unknown risk level"); filters.push({ riskScore: { gte: level.minScore, lte: level.maxScore } }); }
  if (query.reviewFrom || query.reviewTo) filters.push({ reviewDate: { ...(query.reviewFrom ? { gte: new Date(query.reviewFrom) } : {}), ...(query.reviewTo ? { lte: new Date(query.reviewTo) } : {}) } });
  const today = new Date(calendarDay(new Date()));
  if (query.view === "OVERDUE") filters.push({ status: { notIn: ["MITIGATED", "ACCEPTED", "CLOSED"] }, completionDate: null, targetDate: { lt: today } });
  if (query.view === "REVIEW_DUE") filters.push({ status: { not: "CLOSED" }, reviewDate: { lte: today } });
  if (query.view === "OPEN") filters.push({ status: { not: "CLOSED" } });
  return { AND: filters };
}
export async function listRisks(auth: AuthenticatedUser, query: RiskQuery) {
  const actor = await actorFor(auth); const levels = levelsOf(await configuration()); const where = queryWhere(actor, query, levels);
  const [records, total] = await Promise.all([prisma.riskAssessment.findMany({ relationLoadStrategy: "join", where, include, orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }), prisma.riskAssessment.count({ where })]);
  return { risks: await serialize(actor, records, levels), pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } };
}
export async function createRisk(auth: AuthenticatedUser, input: RiskInput) {
  const actor = await actorFor(auth);
  if (actor.role.name === "AUDITOR" && input.findingId) { const source = await getFinding(auth, input.findingId); allow(source.permissions.canManage); if (source.departmentId !== input.departmentId) throw new HttpError(400, "Finding-created risk must use the finding's department"); }
  else allow(canManage(actor, input));
  await validateDirectory(input.departmentId, input.responsibleEmployeeId);
  const links = await validateLinks(auth, input); const calculated = datesAndScores(input);
  const created = await prisma.$transaction(async (tx) => {
    const risk = await tx.riskAssessment.create({ data: { ...input, ...links, ...calculated, reference: await nextReference(tx, "RISK"), createdById: actor.id } });
    await log(tx, actor, risk.id, "RISK_CREATED", `Created at score ${risk.riskScore}${links.findingId ? "; linked to an audit finding" : ""}`, undefined, "OPEN"); return risk;
  }, transactionOptions);
  return riskDetails(actor, created.id);
}
function inputFrom(risk: RiskAssessment): RiskInput { return { title: risk.title, description: risk.description, departmentId: risk.departmentId, processActivity: risk.processActivity, category: risk.category, hazardSource: risk.hazardSource, potentialConsequence: risk.potentialConsequence, existingControls: risk.existingControls, likelihood: risk.likelihood, severity: risk.severity, additionalMitigation: risk.additionalMitigation, responsibleEmployeeId: risk.responsibleEmployeeId, targetDate: risk.targetDate?.toISOString().slice(0, 10) ?? null, completionDate: risk.completionDate?.toISOString().slice(0, 10) ?? null, residualLikelihood: risk.residualLikelihood, residualSeverity: risk.residualSeverity, reviewDate: risk.reviewDate.toISOString().slice(0, 10), comments: risk.comments, auditId: risk.auditId, findingId: risk.findingId, capaId: risk.capaId }; }
export async function updateRisk(auth: AuthenticatedUser, id: string, input: RiskUpdate) {
  const actor = await actorFor(auth); const risk = await riskFor(actor, id); allow(canMitigate(actor, risk));
  if (risk.status === "CLOSED") throw new HttpError(409, "Reopen the risk before editing it");
  const { expectedUpdatedAt, status = risk.status, ...patch } = input;
  if (!canManage(actor, risk)) {
    allow(Object.keys(patch).every((key) => ["additionalMitigation", "completionDate", "residualLikelihood", "residualSeverity", "comments"].includes(key)), "Employees may update assigned mitigation progress only");
    allow(["OPEN", "MITIGATION_IN_PROGRESS", "MITIGATED"].includes(risk.status) && ["OPEN", "MITIGATION_IN_PROGRESS", "MITIGATED"].includes(status), "Risk acceptance and closure require a manager or administrator");
  }
  if (["CLOSED", "ACCEPTED"].includes(status) && status !== risk.status) throw new HttpError(400, "Use the reviewed acceptance or closure action");
  const merged = { ...inputFrom(risk), ...patch };
  if (canManage(actor, risk)) { allow(canManage(actor, merged), "Managers may manage only their own department"); await validateDirectory(merged.departmentId, merged.responsibleEmployeeId); }
  const linksChanged = (["auditId", "findingId", "capaId"] as const).some((key) => merged[key] !== risk[key]);
  const links = canManage(actor, risk) && linksChanged ? await validateLinks(auth, merged) : { auditId: risk.auditId, findingId: risk.findingId, capaId: risk.capaId };
  const calculated = datesAndScores(merged);
  if (!riskReadyForStatus(status, { ...merged, ...calculated })) throw new HttpError(400, "Mitigation completion requires controls, a completion date and residual assessment");
  const levels = levelsOf(await configuration());
  await prisma.$transaction(async (tx) => {
    changed((await tx.riskAssessment.updateMany({ where: { id, updatedAt: new Date(expectedUpdatedAt), status: risk.status }, data: { ...merged, ...links, ...calculated, status, updatedAt: new Date() } })).count);
    if (risk.likelihood !== merged.likelihood || risk.severity !== merged.severity || risk.residualLikelihood !== merged.residualLikelihood || risk.residualSeverity !== merged.residualSeverity) await log(tx, actor, id, "RISK_SCORE_CHANGED", `Inherent ${risk.likelihood} × ${risk.severity} = ${risk.riskScore} (${riskLevelFor(risk.riskScore, levels)?.label}) → ${merged.likelihood} × ${merged.severity} = ${calculated.riskScore} (${riskLevelFor(calculated.riskScore, levels)?.label}); residual ${risk.residualRiskScore ?? "not assessed"} → ${calculated.residualRiskScore ?? "not assessed"}`);
    if (risk.responsibleEmployeeId !== merged.responsibleEmployeeId) await log(tx, actor, id, "RISK_OWNER_CHANGED", `${risk.responsibleEmployee.firstName} ${risk.responsibleEmployee.lastName} (${risk.responsibleEmployeeId}) → ${merged.responsibleEmployeeId}`);
    if (risk.additionalMitigation !== merged.additionalMitigation || inputFrom(risk).targetDate !== merged.targetDate || inputFrom(risk).completionDate !== merged.completionDate) await log(tx, actor, id, "RISK_MITIGATION_UPDATED", JSON.stringify({ previous: { control: risk.additionalMitigation, targetDate: inputFrom(risk).targetDate, completionDate: inputFrom(risk).completionDate }, next: { control: merged.additionalMitigation, targetDate: merged.targetDate, completionDate: merged.completionDate } }));
    if (status !== risk.status) await log(tx, actor, id, "RISK_STATUS_CHANGED", merged.comments || "Progress updated", risk.status, status);
    await log(tx, actor, id, "RISK_UPDATED", `Updated: ${Object.keys(patch).join(", ") || "status"}`);
  }, transactionOptions);
  return riskDetails(actor, id);
}
export async function reviewRisk(auth: AuthenticatedUser, id: string, input: { expectedUpdatedAt: string; nextReviewDate: string; comment: string }) {
  const actor = await actorFor(auth); const risk = await riskFor(actor, id); allow(canManage(actor, risk));
  if (risk.status === "CLOSED") throw new HttpError(409, "Reopen the risk before reviewing it");
  if (input.nextReviewDate <= calendarDay(new Date())) throw new HttpError(400, "The next review date must be in the future");
  await prisma.$transaction(async (tx) => { changed((await tx.riskAssessment.updateMany({ where: { id, updatedAt: new Date(input.expectedUpdatedAt) }, data: { reviewDate: new Date(input.nextReviewDate), reviewedAt: new Date(), reviewedById: actor.id, updatedAt: new Date() } })).count); await log(tx, actor, id, "RISK_REVIEWED", `${input.comment}; next review ${input.nextReviewDate}`); }, transactionOptions);
  return riskDetails(actor, id);
}
export async function decideRisk(auth: AuthenticatedUser, id: string, decision: "CLOSE" | "ACCEPT" | "REOPEN", input: { expectedUpdatedAt: string; comment: string }) {
  const actor = await actorFor(auth); const risk = await riskFor(actor, id); allow(canManage(actor, risk));
  if ((decision === "REOPEN") !== (risk.status === "CLOSED")) throw new HttpError(409, decision === "REOPEN" ? "Only closed risks can be reopened" : "Reopen the risk before changing it");
  const status: RiskStatus = decision === "CLOSE" ? "CLOSED" : decision === "ACCEPT" ? "ACCEPTED" : "OPEN";
  if (!riskReadyForStatus(status, risk)) throw new HttpError(400, decision === "ACCEPT" ? "Assess residual likelihood and severity before acceptance" : "Complete mitigation and residual assessment before closure");
  await prisma.$transaction(async (tx) => { changed((await tx.riskAssessment.updateMany({ where: { id, updatedAt: new Date(input.expectedUpdatedAt), status: risk.status }, data: { status, ...(decision === "CLOSE" ? { closedAt: new Date(), closedById: actor.id } : { closedAt: null, closedById: null }), ...(decision !== "REOPEN" ? { reviewedAt: new Date(), reviewedById: actor.id } : { completionDate: null }), updatedAt: new Date() } })).count); await log(tx, actor, id, decision === "CLOSE" ? "RISK_CLOSED" : decision === "REOPEN" ? "RISK_REOPENED" : "RISK_STATUS_CHANGED", input.comment, risk.status, status); }, transactionOptions);
  return riskDetails(actor, id);
}
export async function addRiskComment(auth: AuthenticatedUser, id: string, comment: string) { const actor = await actorFor(auth); const risk = await riskFor(actor, id); allow(canMitigate(actor, risk)); await prisma.$transaction(async (tx) => { await log(tx, actor, id, "COMMENT_ADDED", comment); }); return riskDetails(actor, id); }
export async function addRiskEvidence(auth: AuthenticatedUser, id: string, files: Express.Multer.File[]) {
  const actor = await actorFor(auth); const risk = await riskFor(actor, id); allow(canMitigate(actor, risk));
  if (!files.length) throw new HttpError(400, "Select at least one evidence file");
  if (risk.status === "CLOSED") throw new HttpError(409, "Reopen the risk before adding evidence");
  await prisma.$transaction(async (tx) => {
    changed((await tx.riskAssessment.updateMany({ where: { id, updatedAt: risk.updatedAt, status: { not: "CLOSED" } }, data: { updatedAt: new Date() } })).count);
    await tx.monthlyReportAttachment.createMany({ data: files.map((file) => ({ riskId: id, originalName: file.originalname, storedName: file.filename, mimeType: file.mimetype, size: file.size, uploadedById: actor.id })) });
    await log(tx, actor, id, "ATTACHMENT_ADDED", files.map((file) => file.originalname).join(", "));
  }, transactionOptions); return riskDetails(actor, id);
}
export async function getRiskEvidence(auth: AuthenticatedUser, id: string) {
  const actor = await actorFor(auth); const file = await prisma.monthlyReportAttachment.findUnique({ relationLoadStrategy: "join", where: { id } });
  if (!file?.riskId) throw new HttpError(404, "Risk evidence not found");
  await riskFor(actor, file.riskId); const filePath = path.resolve(monthlyReportUploadDirectory, file.storedName);
  if (!filePath.startsWith(`${monthlyReportUploadDirectory}${path.sep}`)) throw new HttpError(404, "Invalid evidence location");
  return { file, filePath };
}
export async function saveRiskConfiguration(auth: AuthenticatedUser, input: { expectedVersion: number; levels: RiskLevel[]; comment: string }) {
  const actor = await actorFor(auth); allow(isAuditAdmin(actor)); const previous = await configuration();
  await prisma.$transaction(async (tx) => { changed((await tx.riskScoringConfiguration.updateMany({ where: { id: "default", version: input.expectedVersion }, data: { levels: input.levels, version: { increment: 1 }, updatedById: actor.id } })).count); await tx.monthlyReportActionHistory.create({ data: { riskConfigurationId: "default", performedByUserId: actor.id, action: "RISK_SCORING_CONFIGURED", comment: JSON.stringify({ reason: input.comment, previous: previous.levels, next: input.levels, version: input.expectedVersion + 1 }) } }); }, transactionOptions);
  return getRiskConfiguration(auth);
}
export async function getRiskConfiguration(auth: AuthenticatedUser) { const actor = await actorFor(auth); allow(isAuditAdmin(actor)); const config = await configuration(); const history = await prisma.monthlyReportActionHistory.findMany({ relationLoadStrategy: "join", where: { riskConfigurationId: "default" }, include: { performedByUser: { select: user } }, orderBy: { createdAt: "desc" }, take: 100 }); return { ...config, levels: levelsOf(config), history }; }
export async function riskDashboard(auth: AuthenticatedUser) {
  const actor = await actorFor(auth); const levels = levelsOf(await configuration());
  const records = await prisma.riskAssessment.findMany({ relationLoadStrategy: "join", where: riskAccess(actor), select: { status: true, riskScore: true, targetDate: true, completionDate: true, reviewDate: true, createdAt: true, category: true, department: { select: { name: true } } } });
  const byDepartment: Record<string, number> = {}; const byCategory: Record<string, number> = {}; const byMonth: Record<string, number> = {};
  const month = calendarDay(new Date()).slice(0, 7); for (let i = 5; i >= 0; i--) { const date = new Date(`${month}-01`); date.setUTCMonth(date.getUTCMonth() - i); byMonth[date.toISOString().slice(0, 7)] = 0; }
  records.forEach((risk) => { byDepartment[risk.department.name] = (byDepartment[risk.department.name] ?? 0) + 1; byCategory[risk.category] = (byCategory[risk.category] ?? 0) + 1; const key = calendarDay(risk.createdAt).slice(0, 7); if (key in byMonth) byMonth[key]++; });
  const distribution = (rows: Record<string, number>) => Object.entries(rows).map(([label, value]) => ({ label, value }));
  return { totalRisks: records.length, criticalRisks: records.filter((risk) => riskLevelFor(risk.riskScore, levels)?.code === "CRITICAL").length, highRisks: records.filter((risk) => riskLevelFor(risk.riskScore, levels)?.code === "HIGH").length, openRisks: records.filter((risk) => risk.status !== "CLOSED").length, overdueMitigations: records.filter((risk) => riskMetrics(risk).isOverdue).length, dueForReview: records.filter((risk) => riskMetrics(risk).dueForReview).length, byDepartment: distribution(byDepartment), byCategory: distribution(byCategory), monthlyTrend: distribution(byMonth), scoringVersion: (await configuration()).version };
}
