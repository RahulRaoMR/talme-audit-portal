import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import type { CapaStatus, MonthlyReportAction, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { monthlyReportUploadDirectory } from "../config/monthlyReportUpload.js";
import type { AuthenticatedUser } from "../types/auth.js";
import { HttpError } from "../utils/httpError.js";
import { actionsReadyForVerification, actionsVerified, addDays, auditStatuses, capaStatuses, canTransitionAudit, dueMetrics, editablePlanStatuses, planIsComplete, calendarDay } from "../utils/auditRules.js";
import { actionInputSchema, type ActionInput, type AuditInput, type CapaPlanInput, type FindingInput, type RegisterQuery } from "../utils/auditSchemas.js";

const userSelect = { id: true, email: true, role: { select: { name: true } }, employee: { select: { id: true, firstName: true, lastName: true, departmentId: true } } } satisfies Prisma.UserSelect;
const employeeSelect = { id: true, employeeCode: true, firstName: true, lastName: true, departmentId: true, user: { select: { id: true, isActive: true } } } satisfies Prisma.EmployeeSelect;
const evidenceSelect = { id: true, originalName: true, mimeType: true, size: true, createdAt: true, uploadedById: true, auditId: true, findingId: true, capaId: true, actionItemId: true, purpose: true, reviewStatus: true, reviewComment: true, reviewedAt: true, reviewedBy: { select: userSelect } } satisfies Prisma.MonthlyReportAttachmentSelect;
const auditMeta = { department: true, auditor: { select: userSelect }, createdBy: { select: userSelect }, teamMembers: { include: { user: { select: userSelect } } } } satisfies Prisma.InternalAuditInclude;
const findingInclude = {
  rating: true, department: true, responsibleEmployee: { select: employeeSelect }, audit: { include: auditMeta }, evidence: { select: evidenceSelect },
  capa: { include: { actions: { include: { ownerEmployee: { select: employeeSelect }, department: true, evidence: { select: evidenceSelect } }, orderBy: { createdAt: "asc" } }, evidence: { select: evidenceSelect }, preparedBy: { select: userSelect }, reviewedBy: { select: userSelect }, verifiedBy: { select: userSelect }, closedBy: { select: userSelect }, verifications: { include: { performedBy: { select: userSelect } }, orderBy: { createdAt: "desc" } } } }
} satisfies Prisma.AuditFindingInclude;
type Finding = Prisma.AuditFindingGetPayload<{ include: typeof findingInclude }>;
type AuditMeta = Prisma.InternalAuditGetPayload<{ include: typeof auditMeta }>;
export type Actor = Prisma.UserGetPayload<{ select: typeof userSelect }>;
const transactionOptions = { maxWait: 10000, timeout: 60000 };
const workflowAuditStatuses = ["FINDINGS_ISSUED", "CAPA_PENDING", "CAPA_UNDER_REVIEW", "VERIFICATION_PENDING"] as const;

export const templateFilePath = new URL("../../resources/TELME_LA_CAPA_Template_Ver2.xlsx", import.meta.url);
export const templateFindings = JSON.parse(readFileSync(new URL("../../resources/capa-template.json", import.meta.url), "utf8")) as Array<Omit<FindingInput, "departmentId"> & { sourceRow: number }>;

export async function actorFor(auth: AuthenticatedUser) {
  const actor = await prisma.user.findFirst({ relationLoadStrategy: "join", where: { id: auth.userId, isActive: true }, select: userSelect });
  if (!actor) throw new HttpError(401, "User account is unavailable");
  return actor;
}
export function isAuditAdmin(actor: Actor) { return ["HR_ADMIN", "SUPER_ADMIN"].includes(actor.role.name); }
export function canCreateAudit(actor: Actor) { return isAuditAdmin(actor) || actor.role.name === "AUDITOR"; }
function canManage(actor: Actor, audit: AuditMeta) {
  return isAuditAdmin(actor) || (actor.role.name === "AUDITOR" && (audit.auditorId === actor.id || audit.createdById === actor.id || audit.teamMembers.some((item) => item.userId === actor.id)));
}
function canPrepare(actor: Actor, finding: Finding) { return isAuditAdmin(actor) || Boolean(actor.employee && finding.responsibleEmployeeId === actor.employee.id); }
function requireAllowed(value: boolean, message = "You do not have permission for this action"): asserts value { if (!value) throw new HttpError(403, message); }
function requireOpenAudit(audit: { status: string }) { if (["CLOSED", "CANCELLED"].includes(audit.status)) throw new HttpError(409, "This audit is closed or cancelled"); }
function requireMutableFinding(finding: Finding) { requireOpenAudit(finding.audit); if (finding.status === "CLOSED") throw new HttpError(409, "Reopen this finding before changing it"); }
function requireChanged(count: number) { if (count !== 1) throw new HttpError(409, "The record changed. Refresh it and try again."); }
function requireComment(comment: string) { if (!comment.trim()) throw new HttpError(400, "A review comment or reason is required"); }

export function findingAccess(actor: Actor): Prisma.AuditFindingWhereInput {
  if (isAuditAdmin(actor)) return {};
  if (actor.role.name === "AUDITOR") return { audit: { OR: [{ auditorId: actor.id }, { createdById: actor.id }, { teamMembers: { some: { userId: actor.id } } }] } };
  const own: Prisma.AuditFindingWhereInput[] = [{ audit: { teamMembers: { some: { userId: actor.id } } } }];
  if (actor.employee) {
    own.push({ responsibleEmployeeId: actor.employee.id }, { capa: { actions: { some: { ownerEmployeeId: actor.employee.id } } } });
    if (actor.role.name === "MANAGER") own.push({ departmentId: actor.employee.departmentId });
  }
  return { OR: own };
}
export function auditAccess(actor: Actor): Prisma.InternalAuditWhereInput {
  if (isAuditAdmin(actor)) return {};
  if (actor.role.name === "AUDITOR") return { OR: [{ auditorId: actor.id }, { createdById: actor.id }, { teamMembers: { some: { userId: actor.id } } }] };
  return { OR: [{ teamMembers: { some: { userId: actor.id } } }, { findings: { some: findingAccess(actor) } }, ...(actor.role.name === "MANAGER" && actor.employee ? [{ departmentId: actor.employee.departmentId }] : [])] };
}
async function auditFor(actor: Actor, id: string) {
  const audit = await prisma.internalAudit.findFirst({ relationLoadStrategy: "join", where: { AND: [{ id }, auditAccess(actor)] }, include: auditMeta });
  if (!audit) throw new HttpError(404, "Audit not found or not assigned to you");
  return audit;
}
async function findingFor(actor: Actor, id: string) {
  const finding = await prisma.auditFinding.findFirst({ relationLoadStrategy: "join", where: { AND: [{ id }, findingAccess(actor)] }, include: findingInclude });
  if (!finding) throw new HttpError(404, "Finding not found or not assigned to you");
  return finding;
}
async function capaFor(actor: Actor, id: string) {
  const finding = await prisma.auditFinding.findFirst({ relationLoadStrategy: "join", where: { AND: [{ capa: { id } }, findingAccess(actor)] }, include: findingInclude });
  if (!finding?.capa) throw new HttpError(404, "CAPA not found or not assigned to you");
  return { finding, capa: finding.capa };
}
async function activeEmployee(id: string) {
  const employee = await prisma.employee.findFirst({ relationLoadStrategy: "join", where: { id, user: { isActive: true }, department: { isActive: true } }, select: employeeSelect });
  if (!employee) throw new HttpError(400, "Select an active employee");
  return employee;
}
async function activeDepartment(id: string) { if (!await prisma.department.findFirst({ relationLoadStrategy: "join", where: { id, isActive: true }, select: { id: true } })) throw new HttpError(400, "Select an active department"); }
async function validateAuditor(id: string) {
  if (!await prisma.user.findFirst({ relationLoadStrategy: "join", where: { id, isActive: true, role: { name: { in: ["AUDITOR", "HR_ADMIN", "SUPER_ADMIN"] } } }, select: { id: true } })) throw new HttpError(400, "Select an active auditor or administrator");
}
export async function nextReference(tx: Prisma.TransactionClient, prefix: string) {
  const year = new Intl.DateTimeFormat("en", { timeZone: "Asia/Kolkata", year: "numeric" }).format(new Date());
  const key = `${prefix}-${year}`;
  const counter = await tx.auditCounter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
  return `${key}-${counter.value.toString().padStart(4, "0")}`;
}
async function log(tx: Prisma.TransactionClient, actor: Actor, auditId: string, action: MonthlyReportAction, details: { findingId?: string; capaId?: string; comment?: string; previousStatus?: string; newStatus?: string } = {}) {
  await tx.monthlyReportActionHistory.create({ data: { auditId, performedByUserId: actor.id, action, ...details } });
}
async function notify(tx: Prisma.TransactionClient, actor: Actor, recipients: Array<string | null | undefined>, title: string, message: string, href: string) {
  const unique = [...new Set(recipients.filter((id): id is string => Boolean(id) && id !== actor.id))];
  if (unique.length) await tx.portalNotification.createMany({ data: unique.map((recipientId) => ({ recipientId, dedupeKey: randomUUID(), title, message, href })) });
}
async function syncAudit(tx: Prisma.TransactionClient, actor: Actor, auditId: string) {
  const audit = await tx.internalAudit.findUniqueOrThrow({ relationLoadStrategy: "join", where: { id: auditId } });
  if (!(workflowAuditStatuses as readonly string[]).includes(audit.status)) return;
  const capas = await tx.capa.findMany({ relationLoadStrategy: "join", where: { finding: { auditId } }, select: { status: true } });
  const status = capas.some((item) => ["SUBMITTED", "UNDER_REVIEW"].includes(item.status)) ? "CAPA_UNDER_REVIEW"
    : capas.length && capas.every((item) => ["VERIFICATION_PENDING", "VERIFIED", "CLOSED"].includes(item.status)) ? "VERIFICATION_PENDING" : "CAPA_PENDING";
  if (audit.status !== status) {
    await tx.internalAudit.update({ where: { id: auditId }, data: { status } });
    await log(tx, actor, auditId, "AUDIT_STATUS_CHANGED", { previousStatus: audit.status, newStatus: status, comment: "Updated from CAPA progress" });
  }
}
function summarize(findings: Finding[]) {
  const byRating = findings.reduce<Record<string, number>>((result, finding) => { result[finding.ratingCode] = (result[finding.ratingCode] ?? 0) + 1; return result; }, {});
  const capas = findings.flatMap((finding) => finding.capa ? [finding.capa] : []);
  return { totalFindings: findings.length, byRating, openCapas: capas.filter((item) => item.status !== "CLOSED").length, closedCapas: capas.filter((item) => item.status === "CLOSED").length, overdueCapas: capas.filter((item) => dueMetrics(item.targetDate, item.createdAt, item.status).isOverdue).length };
}
function findingResponse(actor: Actor, finding: Finding) {
  const editable = canPrepare(actor, finding) && finding.status !== "CLOSED" && !["CLOSED", "CANCELLED"].includes(finding.audit.status);
  return { ...finding, metrics: dueMetrics(finding.capa?.targetDate ?? null, finding.createdAt, finding.status, undefined, finding.closedAt),
    permissions: { canManage: canManage(actor, finding.audit), canReview: canManage(actor, finding.audit), canPrepare: editable, canEditPlan: editable && (editablePlanStatuses as readonly string[]).includes(finding.capa?.status ?? ""), canReopen: isAuditAdmin(actor), employeeId: actor.employee?.id ?? null },
    capa: finding.capa ? { ...finding.capa, metrics: dueMetrics(finding.capa.targetDate, finding.capa.createdAt, finding.capa.status, undefined, finding.capa.closedAt ?? finding.capa.verifiedAt), preparationMetrics: dueMetrics(finding.audit.capaPreparationDueDate, finding.audit.auditDate ?? finding.createdAt, ["OPEN", "RCA_PENDING", "PREPARATION", "RETURNED"].includes(finding.capa.status) ? "OPEN" : "CLOSED", undefined, finding.capa.submittedAt), actions: finding.capa.actions.map((item) => ({ ...item, metrics: dueMetrics(item.targetDate, item.createdAt, item.status, undefined, item.verifiedAt ?? item.completionDate) })) } : null
  };
}

export async function auditOptions(auth: AuthenticatedUser) {
  const actor = await actorFor(auth);
  const [departments, people, ratings] = await Promise.all([
    prisma.department.findMany({ relationLoadStrategy: "join", where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ relationLoadStrategy: "join", where: { isActive: true }, select: userSelect, orderBy: { email: "asc" } }),
    prisma.findingRating.findMany({ relationLoadStrategy: "join", where: { isActive: true }, orderBy: { severity: "desc" } })
  ]);
  // Only audit managers can browse organization-wide assignment options.
  const users = canCreateAudit(actor) ? people : people.filter((item) => item.id === actor.id || (actor.role.name === "MANAGER" && item.employee?.departmentId === actor.employee?.departmentId));
  return { departments, users, auditors: users.filter((item) => ["AUDITOR", "HR_ADMIN", "SUPER_ADMIN"].includes(item.role.name)), ratings, canCreate: canCreateAudit(actor), canConfigure: isAuditAdmin(actor) };
}
export async function createAudit(auth: AuthenticatedUser, input: AuditInput) {
  const actor = await actorFor(auth); requireAllowed(canCreateAudit(actor));
  await Promise.all([activeDepartment(input.departmentId), validateAuditor(input.auditorId)]);
  const members = [...new Set(input.teamMemberIds)];
  if (await prisma.user.count({ where: { id: { in: members }, isActive: true } }) !== members.length) throw new HttpError(400, "Audit team contains an inactive or unknown user");
  const audit = await prisma.$transaction(async (tx) => {
    const { teamMemberIds: _team, auditDate, ...fields } = input;
    const created = await tx.internalAudit.create({ data: { ...fields, auditDate: auditDate ? new Date(auditDate) : null, capaPreparationDueDate: auditDate ? addDays(new Date(auditDate), 14) : null, reference: await nextReference(tx, "AUD"), createdById: actor.id, teamMembers: { create: members.map((userId) => ({ userId })) } } });
    await log(tx, actor, created.id, "AUDIT_CREATED", { newStatus: "DRAFT" });
    await notify(tx, actor, [input.auditorId, ...members], "Audit assigned", created.reference, `/audits/${created.id}`);
    return created;
  }, transactionOptions);
  return getAudit(auth, audit.id);
}
export async function updateAudit(auth: AuthenticatedUser, id: string, input: Partial<AuditInput>) {
  const actor = await actorFor(auth); const audit = await auditFor(actor, id); requireAllowed(canManage(actor, audit)); requireOpenAudit(audit);
  if (input.departmentId) await activeDepartment(input.departmentId);
  if (input.auditorId) await validateAuditor(input.auditorId);
  const members = input.teamMemberIds ? [...new Set(input.teamMemberIds)] : null;
  if (members && await prisma.user.count({ where: { id: { in: members }, isActive: true } }) !== members.length) throw new HttpError(400, "Invalid audit team");
  await prisma.$transaction(async (tx) => {
    const { teamMemberIds: _team, auditDate, ...fields } = input;
    const changed = await tx.internalAudit.updateMany({ where: { id, updatedAt: audit.updatedAt }, data: { ...fields, ...(auditDate !== undefined ? { auditDate: auditDate ? new Date(auditDate) : null, capaPreparationDueDate: auditDate ? addDays(new Date(auditDate), 14) : null } : {}) } });
    requireChanged(changed.count);
    if (members) { await tx.auditTeamMember.deleteMany({ where: { auditId: id } }); if (members.length) await tx.auditTeamMember.createMany({ data: members.map((userId) => ({ userId, auditId: id })) }); }
    await log(tx, actor, id, input.auditorId && input.auditorId !== audit.auditorId ? "AUDITOR_ASSIGNED" : "AUDIT_UPDATED");
    if (input.auditorId && input.auditorId !== audit.auditorId) await notify(tx, actor, [input.auditorId], "Auditor assigned", audit.reference, `/audits/${id}`);
  }, transactionOptions);
  return getAudit(auth, id);
}
export async function changeAuditStatus(auth: AuthenticatedUser, id: string, status: InternalAuditStatusType, comment: string) {
  const actor = await actorFor(auth); const audit = await auditFor(actor, id); requireAllowed(canManage(actor, audit));
  if (!canTransitionAudit(audit.status, status, isAuditAdmin(actor))) throw new HttpError(409, "This audit status transition is not allowed");
  if (["CANCELLED", "CLOSED"].includes(status) || audit.status === "CLOSED") requireComment(comment);
  if (status !== "CANCELLED" && (!audit.auditDate || !audit.scope.trim())) throw new HttpError(400, "Confirm the audit date and scope first");
  await prisma.$transaction(async (tx) => {
    if (status === "CLOSED") {
      const open = await tx.auditFinding.count({ where: { auditId: id, OR: [{ status: { not: "CLOSED" } }, { capa: { status: { not: "CLOSED" } } }, { capa: { is: null } }] } });
      if (open) throw new HttpError(409, "Close every finding and verified CAPA before closing the audit");
    }
    if (status === "FINDINGS_ISSUED" && !await tx.auditFinding.count({ where: { auditId: id } })) throw new HttpError(400, "Add findings before issuing them, or close a compliant audit with no findings");
    if (status === "VERIFICATION_PENDING" && await tx.capa.count({ where: { finding: { auditId: id }, status: { notIn: ["VERIFICATION_PENDING", "VERIFIED", "CLOSED"] } } })) throw new HttpError(409, "CAPAs are not ready for verification");
    if (status === "CAPA_UNDER_REVIEW" && !await tx.capa.count({ where: { finding: { auditId: id }, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } })) throw new HttpError(409, "No submitted CAPA is awaiting review");
    const changed = await tx.internalAudit.updateMany({ where: { id, updatedAt: audit.updatedAt }, data: { status, closedAt: status === "CLOSED" ? new Date() : null, ...(status === "FINDINGS_ISSUED" ? { findingsIssuedAt: new Date(), capaPreparationDueDate: addDays(new Date(calendarDay(new Date())), 14) } : {}) } });
    requireChanged(changed.count);
    await log(tx, actor, id, status === "CLOSED" ? "AUDIT_CLOSED" : audit.status === "CLOSED" ? "AUDIT_REOPENED" : "AUDIT_STATUS_CHANGED", { previousStatus: audit.status, newStatus: status, comment });
  }, transactionOptions);
  return getAudit(auth, id);
}
type InternalAuditStatusType = Prisma.InternalAuditGetPayload<Record<string, never>>["status"];

export async function getAudit(auth: AuthenticatedUser, id: string) {
  const actor = await actorFor(auth); const audit = await auditFor(actor, id);
  const findings = await prisma.auditFinding.findMany({ relationLoadStrategy: "join", where: { AND: [{ auditId: id }, findingAccess(actor)] }, include: findingInclude, orderBy: { reference: "asc" } });
  const visibleIds = findings.map((item) => item.id);
  const [evidence, history] = await Promise.all([
    prisma.monthlyReportAttachment.findMany({ relationLoadStrategy: "join", where: { auditId: id, OR: [{ findingId: null }, { findingId: { in: visibleIds } }] }, select: evidenceSelect, orderBy: { createdAt: "desc" } }),
    prisma.monthlyReportActionHistory.findMany({ relationLoadStrategy: "join", where: { auditId: id, OR: [{ findingId: null }, { findingId: { in: visibleIds } }] }, include: { performedByUser: { select: userSelect } }, orderBy: { createdAt: "desc" }, take: 500 })
  ]);
  return { ...audit, findings: findings.map((item) => findingResponse(actor, item)), evidence, history, stats: summarize(findings), permissions: { canManage: canManage(actor, audit), canReopen: isAuditAdmin(actor) } };
}
export async function getFinding(auth: AuthenticatedUser, id: string) { const actor = await actorFor(auth); return findingResponse(actor, await findingFor(actor, id)); }

async function addFinding(tx: Prisma.TransactionClient, actor: Actor, audit: { id: string; reference: string }, input: FindingInput) {
  const numbered = await tx.internalAudit.update({ where: { id: audit.id }, data: { findingSequence: { increment: 1 } } });
  const finding = await tx.auditFinding.create({ data: { ...input, reference: `${audit.reference}-F${numbered.findingSequence.toString().padStart(2, "0")}`, auditId: audit.id, capa: { create: { reference: await nextReference(tx, "CAPA") } } }, include: { capa: true, responsibleEmployee: { select: employeeSelect } } });
  await log(tx, actor, audit.id, "FINDING_CREATED", { findingId: finding.id, capaId: finding.capa!.id, newStatus: "OPEN" });
  await notify(tx, actor, [finding.responsibleEmployee?.user?.id], "Finding assigned", finding.reference, `/findings/${finding.id}`);
  return finding;
}
export async function createFinding(auth: AuthenticatedUser, auditId: string, input: FindingInput) {
  const actor = await actorFor(auth); const audit = await auditFor(actor, auditId); requireAllowed(canManage(actor, audit)); requireOpenAudit(audit);
  if (!['DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'AUDIT_COMPLETED'].includes(audit.status)) throw new HttpError(409, "Findings have already been issued; finish or reopen the audit before adding more");
  await activeDepartment(input.departmentId); if (input.responsibleEmployeeId) await activeEmployee(input.responsibleEmployeeId);
  if (!await prisma.findingRating.findFirst({ relationLoadStrategy: "join", where: { code: input.ratingCode, isActive: true } })) throw new HttpError(400, "Select an active finding rating");
  const finding = await prisma.$transaction(async (tx) => {
    const changed = await tx.internalAudit.updateMany({ where: { id: auditId, status: audit.status, updatedAt: audit.updatedAt }, data: { updatedAt: new Date() } }); requireChanged(changed.count);
    return addFinding(tx, actor, audit, input);
  }, transactionOptions);
  return getFinding(auth, finding.id);
}
export async function updateFinding(auth: AuthenticatedUser, id: string, input: Partial<FindingInput>) {
  const actor = await actorFor(auth); const finding = await findingFor(actor, id); requireAllowed(canManage(actor, finding.audit)); requireMutableFinding(finding);
  if (input.departmentId) await activeDepartment(input.departmentId);
  const owner = input.responsibleEmployeeId ? await activeEmployee(input.responsibleEmployeeId) : null;
  if (input.ratingCode && !await prisma.findingRating.findFirst({ relationLoadStrategy: "join", where: { code: input.ratingCode, isActive: true } })) throw new HttpError(400, "Invalid finding rating");
  await prisma.$transaction(async (tx) => {
    const changed = await tx.auditFinding.updateMany({ where: { id, updatedAt: finding.updatedAt }, data: input }); requireChanged(changed.count);
    await log(tx, actor, finding.auditId, "FINDING_UPDATED", { findingId: id, capaId: finding.capa?.id });
    if (input.responsibleEmployeeId !== undefined && input.responsibleEmployeeId !== finding.responsibleEmployeeId) await notify(tx, actor, [owner?.user?.id], "Finding assigned", finding.reference, `/findings/${id}`);
  }, transactionOptions);
  return getFinding(auth, id);
}
export async function importTemplate(auth: AuthenticatedUser, auditId?: string) {
  const actor = await actorFor(auth); requireAllowed(canCreateAudit(actor));
  let audit: { id: string; reference: string; departmentId: string };
  if (auditId) { const found = await auditFor(actor, auditId); requireAllowed(canManage(actor, found)); if (found.status !== "DRAFT") throw new HttpError(409, "Import the template into a draft audit"); audit = found; }
  else {
    const department = actor.employee?.departmentId ?? (await prisma.department.findFirstOrThrow({ relationLoadStrategy: "join", where: { isActive: true } })).id;
    const existing = await prisma.internalAudit.findUnique({ relationLoadStrategy: "join", where: { sourceImportKey: "TELME_LA_CAPA_Template_Ver2" } });
    if (existing) return getAudit(auth, existing.id);
    audit = await prisma.$transaction(async (tx) => {
      const created = await tx.internalAudit.create({ data: { title: "Labor Agent RBA Audit — imported CAPA workbook", organisation: "TELME_ LABOR AGENT", departmentId: department, auditorId: actor.id, createdById: actor.id, reference: await nextReference(tx, "AUD"), sourceDocument: "TELME _LA_CAPA_Template_Ver2.xlsx", sourceImportKey: "TELME_LA_CAPA_Template_Ver2", scope: "Imported source findings. Confirm the audit date, scope, department and owners before scheduling." } });
      await log(tx, actor, created.id, "AUDIT_CREATED", { newStatus: "DRAFT", comment: "Imported source workbook; original audit date is unconfirmed" }); return created;
    }, transactionOptions);
  }
  await prisma.$transaction(async (tx) => {
    const existingRows = await tx.auditFinding.findMany({ relationLoadStrategy: "join", where: { auditId: audit.id, sourceModule: "CAPA_WORKBOOK" }, select: { sourceRecordId: true } });
    const imported = new Set(existingRows.map((row) => row.sourceRecordId));
    for (const row of templateFindings) if (!imported.has(String(row.sourceRow))) await addFinding(tx, actor, audit, { rbaSection: row.rbaSection, rbaReference: row.rbaReference, ratingCode: row.ratingCode, description: row.description, departmentId: audit.departmentId, sourceModule: "CAPA_WORKBOOK", sourceRecordId: String(row.sourceRow) });
  }, transactionOptions);
  return getAudit(auth, audit.id);
}

export async function saveCapaPlan(auth: AuthenticatedUser, id: string, input: CapaPlanInput) {
  const actor = await actorFor(auth); const { finding, capa } = await capaFor(actor, id);
  requireAllowed(canPrepare(actor, finding)); requireMutableFinding(finding);
  if (!(editablePlanStatuses as readonly string[]).includes(capa.status)) throw new HttpError(409, "The submitted plan is locked; ask the auditor to return it for correction");
  if (input.expectedUpdatedAt && input.expectedUpdatedAt !== capa.updatedAt.toISOString()) throw new HttpError(409, "The CAPA changed. Reload before saving.");
  if (input.responsibleEmployeeId !== undefined && input.responsibleEmployeeId !== finding.responsibleEmployeeId) requireAllowed(isAuditAdmin(actor), "Only an administrator or the audit manager can reassign ownership");
  if (input.responsibleEmployeeId) await activeEmployee(input.responsibleEmployeeId);
  const { expectedUpdatedAt: _version, responsibleEmployeeId, startDate, targetDate, dateEstablished, implementationDays, ...fields } = input;
  const start = startDate !== undefined ? startDate ? new Date(startDate) : null : capa.startDate;
  const target = targetDate !== undefined ? targetDate ? new Date(targetDate) : null : implementationDays ? addDays(start ?? capa.dateEstablished, implementationDays) : capa.targetDate;
  if (start && target && target < start) throw new HttpError(400, "Target date cannot be before start date");
  const selectedRootCause = (fields.rcaMethod ?? capa.rcaMethod) === "FIVE_WHY" ? (fields.finalRootCause ?? capa.finalRootCause) : (fields.rootCause ?? capa.rootCause);
  const nextStatus = selectedRootCause.trim() ? "PREPARATION" : "RCA_PENDING";
  await prisma.$transaction(async (tx) => {
    const changed = await tx.capa.updateMany({ where: { id, updatedAt: capa.updatedAt, status: capa.status }, data: {
      ...fields, ...(dateEstablished ? { dateEstablished: new Date(dateEstablished) } : {}), startDate: start, targetDate: target,
      ...(implementationDays !== undefined ? { implementationDays } : {}), preparedById: actor.id,
      status: nextStatus
    } }); requireChanged(changed.count);
    if (responsibleEmployeeId !== undefined) await tx.auditFinding.update({ where: { id: finding.id }, data: { responsibleEmployeeId } });
    await log(tx, actor, finding.auditId, "CAPA_UPDATED", { findingId: finding.id, capaId: id, previousStatus: capa.status, newStatus: nextStatus });
  }, transactionOptions);
  return getFinding(auth, finding.id);
}
export async function addCapaAction(auth: AuthenticatedUser, id: string, input: ActionInput) {
  const actor = await actorFor(auth); const { finding, capa } = await capaFor(actor, id);
  requireAllowed(canPrepare(actor, finding)); requireMutableFinding(finding);
  if (!(editablePlanStatuses as readonly string[]).includes(capa.status)) throw new HttpError(409, "Add actions while preparing or correcting the CAPA plan");
  await Promise.all([activeEmployee(input.ownerEmployeeId), activeDepartment(input.departmentId)]);
  await prisma.$transaction(async (tx) => {
    const changed = await tx.capa.updateMany({ where: { id, updatedAt: capa.updatedAt }, data: { updatedAt: new Date() } }); requireChanged(changed.count);
    const { startDate, targetDate, completionDate: _completion, status: _status, ...fields } = input;
    await tx.capaActionItem.create({ data: { ...fields, capaId: id, startDate: new Date(startDate), targetDate: new Date(targetDate) } });
    await log(tx, actor, finding.auditId, "ACTION_CREATED", { findingId: finding.id, capaId: id, comment: `${input.actionType}: ${input.description}` });
    const owner = await tx.employee.findUnique({ relationLoadStrategy: "join", where: { id: input.ownerEmployeeId }, select: { user: { select: { id: true } } } });
    await notify(tx, actor, [owner?.user?.id], "CAPA action assigned", capa.reference, `/findings/${finding.id}`);
  }, transactionOptions);
  return getFinding(auth, finding.id);
}
export async function updateCapaAction(auth: AuthenticatedUser, actionId: string, input: Record<string, unknown>) {
  const actor = await actorFor(auth);
  const action = await prisma.capaActionItem.findUnique({ relationLoadStrategy: "join", where: { id: actionId } });
  if (!action) throw new HttpError(404, "Action not found");
  const { finding, capa } = await capaFor(actor, action.capaId); requireMutableFinding(finding);
  const reviewer = canManage(actor, finding.audit);
  const owner = isAuditAdmin(actor) || actor.employee?.id === action.ownerEmployeeId;
  const planEditable = (editablePlanStatuses as readonly string[]).includes(capa.status) && canPrepare(actor, finding);
  requireAllowed(owner || reviewer || planEditable);
  if (["VERIFIED", "CLOSED"].includes(capa.status)) throw new HttpError(409, "Reopen the finding before changing verified actions");
  if (!planEditable && ["description", "ownerEmployeeId", "departmentId", "startDate", "targetDate"].some((key) => key in input)) throw new HttpError(409, "The approved action plan is locked");
  const merged = actionInputSchema.parse({ ...action, startDate: action.startDate.toISOString().slice(0, 10), targetDate: action.targetDate.toISOString().slice(0, 10), completionDate: action.completionDate?.toISOString().slice(0, 10) ?? null, ...input });
  const nextStatus = merged.status ?? action.status;
  if (action.status === "VERIFIED" && nextStatus !== "REJECTED") throw new HttpError(409, "Verified actions are locked");
  if ("completionDate" in input) requireAllowed(owner, "Only the action owner can record completion");
  const allEvidence = [...finding.evidence, ...capa.evidence, ...capa.actions.flatMap((item) => item.evidence)];
  const relevant = [...new Map(allEvidence.filter((item) => !item.actionItemId || item.actionItemId === actionId).map((item) => [item.id, item])).values()];
  if (nextStatus !== action.status) {
    if (["VERIFIED", "REJECTED"].includes(nextStatus)) {
      requireAllowed(reviewer, "Only the assigned auditor can verify or reject an action");
      requireAllowed(actor.employee?.id !== action.ownerEmployeeId, "An action owner cannot verify their own work");
      requireComment(merged.comments);
      if (!["ACTION_IN_PROGRESS", "VERIFICATION_PENDING"].includes(capa.status)) throw new HttpError(409, "The CAPA must be accepted before action verification");
      if (nextStatus === "VERIFIED" && (!["COMPLETED", "VERIFICATION_PENDING"].includes(action.status) || !relevant.some((item) => item.reviewStatus === "ACCEPTED"))) throw new HttpError(400, "Complete the action and accept supporting evidence before verification");
    } else {
      requireAllowed(owner, "Only the action owner can record implementation progress");
      if (capa.status !== "ACTION_IN_PROGRESS" && nextStatus !== "NOT_STARTED") throw new HttpError(409, "The auditor must accept the CAPA plan before implementation");
      if (action.status === "VERIFIED") throw new HttpError(409, "Verified actions are locked");
      if (["COMPLETED", "VERIFICATION_PENDING"].includes(nextStatus) && (!merged.completionDate || !relevant.some((item) => item.reviewStatus !== "REJECTED"))) throw new HttpError(400, "Provide a completion date and supporting evidence");
    }
  }
  if (merged.ownerEmployeeId !== action.ownerEmployeeId) await activeEmployee(merged.ownerEmployeeId);
  if (merged.departmentId !== action.departmentId) await activeDepartment(merged.departmentId);
  await prisma.$transaction(async (tx) => {
    const changed = await tx.capa.updateMany({ where: { id: capa.id, updatedAt: capa.updatedAt }, data: { updatedAt: new Date(), ...(nextStatus === "REJECTED" ? { status: "ACTION_IN_PROGRESS" } : {}) } }); requireChanged(changed.count);
    await tx.capaActionItem.update({ where: { id: actionId }, data: { actionType: action.actionType, description: merged.description, ownerEmployeeId: merged.ownerEmployeeId, departmentId: merged.departmentId, startDate: new Date(merged.startDate), targetDate: new Date(merged.targetDate), completionDate: merged.completionDate ? new Date(merged.completionDate) : null, status: nextStatus, comments: merged.comments, verifiedById: nextStatus === "VERIFIED" ? actor.id : null, verifiedAt: nextStatus === "VERIFIED" ? new Date() : null } });
    await log(tx, actor, finding.auditId, nextStatus === "VERIFIED" ? "ACTION_VERIFIED" : nextStatus === "REJECTED" ? "ACTION_REJECTED" : nextStatus === "COMPLETED" ? "ACTION_COMPLETED" : "ACTION_UPDATED", { findingId: finding.id, capaId: capa.id, previousStatus: action.status, newStatus: nextStatus, comment: merged.comments });
    if (nextStatus === "REJECTED") {
      await tx.auditFinding.update({ where: { id: finding.id }, data: { status: "ACTION_IN_PROGRESS" } });
      await syncAudit(tx, actor, finding.auditId);
    }
  }, transactionOptions);
  return getFinding(auth, finding.id);
}

export async function transitionCapa(auth: AuthenticatedUser, id: string, decision: string, comment: string) {
  const actor = await actorFor(auth); const { finding, capa } = await capaFor(actor, id); requireMutableFinding(finding);
  const reviewer = canManage(actor, finding.audit);
  const preparer = canPrepare(actor, finding);
  const evidence = [...new Map([...finding.evidence, ...capa.evidence, ...capa.actions.flatMap((item) => item.evidence)].map((item) => [item.id, item])).values()];
  let status = capa.status;
  let findingStatus: Finding["status"] = finding.status;
  let action: MonthlyReportAction = "CAPA_UPDATED";
  const extra: Prisma.CapaUpdateManyMutationInput = {};
  if (decision === "SUBMIT") {
    requireAllowed(preparer);
    if (!(editablePlanStatuses as readonly string[]).includes(capa.status)) throw new HttpError(409, "This CAPA is already submitted");
    if (![...workflowAuditStatuses].includes(finding.audit.status as typeof workflowAuditStatuses[number])) throw new HttpError(409, "The auditor must issue the findings before CAPA submission");
    if (!planIsComplete(capa, finding.responsibleEmployeeId)) throw new HttpError(400, "Complete RCA, responsible person, target date, corrective/preventive plans and at least one action of each type");
    status = "SUBMITTED"; findingStatus = "UNDER_REVIEW"; action = "CAPA_SUBMITTED";
    Object.assign(extra, { submittedAt: new Date(), preparedById: actor.id, auditorStatus: "UNDER_REVIEW" });
  } else if (decision === "REQUEST_VERIFICATION") {
    requireAllowed(preparer);
    if (capa.status !== "ACTION_IN_PROGRESS" || !actionsReadyForVerification(capa.actions) || !evidence.some((item) => item.reviewStatus !== "REJECTED")) throw new HttpError(400, "Complete all actions and upload evidence before requesting verification");
    status = "VERIFICATION_PENDING"; findingStatus = "VERIFICATION_PENDING"; action = "VERIFICATION_REQUESTED";
    const completions = capa.actions.flatMap((item) => item.completionDate ? [item.completionDate.getTime()] : []);
    Object.assign(extra, { completionDate: completions.length ? new Date(Math.max(...completions)) : null });
  } else {
    requireAllowed(reviewer, "Only the assigned auditor or an administrator can review this CAPA");
    requireAllowed(actor.id !== capa.preparedById && actor.employee?.id !== finding.responsibleEmployeeId, "A CAPA preparer or responsible person cannot review their own CAPA");
    if (decision === "START_REVIEW") {
      if (capa.status !== "SUBMITTED") throw new HttpError(409, "Only a submitted CAPA can enter review");
      status = "UNDER_REVIEW"; action = "CAPA_REVIEW_STARTED";
    } else if (decision === "ACCEPT") {
      if (!["SUBMITTED", "UNDER_REVIEW"].includes(capa.status)) throw new HttpError(409, "Only a submitted CAPA can be accepted");
      requireComment(comment); status = "ACTION_IN_PROGRESS"; findingStatus = "ACTION_IN_PROGRESS"; action = "CAPA_ACCEPTED";
      Object.assign(extra, { reviewedById: actor.id, reviewedAt: new Date(), auditorStatus: "ACCEPTED", auditorComments: comment });
    } else if (decision === "RETURN") {
      if (!["SUBMITTED", "UNDER_REVIEW", "ACTION_IN_PROGRESS"].includes(capa.status)) throw new HttpError(409, "This CAPA cannot be returned from its current status");
      requireComment(comment); status = "RETURNED"; findingStatus = "CAPA_PENDING"; action = "CAPA_RETURNED";
      Object.assign(extra, { reviewedById: actor.id, reviewedAt: new Date(), auditorStatus: "RETURNED", auditorComments: comment });
    } else if (decision === "VERIFY") {
      if (capa.status !== "VERIFICATION_PENDING" || !actionsVerified(capa.actions) || !evidence.some((item) => item.reviewStatus === "ACCEPTED")) throw new HttpError(400, "Verify every completed action and accept evidence before verifying the CAPA");
      requireComment(comment); status = "VERIFIED"; action = "CAPA_VERIFIED";
      Object.assign(extra, { verifiedById: actor.id, verifiedAt: new Date(), auditorStatus: "VERIFIED", verificationResult: comment });
    } else if (decision === "REJECT_VERIFICATION") {
      if (capa.status !== "VERIFICATION_PENDING") throw new HttpError(409, "Verification is not pending");
      requireComment(comment); status = "ACTION_IN_PROGRESS"; findingStatus = "ACTION_IN_PROGRESS"; action = "VERIFICATION_REJECTED";
      Object.assign(extra, { auditorStatus: "RETURNED", verificationResult: comment, verifiedAt: null, verifiedById: null });
    } else throw new HttpError(400, "Unknown CAPA decision");
  }
  await prisma.$transaction(async (tx) => {
    const changed = await tx.capa.updateMany({ where: { id, status: capa.status, updatedAt: capa.updatedAt }, data: { ...extra, status } }); requireChanged(changed.count);
    await tx.auditFinding.update({ where: { id: finding.id }, data: { status: findingStatus } });
    if (["VERIFY", "REJECT_VERIFICATION"].includes(decision)) await tx.capaVerification.create({ data: { capaId: id, performedById: actor.id, result: decision === "VERIFY" ? "ACCEPTED" : "REJECTED", comment, evidenceIds: evidence.filter((item) => item.reviewStatus === "ACCEPTED").map((item) => item.id) } });
    await log(tx, actor, finding.auditId, action, { findingId: finding.id, capaId: id, previousStatus: capa.status, newStatus: status, comment });
    await notify(tx, actor, preparer && !reviewer ? [finding.audit.auditorId] : [finding.responsibleEmployee?.user?.id], `CAPA ${status.replaceAll("_", " ").toLowerCase()}`, `${capa.reference}: ${comment || finding.reference}`, `/findings/${finding.id}`);
    await syncAudit(tx, actor, finding.auditId);
  }, transactionOptions);
  return getFinding(auth, finding.id);
}

export async function closeFinding(auth: AuthenticatedUser, id: string, comment: string) {
  const actor = await actorFor(auth); const finding = await findingFor(actor, id); requireAllowed(canManage(actor, finding.audit)); requireMutableFinding(finding); requireComment(comment);
  const capa = finding.capa;
  if (!capa || capa.status !== "VERIFIED" || !actionsVerified(capa.actions)) throw new HttpError(409, "Verify the CAPA and all actions before closing this finding");
  requireAllowed(actor.id !== capa.preparedById && actor.employee?.id !== finding.responsibleEmployeeId, "A responsible person cannot close their own finding");
  await prisma.$transaction(async (tx) => {
    const changed = await tx.capa.updateMany({ where: { id: capa.id, status: "VERIFIED", updatedAt: capa.updatedAt }, data: { status: "CLOSED", closedAt: new Date(), closedById: actor.id, auditorStatus: "CLOSED" } }); requireChanged(changed.count);
    await tx.auditFinding.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } });
    await log(tx, actor, finding.auditId, "FINDING_CLOSED", { findingId: id, capaId: capa.id, previousStatus: finding.status, newStatus: "CLOSED", comment });
    await notify(tx, actor, [finding.responsibleEmployee?.user?.id], "Finding closed", finding.reference, `/findings/${id}`);
    await syncAudit(tx, actor, finding.auditId);
  }, transactionOptions);
  return getFinding(auth, id);
}
export async function reopenFinding(auth: AuthenticatedUser, id: string, comment: string) {
  const actor = await actorFor(auth); requireAllowed(isAuditAdmin(actor));
  const finding = await findingFor(actor, id); requireOpenAudit(finding.audit); requireComment(comment);
  if (finding.status !== "CLOSED" || !finding.capa) throw new HttpError(409, "This finding is not closed");
  await prisma.$transaction(async (tx) => {
    await tx.auditFinding.update({ where: { id }, data: { status: "CAPA_PENDING", closedAt: null } });
    await tx.capa.update({ where: { id: finding.capa!.id }, data: { status: "RETURNED", closedAt: null, closedById: null, verifiedAt: null, verifiedById: null, auditorStatus: "RETURNED", auditorComments: comment } });
    await tx.capaActionItem.updateMany({ where: { capaId: finding.capa!.id, status: "VERIFIED" }, data: { status: "IN_PROGRESS", verifiedAt: null, verifiedById: null } });
    await log(tx, actor, finding.auditId, "CAPA_RETURNED", { findingId: id, capaId: finding.capa!.id, previousStatus: "CLOSED", newStatus: "RETURNED", comment: `Reopened: ${comment}` });
    await syncAudit(tx, actor, finding.auditId);
  }, transactionOptions);
  return getFinding(auth, id);
}

