import { Prisma, type Quarter, type QuarterlyReportAction } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import type { AuthenticatedUser } from "../types/auth.js";
import type {
  CreateQuarterlyReportInput,
  ManagerReviewInput,
  QuarterlyReportListQuery,
  QuarterlyPreviewQuery,
  UpdateQuarterlyReportInput
} from "../utils/quarterlyReportSchemas.js";
import {
  calculateOverallScore,
  calculateWeightTotal,
  calculateWeightedScore,
  canEditQuarterlyReport,
  canFinalizeQuarterlyReport,
  canManagerReviewQuarterlyReport,
  canViewQuarterlyReport,
  getCurrentQuarter,
  getQuarterMonths,
  isWeightTotalValid,
  selectRating
} from "../utils/quarterlyReportRules.js";
import { HttpError } from "../utils/httpError.js";

const monthlySelect = {
  id: true,
  month: true,
  year: true,
  reportPeriod: true,
  status: true,
  summary: true,
  hrDetail: true,
  developerDetail: true,
  payrollDetail: true
} satisfies Prisma.MonthlyReportSelect;

const quarterlyInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      designation: true,
      managerId: true,
      department: { select: { id: true, name: true, code: true } }
    }
  },
  monthlyReport1: { select: monthlySelect },
  monthlyReport2: { select: monthlySelect },
  monthlyReport3: { select: monthlySelect },
  managerReviewedBy: { select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } } },
  hrReviewedBy: { select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } } },
  kpiScores: {
    include: { kpi: { include: { department: { select: { id: true, name: true, code: true } } } } },
    orderBy: { kpi: { sortOrder: "asc" as const } }
  },
  history: {
    include: { performedByUser: { select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } } } },
    orderBy: { createdAt: "desc" as const }
  }
} satisfies Prisma.QuarterlyReportInclude;

type QuarterlyWithDetails = Prisma.QuarterlyReportGetPayload<{ include: typeof quarterlyInclude }>;

async function getActor(auth: AuthenticatedUser) {
  const actor = await prisma.user.findUnique({ where: { id: auth.userId }, select: { id: true, employeeId: true } });
  if (!actor) throw new HttpError(401, "User account no longer exists");
  return { ...actor, roleName: auth.roleName };
}

function accessContext(actor: Awaited<ReturnType<typeof getActor>>, report: QuarterlyWithDetails) {
  return {
    actorEmployeeId: actor.employeeId,
    roleName: actor.roleName,
    ownerEmployeeId: report.employeeId,
    ownerManagerId: report.employee.managerId,
    status: report.status
  };
}

async function getReportOrThrow(id: string) {
  const report = await prisma.quarterlyReport.findUnique({ where: { id }, include: quarterlyInclude });
  if (!report) throw new HttpError(404, "Quarterly report not found");
  return report;
}

async function findQuarterMonthlyReports(employeeId: string, quarter: Quarter, year: number) {
  const months = getQuarterMonths(quarter);
  const reports = await prisma.monthlyReport.findMany({
    where: { employeeId, year, month: { in: [...months] } },
    select: monthlySelect,
    orderBy: { month: "asc" }
  });
  const byMonth = new Map(reports.map((report) => [report.month, report]));
  return months.map((month) => byMonth.get(month) ?? null);
}