export async function addAuditComment(auth: AuthenticatedUser, auditId: string, comment: string, findingId?: string) {
  const actor = await actorFor(auth); const audit = await auditFor(actor, auditId); requireOpenAudit(audit); requireComment(comment);
  if (findingId) { const finding = await findingFor(actor, findingId); if (finding.auditId !== auditId) throw new HttpError(404, "Finding is not part of this audit"); }
  await prisma.$transaction((tx) => log(tx, actor, auditId, "COMMENT_ADDED", { findingId, comment }), transactionOptions);
  return getAudit(auth, auditId);
}

export async function addAuditEvidence(auth: AuthenticatedUser, auditId: string, files: Express.Multer.File[], context: { findingId?: string | null; capaId?: string | null; actionItemId?: string | null; purpose: string }) {
  try {
    const actor = await actorFor(auth); const audit = await auditFor(actor, auditId); requireOpenAudit(audit);
    let finding: Finding | null = context.findingId ? await findingFor(actor, context.findingId) : null;
    if (context.capaId) finding = (await capaFor(actor, context.capaId)).finding;
    let action: Prisma.CapaActionItemGetPayload<Record<string, never>> | null = null;
    if (context.actionItemId) { action = await prisma.capaActionItem.findUnique({ relationLoadStrategy: "join", where: { id: context.actionItemId } }); if (!action) throw new HttpError(404, "Action not found"); finding = (await capaFor(actor, action.capaId)).finding; }
    if (finding) {
      if (finding.auditId !== auditId || context.findingId && context.findingId !== finding.id || context.capaId && context.capaId !== finding.capa?.id) throw new HttpError(400, "Evidence context does not belong to this audit");
      requireMutableFinding(finding);
      requireAllowed(canManage(actor, audit) || canPrepare(actor, finding) || Boolean(action && actor.employee?.id === action.ownerEmployeeId));
      if (["VERIFIED", "CLOSED"].includes(finding.capa?.status ?? "")) throw new HttpError(409, "Verified CAPA evidence is locked");
    } else requireAllowed(canManage(actor, audit), "Only audit managers can upload audit-wide evidence");
    if (!files.length) throw new HttpError(400, "Choose at least one evidence file");
    await prisma.$transaction(async (tx) => {
      if (finding?.capa) await tx.capa.update({ where: { id: finding.capa.id }, data: { updatedAt: new Date() } });
      for (const file of files) {
        await tx.monthlyReportAttachment.create({ data: { auditId, findingId: finding?.id, capaId: finding?.capa?.id, actionItemId: action?.id, purpose: context.purpose, originalName: path.basename(file.originalname), storedName: file.filename, mimeType: file.mimetype, size: file.size, uploadedById: actor.id } });
        await log(tx, actor, auditId, "ATTACHMENT_ADDED", { findingId: finding?.id, capaId: finding?.capa?.id, comment: file.originalname });
      }
    }, transactionOptions);
    return getAudit(auth, auditId);
  } catch (error) { await Promise.all(files.map((file) => unlink(file.path).catch(() => undefined))); throw error; }
}
export async function getAuditEvidence(auth: AuthenticatedUser, id: string) {
  const actor = await actorFor(auth);
  const evidence = await prisma.monthlyReportAttachment.findUnique({ relationLoadStrategy: "join", where: { id } });
  if (!evidence?.auditId) throw new HttpError(404, "Audit evidence not found");
  await auditFor(actor, evidence.auditId);
  if (evidence.findingId) await findingFor(actor, evidence.findingId);
  const filePath = path.resolve(monthlyReportUploadDirectory, evidence.storedName);
  if (!filePath.startsWith(`${monthlyReportUploadDirectory}${path.sep}`)) throw new HttpError(400, "Invalid evidence path");
  return { evidence, filePath };
}
export async function reviewAuditEvidence(auth: AuthenticatedUser, id: string, reviewStatus: "ACCEPTED" | "REJECTED", comment: string) {
  const actor = await actorFor(auth); const { evidence } = await getAuditEvidence(auth, id); const audit = await auditFor(actor, evidence.auditId!);
  requireAllowed(canManage(actor, audit)); requireAllowed(actor.id !== evidence.uploadedById, "You cannot approve your own evidence"); requireOpenAudit(audit);
  if (reviewStatus === "REJECTED") requireComment(comment);
  const finding = evidence.findingId ? await findingFor(actor, evidence.findingId) : null;
  if (finding) requireMutableFinding(finding);
  await prisma.$transaction(async (tx) => {
    await tx.monthlyReportAttachment.update({ where: { id }, data: { reviewStatus, reviewComment: comment, reviewedAt: new Date(), reviewedById: actor.id } });
    if (finding?.capa) {
      await tx.capa.update({ where: { id: finding.capa.id }, data: { updatedAt: new Date(), ...(reviewStatus === "REJECTED" && ["VERIFIED", "VERIFICATION_PENDING"].includes(finding.capa.status) ? { status: "ACTION_IN_PROGRESS", verifiedById: null, verifiedAt: null, auditorStatus: "RETURNED" } : {}) } });
      if (reviewStatus === "REJECTED") {
        await tx.capaActionItem.updateMany({ where: { capaId: finding.capa.id, ...(evidence.actionItemId ? { id: evidence.actionItemId } : {}), status: "VERIFIED" }, data: { status: "REJECTED", verifiedAt: null, verifiedById: null } });
        if (["VERIFIED", "VERIFICATION_PENDING"].includes(finding.capa.status)) await tx.auditFinding.update({ where: { id: finding.id }, data: { status: "ACTION_IN_PROGRESS" } });
      }
    }
    await log(tx, actor, audit.id, "EVIDENCE_REVIEWED", { findingId: finding?.id, capaId: finding?.capa?.id, previousStatus: evidence.reviewStatus, newStatus: reviewStatus, comment: `${evidence.originalName}: ${comment}` });
    if (reviewStatus === "REJECTED") await notify(tx, actor, [evidence.uploadedById, finding?.responsibleEmployee?.user?.id], "Evidence returned", comment, finding ? `/findings/${finding.id}` : `/audits/${audit.id}`);
    await syncAudit(tx, actor, audit.id);
  }, transactionOptions);
  return getAudit(auth, audit.id);
}