function monthlyLinks(monthlyReports: Awaited<ReturnType<typeof findQuarterMonthlyReports>>) {
  return {
    monthlyReport1Id: monthlyReports[0]?.id ?? null,
    monthlyReport2Id: monthlyReports[1]?.id ?? null,
    monthlyReport3Id: monthlyReports[2]?.id ?? null
  };
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

type QuarterMonthlyReport = NonNullable<Awaited<ReturnType<typeof findQuarterMonthlyReports>>[number]>;

function prefillActualValue(code: string, reports: QuarterMonthlyReport[]) {
  if (code === "COMMON_REPORT_COMPLETION") return String(Math.round((reports.filter((report) => report.status === "APPROVED").length / 3) * 10000) / 100);
  const hr = reports.map((report) => report.hrDetail).filter((detail): detail is NonNullable<typeof detail> => Boolean(detail));
  const dev = reports.map((report) => report.developerDetail).filter((detail): detail is NonNullable<typeof detail> => Boolean(detail));
  const pay = reports.map((report) => report.payrollDetail).filter((detail): detail is NonNullable<typeof detail> => Boolean(detail));
  const sum = <T>(items: T[], selector: (item: T) => number) => items.reduce((total, item) => total + selector(item), 0);

  const values: Record<string, number | null> = {
    HR_RECRUITMENT_CLOSURES: sum(hr, (item) => item.positionsClosed),
    HR_CANDIDATE_PROCESSING: sum(hr, (item) => item.candidatesInterviewed),
    HR_EMPLOYEE_ONBOARDING: sum(hr, (item) => item.employeesOnboarded),
    HR_DOCUMENTATION_COMPLETION: percentage(sum(hr, (item) => item.documentsCompleted), sum(hr, (item) => item.documentsCompleted + item.documentsPending)),
    HR_ISSUE_RESOLUTION: sum(hr, (item) => item.employeeIssuesResolved),
    DEV_TASK_COMPLETION: percentage(sum(dev, (item) => item.tasksCompleted), sum(dev, (item) => item.tasksAssigned)),
    DEV_ON_TIME_DELIVERY: dev.length ? Math.round((sum(dev.filter((item) => item.onTimeDeliveryPercent !== null), (item) => item.onTimeDeliveryPercent ?? 0) / Math.max(1, dev.filter((item) => item.onTimeDeliveryPercent !== null).length)) * 100) / 100 : null,
    DEV_BUG_RESOLUTION: percentage(sum(dev, (item) => item.bugsResolved), sum(dev, (item) => item.bugsAssigned)),
    DEV_PROJECT_CONTRIBUTION: sum(dev, (item) => item.projectsWorkedOn),
    PAY_PAYROLL_ACCURACY: percentage(Math.max(0, sum(pay, (item) => item.employeesProcessed) - sum(pay, (item) => item.payrollErrors)), sum(pay, (item) => item.employeesProcessed)),
    PAY_ON_TIME_PROCESSING: sum(pay, (item) => item.payrollCompleted),
    PAY_PAYSLIP_COMPLETION: percentage(sum(pay, (item) => item.payslipsGenerated), sum(pay, (item) => item.payslipsGenerated + item.payslipsPending)),
    PAY_QUERY_RESOLUTION: percentage(sum(pay, (item) => item.queriesResolved), sum(pay, (item) => item.employeeQueries)),
    PAY_COMPLIANCE_COMPLETION: percentage(
      pay.reduce((total, item) => total + [item.pfStatus, item.esiStatus, item.tdsStatus].filter((status) => /complete|compliant|paid|yes/i.test(status)).length, 0),
      pay.length * 3
    )
  };
  const value = values[code];
  return value === undefined || value === null ? null : String(value);
}

export async function listQuarterlyReports(auth: AuthenticatedUser, query: QuarterlyReportListQuery) {
  const actor = await getActor(auth);
  let access: Prisma.QuarterlyReportWhereInput;
  if (query.scope === "mine") {
    if (!actor.employeeId) throw new HttpError(403, "Your account is not linked to an employee");
    access = { employeeId: actor.employeeId };
  } else if (actor.roleName === "MANAGER") {
    access = { employee: { managerId: actor.employeeId ?? "" }, status: { not: "DRAFT" } };
  } else if (["HR_ADMIN", "SUPER_ADMIN"].includes(actor.roleName)) {
    access = {};
  } else if (actor.roleName === "AUDITOR") {
    access = { status: "FINALIZED" };
  } else {
    throw new HttpError(403, "You do not have permission to review quarterly reports");
  }

  const where: Prisma.QuarterlyReportWhereInput = {
    AND: [access, query.quarter ? { quarter: query.quarter } : {}, query.year ? { year: query.year } : {}, query.status ? { status: query.status } : {}, query.departmentId ? { employee: { departmentId: query.departmentId } } : {}, query.employeeId ? { employeeId: query.employeeId } : {}]
  };
  const employeeWhere: Prisma.EmployeeWhereInput = query.scope === "mine" ? { id: actor.employeeId ?? "" } : actor.roleName === "MANAGER" ? { managerId: actor.employeeId ?? "" } : {};
  const [reports, total, departments, employees] = await prisma.$transaction([
    prisma.quarterlyReport.findMany({
      where,
      select: {
        id: true, quarter: true, year: true, status: true, overallScore: true, finalRating: true,
        employeeSubmittedAt: true, managerReviewedAt: true, finalizedAt: true, updatedAt: true,
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, managerId: true, department: { select: { id: true, name: true, code: true } } } },
        monthlyReport1: { select: { id: true, status: true, month: true } },
        monthlyReport2: { select: { id: true, status: true, month: true } },
        monthlyReport3: { select: { id: true, status: true, month: true } }
      },
      orderBy: [{ year: "desc" }, { quarter: "desc" }, { updatedAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    prisma.quarterlyReport.count({ where }),
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: employeeWhere, select: { id: true, employeeCode: true, firstName: true, lastName: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], take: 200 })
  ]);
  return { reports, departments, employees, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) } };
}

export async function getCurrentQuarterlyReport(auth: AuthenticatedUser) {
  const actor = await getActor(auth);
  if (!actor.employeeId) return null;
  return prisma.quarterlyReport.findUnique({
    where: { employeeId_quarter_year: { employeeId: actor.employeeId, quarter: getCurrentQuarter(), year: new Date().getFullYear() } },
    select: { id: true, quarter: true, year: true, status: true, overallScore: true, finalRating: true }
  });
}

export async function getQuarterlyPreview(auth: AuthenticatedUser, query: QuarterlyPreviewQuery) {
  const actor = await getActor(auth);
  if (!actor.employeeId) throw new HttpError(403, "Your account is not linked to an employee");
  const reports = await findQuarterMonthlyReports(actor.employeeId, query.quarter, query.year);
  return getQuarterMonths(query.quarter).map((month, index) => ({ month, report: reports[index] }));
}

export async function getQuarterlyReport(auth: AuthenticatedUser, id: string) {
  const [actor, report] = await Promise.all([getActor(auth), getReportOrThrow(id)]);
  if (!canViewQuarterlyReport(accessContext(actor, report))) throw new HttpError(403, "You do not have permission to view this quarterly report");
  const expectedMonths = getQuarterMonths(report.quarter);
  const linked = [report.monthlyReport1, report.monthlyReport2, report.monthlyReport3];
  const monthlyReports = expectedMonths.map((month, index) => ({ month, report: linked[index] ?? null }));
  return { ...report, monthlyReports };
}

export async function createQuarterlyReport(auth: AuthenticatedUser, input: CreateQuarterlyReportInput) {
  const actor = await getActor(auth);
  if (!actor.employeeId) throw new HttpError(403, "Your account is not linked to an employee");
  const duplicate = await prisma.quarterlyReport.findUnique({ where: { employeeId_quarter_year: { employeeId: actor.employeeId, quarter: input.quarter, year: input.year } }, select: { id: true } });
  if (duplicate) throw new HttpError(409, "A quarterly report for this period already exists.");
  const monthlyReports = await findQuarterMonthlyReports(actor.employeeId, input.quarter, input.year);
  const report = await prisma.$transaction(async (transaction) => {
    const created = await transaction.quarterlyReport.create({ data: { employeeId: actor.employeeId!, quarter: input.quarter, year: input.year, summary: input.summary, majorAchievements: input.majorAchievements, majorChallenges: input.majorChallenges, nextQuarterFocus: input.nextQuarterFocus, employeeComments: input.employeeComments, ...monthlyLinks(monthlyReports) } });
    await transaction.quarterlyReportActionHistory.create({ data: { quarterlyReportId: created.id, action: "CREATED", performedByUserId: actor.id } });
    return created;
  });
  return getQuarterlyReport(auth, report.id);
}