function findingFilters(query: RegisterQuery): Prisma.AuditFindingWhereInput {
  return { ...(query.departmentId ? { departmentId: query.departmentId } : {}), ...(query.responsibleEmployeeId ? { responsibleEmployeeId: query.responsibleEmployeeId } : {}), ...(query.ratingCode ? { ratingCode: query.ratingCode } : {}), ...(query.auditorId ? { audit: { auditorId: query.auditorId } } : {}) };
}
export async function listAudits(auth: AuthenticatedUser, query: RegisterQuery) {
  const actor = await actorFor(auth);
  if (query.status && !(auditStatuses as readonly string[]).includes(query.status)) throw new HttpError(400, "Invalid audit status");
  const where: Prisma.InternalAuditWhereInput = { AND: [auditAccess(actor), {
    ...(query.departmentId ? { departmentId: query.departmentId } : {}), ...(query.auditorId ? { auditorId: query.auditorId } : {}),
    ...(query.status ? { status: query.status as InternalAuditStatusType } : {}),
    ...(query.dateFrom || query.dateTo ? { auditDate: { ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}) } } : {}),
    ...(query.search ? { OR: [{ title: { contains: query.search, mode: "insensitive" } }, { reference: { contains: query.search, mode: "insensitive" } }, { organisation: { contains: query.search, mode: "insensitive" } }] } : {}),
    ...(query.ratingCode ? { findings: { some: { ratingCode: query.ratingCode, AND: [findingAccess(actor)] } } } : {})
  }] };
  const [audits, total] = await Promise.all([
    prisma.internalAudit.findMany({ relationLoadStrategy: "join", where, include: { ...auditMeta, findings: { where: findingAccess(actor), include: findingInclude } }, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.internalAudit.count({ where })
  ]);
  return { audits: audits.map(({ findings, ...audit }) => ({ ...audit, stats: summarize(findings), permissions: { canManage: canManage(actor, audit) } })), pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } };
}
export async function listCapas(auth: AuthenticatedUser, query: RegisterQuery) {
  const actor = await actorFor(auth);
  if (query.status && !(capaStatuses as readonly string[]).includes(query.status)) throw new HttpError(400, "Invalid CAPA status");
  const today = new Date(calendarDay(new Date()));
  const capaFilter: Prisma.CapaWhereInput = {
    AND: [
      ...(query.status ? [{ status: query.status as CapaStatus }] : []),
      ...(query.view === "CLOSED" ? [{ status: "CLOSED" as const }] : query.view === "OPEN" ? [{ status: { not: "CLOSED" as const } }] : query.view === "OVERDUE" ? [{ status: { notIn: ["VERIFIED", "CLOSED"] as CapaStatus[] }, targetDate: { lt: today } }] : [])
    ],
    ...(query.dateFrom || query.dateTo ? { targetDate: { ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}), ...(query.view === "OVERDUE" ? { lt: today } : {}) } } : {})
  };
  const where: Prisma.AuditFindingWhereInput = { AND: [findingAccess(actor), findingFilters(query), { audit: { status: { not: "CANCELLED" } }, capa: capaFilter,
    ...(query.search ? { OR: [{ reference: { contains: query.search, mode: "insensitive" } }, { description: { contains: query.search, mode: "insensitive" } }, { capa: { reference: { contains: query.search, mode: "insensitive" } } }] } : {}) }] };
  const [findings, total] = await Promise.all([
    prisma.auditFinding.findMany({ relationLoadStrategy: "join", where, include: findingInclude, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), prisma.auditFinding.count({ where })
  ]);
  return { findings: findings.map((finding) => findingResponse(actor, finding)), pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } };
}
export async function auditDashboard(auth: AuthenticatedUser) {
  const actor = await actorFor(auth);
  const [audits, findings] = await Promise.all([
    prisma.internalAudit.findMany({ relationLoadStrategy: "join", where: auditAccess(actor), select: { id: true, status: true, auditDate: true } }),
    prisma.auditFinding.findMany({ relationLoadStrategy: "join", where: { AND: [findingAccess(actor), { audit: { status: { not: "CANCELLED" } } }] }, select: { ratingCode: true, status: true, department: { select: { id: true, name: true } }, capa: { select: { status: true, targetDate: true, createdAt: true, closedAt: true, actions: { select: { status: true, targetDate: true, createdAt: true } } } } } })
  ]);
  const capas = findings.flatMap((item) => item.capa ? [item.capa] : []);
  const today = calendarDay(new Date()); const endWeek = today + ((7 - new Date(today).getUTCDay()) % 7) * 86400000;
  const month = new Date(today).toISOString().slice(0, 7);
  const distribution = (values: string[]) => Object.entries(values.reduce<Record<string, number>>((all, value) => { all[value] = (all[value] ?? 0) + 1; return all; }, {})).map(([label, value]) => ({ label, value }));
  return {
    totalAudits: audits.length, openAudits: audits.filter((item) => !["CLOSED", "CANCELLED"].includes(item.status)).length, closedAudits: audits.filter((item) => item.status === "CLOSED").length,
    totalFindings: findings.length, majorNc: findings.filter((item) => item.ratingCode === "MAJOR_NC").length, minorNc: findings.filter((item) => item.ratingCode === "MINOR_NC").length, ofi: findings.filter((item) => item.ratingCode === "OFI").length,
    openCapas: capas.filter((item) => item.status !== "CLOSED").length, overdueCapas: capas.filter((item) => dueMetrics(item.targetDate, item.createdAt, item.status).isOverdue).length,
    dueThisWeek: capas.filter((item) => !["CLOSED", "VERIFIED"].includes(item.status) && item.targetDate && item.targetDate.getTime() >= today && item.targetDate.getTime() <= endWeek).length,
    closedThisMonth: capas.filter((item) => item.closedAt && new Date(calendarDay(item.closedAt)).toISOString().startsWith(month)).length,
    byRating: distribution(findings.map((item) => item.ratingCode)), byDepartment: distribution(findings.map((item) => item.department.name)), byStatus: distribution(capas.map((item) => item.status)),
    monthlyTrend: distribution(audits.filter((item) => item.auditDate).map((item) => item.auditDate!.toISOString().slice(0, 7))).sort((a, b) => a.label.localeCompare(b.label)),
    ageing: distribution(capas.filter((item) => item.status !== "CLOSED").map((item) => { const age = dueMetrics(item.targetDate, item.createdAt, item.status).ageingDays; return age <= 30 ? "0–30 days" : age <= 60 ? "31–60 days" : age <= 90 ? "61–90 days" : "Over 90 days"; })),
    overdueActions: capas.flatMap((item) => item.actions).filter((item) => dueMetrics(item.targetDate, item.createdAt, item.status).isOverdue).length
  };
}
export async function saveFindingRating(auth: AuthenticatedUser, input: { code: string; label: string; severity: number; isActive: boolean }) {
  const actor = await actorFor(auth); requireAllowed(isAuditAdmin(actor));
  return prisma.findingRating.upsert({ where: { code: input.code }, create: input, update: { label: input.label, severity: input.severity, isActive: input.isActive } });
}
export async function listNotifications(auth: AuthenticatedUser) {
  const actor = await actorFor(auth);
  if (actor.employee) {
    const due = await prisma.capa.findMany({ relationLoadStrategy: "join", where: { finding: { responsibleEmployeeId: actor.employee.id, audit: { status: { notIn: ["CLOSED", "CANCELLED"] } } }, status: { notIn: ["CLOSED", "VERIFIED"] }, targetDate: { lte: addDays(new Date(calendarDay(new Date())), 7) } }, include: { finding: { select: { id: true } } }, take: 100 });
    const notifications = due.map((capa) => {
      const metrics = dueMetrics(capa.targetDate, capa.createdAt, capa.status); const kind = metrics.isOverdue ? "overdue" : "due soon";
      return { recipientId: actor.id, dedupeKey: `${capa.id}:${kind}:${capa.targetDate!.toISOString()}`, title: `CAPA ${kind}`, message: `${capa.reference} — ${metrics.isOverdue ? `${metrics.daysOverdue} days overdue` : `${metrics.daysRemaining} days remaining`}`, href: `/findings/${capa.finding.id}` };
    });
    if (notifications.length) await prisma.portalNotification.createMany({ data: notifications, skipDuplicates: true });
  }
  const [notifications, unread] = await Promise.all([prisma.portalNotification.findMany({ relationLoadStrategy: "join", where: { recipientId: actor.id }, orderBy: { createdAt: "desc" }, take: 50 }), prisma.portalNotification.count({ where: { recipientId: actor.id, readAt: null } })]);
  return { notifications, unread };
}
export async function readNotification(auth: AuthenticatedUser, id: string) {
  const actor = await actorFor(auth); const changed = await prisma.portalNotification.updateMany({ where: { id, recipientId: actor.id }, data: { readAt: new Date() } });
  if (!changed.count) throw new HttpError(404, "Notification not found");
  return { message: "Notification marked as read" };
}
export async function importedAuditFor(auth: AuthenticatedUser) {
  const actor = await actorFor(auth);
  return prisma.internalAudit.findFirst({ relationLoadStrategy: "join", where: { AND: [{ sourceImportKey: "TELME_LA_CAPA_Template_Ver2" }, auditAccess(actor)] }, select: { id: true, reference: true, status: true } });
}