export async function updateQuarterlyReport(auth: AuthenticatedUser, id: string, input: UpdateQuarterlyReportInput) {
  const [actor, report] = await Promise.all([getActor(auth), getReportOrThrow(id)]);
  if (!canEditQuarterlyReport(accessContext(actor, report))) throw new HttpError(403, "Only the owner can edit a draft or returned quarterly report");
  await prisma.$transaction([
    prisma.quarterlyReport.update({ where: { id }, data: input }),
    prisma.quarterlyReportActionHistory.create({ data: { quarterlyReportId: id, action: "UPDATED", performedByUserId: actor.id } })
  ]);
  return getQuarterlyReport(auth, id);
}

function validateQuarterlyContent(report: QuarterlyWithDetails) {
  const required = [["summary", report.summary], ["major achievements", report.majorAchievements], ["major challenges", report.majorChallenges], ["next quarter focus", report.nextQuarterFocus]] as const;
  const missing = required.find(([, value]) => !value.trim());
  if (missing) throw new HttpError(400, `${missing[0]} is required before submission`);
}

export async function submitQuarterlyReport(auth: AuthenticatedUser, id: string) {
  const [actor, report] = await Promise.all([getActor(auth), getReportOrThrow(id)]);
  if (!canEditQuarterlyReport(accessContext(actor, report))) throw new HttpError(403, "Only the owner can submit a draft or returned quarterly report");
  validateQuarterlyContent(report);
  const monthlyReports = await findQuarterMonthlyReports(report.employeeId, report.quarter, report.year);
  const applicableKpis = await prisma.kpi.findMany({ where: { isActive: true, OR: [{ isCommon: true }, { departmentId: report.employee.department.id }] }, orderBy: { sortOrder: "asc" } });
  if (!applicableKpis.length) throw new HttpError(400, "No active KPIs are configured for this department");

  await prisma.$transaction(async (transaction) => {
    await transaction.quarterlyReport.update({ where: { id }, data: { status: "SUBMITTED", employeeSubmittedAt: new Date(), managerReviewedAt: null, managerReviewedById: null, ...monthlyLinks(monthlyReports) } });
    if (report.kpiScores.length === 0) {
      const existingReports = monthlyReports.filter((item): item is NonNullable<typeof item> => Boolean(item));
      await transaction.quarterlyKpiScore.createMany({ data: applicableKpis.map((kpi) => ({ quarterlyReportId: id, kpiId: kpi.id, weightageSnapshot: kpi.weightage, actualValue: prefillActualValue(kpi.code, existingReports) })) });
    }
    await transaction.quarterlyReportActionHistory.create({ data: { quarterlyReportId: id, action: "SUBMITTED", performedByUserId: actor.id } });
  });
  return getQuarterlyReport(auth, id);
}

async function writeManagerScores(id: string, input: ManagerReviewInput, finalizeReview: boolean, actorId: string) {
  const report = await getReportOrThrow(id);
  const scoreByKpi = new Map(input.scores.map((score) => [score.kpiId, score]));
  if (scoreByKpi.size !== report.kpiScores.length || report.kpiScores.some((score) => !scoreByKpi.has(score.kpiId))) {
    throw new HttpError(400, "Provide a score for every KPI in this quarterly review");
  }
  if (report.kpiScores.some((score) => score.kpi.unitType === "TEXT")) {
    throw new HttpError(400, "Text KPIs require a scoring method before manager review can be completed");
  }
  const updates = report.kpiScores.map((snapshot) => {
    const inputScore = scoreByKpi.get(snapshot.kpiId)!;
    const weighted = calculateWeightedScore(inputScore.score, Number(snapshot.weightageSnapshot));
    return prisma.quarterlyKpiScore.update({ where: { id: snapshot.id }, data: { targetValue: inputScore.targetValue, actualValue: inputScore.actualValue, score: inputScore.score, weightedScore: weighted, managerComment: inputScore.managerComment } });
  });
  await prisma.$transaction([
    ...updates,
    prisma.quarterlyReport.update({ where: { id }, data: { managerComments: input.managerComments || null, ...(finalizeReview ? { status: "MANAGER_REVIEWED", managerReviewedAt: new Date(), managerReviewedById: actorId } : {}) } }),
    ...(finalizeReview ? [prisma.quarterlyReportActionHistory.create({ data: { quarterlyReportId: id, action: "MANAGER_REVIEWED", performedByUserId: actorId, comment: input.managerComments || null } })] : [])
  ]);
}

export async function saveManagerReview(auth: AuthenticatedUser, id: string, input: ManagerReviewInput, submit: boolean) {
  const [actor, report] = await Promise.all([getActor(auth), getReportOrThrow(id)]);
  if (!canManagerReviewQuarterlyReport(accessContext(actor, report))) throw new HttpError(403, "You do not have permission to score this quarterly report");
  await writeManagerScores(id, input, submit, actor.id);
  return getQuarterlyReport(auth, id);
}

export async function returnQuarterlyReport(auth: AuthenticatedUser, id: string, comment: string) {
  const [actor, report] = await Promise.all([getActor(auth), getReportOrThrow(id)]);
  if (!canManagerReviewQuarterlyReport(accessContext(actor, report))) throw new HttpError(403, "You do not have permission to return this quarterly report");
  await prisma.$transaction([
    prisma.quarterlyReport.update({ where: { id }, data: { status: "RETURNED", managerComments: comment, managerReviewedAt: new Date(), managerReviewedById: actor.id } }),
    prisma.quarterlyReportActionHistory.create({ data: { quarterlyReportId: id, action: "RETURNED", performedByUserId: actor.id, comment } })
  ]);
  return getQuarterlyReport(auth, id);
}

export async function finalizeQuarterlyReport(auth: AuthenticatedUser, id: string, hrComments: string) {
  const [actor, report] = await Promise.all([getActor(auth), getReportOrThrow(id)]);
  if (!canFinalizeQuarterlyReport(accessContext(actor, report))) throw new HttpError(403, "Only HR or a super admin can finalize a manager-reviewed quarterly report");
  const monthlyReports = [report.monthlyReport1, report.monthlyReport2, report.monthlyReport3];
  if (monthlyReports.some((monthly) => !monthly || monthly.status !== "APPROVED")) throw new HttpError(400, "All three monthly reports must be approved before finalization");
  if (report.kpiScores.some((score) => score.kpi.unitType === "TEXT")) throw new HttpError(400, "Text KPIs require a scoring method before finalization");
  const totalWeight = calculateWeightTotal(report.kpiScores.map((score) => Number(score.weightageSnapshot)));
  if (!isWeightTotalValid(totalWeight)) throw new HttpError(400, `KPI weightage totals ${totalWeight}%. Final scoring requires 100%.`);
  const overallScore = calculateOverallScore(report.kpiScores.map((score) => ({ score: Number(score.score), weightage: Number(score.weightageSnapshot) })));
  const ranges = await prisma.performanceRatingRange.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  const rating = selectRating(overallScore, ranges.map((range) => ({ name: range.name, minScore: Number(range.minScore), maxScore: Number(range.maxScore), isActive: range.isActive })));
  if (!rating) throw new HttpError(400, `No active performance rating range covers score ${overallScore}`);
  await prisma.$transaction([
    prisma.quarterlyReport.update({ where: { id }, data: { status: "FINALIZED", overallScore, finalRating: rating, hrComments: hrComments || null, hrReviewedAt: new Date(), hrReviewedById: actor.id, finalizedAt: new Date() } }),
    prisma.quarterlyReportActionHistory.create({ data: { quarterlyReportId: id, action: "FINALIZED" as QuarterlyReportAction, performedByUserId: actor.id, comment: hrComments || null } })
  ]);
  return getQuarterlyReport(auth, id);
}
