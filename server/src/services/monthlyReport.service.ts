import { unlink } from "node:fs/promises";
import path from "node:path";
import type { MonthlyReportAction, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { monthlyReportUploadDirectory } from "../config/monthlyReportUpload.js";
import type { AuthenticatedUser } from "../types/auth.js";
import type {
  CreateMonthlyReportInput,
  MonthlyReportListQuery,
  UpdateMonthlyReportInput
} from "../utils/monthlyReportSchemas.js";
import {
  canEditMonthlyReport,
  canReviewMonthlyReport,
  canSubmitMonthlyReport,
  canViewMonthlyReport,
  nextSubmitAction
} from "../utils/monthlyReportRules.js";
import { HttpError } from "../utils/httpError.js";

const reportListSelect = {
  id: true,
  month: true,
  year: true,
  reportPeriod: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      department: { select: { id: true, name: true, code: true } },
      managerId: true
    }
  },
  _count: { select: { attachments: true } }
} satisfies Prisma.MonthlyReportSelect;

const reportDetailInclude = {
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
  reviewedBy: {
    select: {
      id: true,
      email: true,
      employee: { select: { firstName: true, lastName: true } }
    }
  },
  hrDetail: true,
  developerDetail: true,
  payrollDetail: true,
  attachments: {
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      size: true,
      createdAt: true,
      uploadedById: true
    },
    orderBy: { createdAt: "desc" as const }
  },
  history: {
    select: {
      id: true,
      action: true,
      comment: true,
      createdAt: true,
      performedByUser: {
        select: {
          id: true,
          email: true,
          employee: { select: { firstName: true, lastName: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" as const }
  }
} satisfies Prisma.MonthlyReportInclude;

type ReportWithDetails = Prisma.MonthlyReportGetPayload<{ include: typeof reportDetailInclude }>;
type DepartmentDetail = NonNullable<CreateMonthlyReportInput["departmentDetail"]>;

async function getActor(auth: AuthenticatedUser) {
  const actor = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, employeeId: true, role: { select: { name: true } } }
  });

  if (!actor) throw new HttpError(401, "User account no longer exists");
  return { ...actor, roleName: auth.roleName };
}

function accessContext(actor: Awaited<ReturnType<typeof getActor>>, report: ReportWithDetails) {
  return {
    actorEmployeeId: actor.employeeId,
    roleName: actor.roleName,
    ownerEmployeeId: report.employeeId,
    ownerManagerId: report.employee.managerId,
    status: report.status
  };
}

async function getReportOrThrow(id: string) {
  const report = await prisma.monthlyReport.findUnique({
    where: { id },
    include: reportDetailInclude
  });
  if (!report) throw new HttpError(404, "Monthly report not found");
  return report;
}

function reportPeriod(month: number, year: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

function commonData(input: CreateMonthlyReportInput | UpdateMonthlyReportInput) {
  return {
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
    ...(input.achievements !== undefined ? { achievements: input.achievements } : {}),
    ...(input.challenges !== undefined ? { challenges: input.challenges } : {}),
    ...(input.pendingWork !== undefined ? { pendingWork: input.pendingWork } : {}),
    ...(input.nextMonthPlan !== undefined ? { nextMonthPlan: input.nextMonthPlan } : {}),
    ...(input.employeeComments !== undefined ? { employeeComments: input.employeeComments } : {})
  };
}

function integer(detail: DepartmentDetail, key: keyof DepartmentDetail) {
  const value = detail[key];
  return typeof value === "number" ? value : 0;
}

function detailData(code: string, detail: DepartmentDetail) {
  if (code === "HR") {
    return {
      openPositions: integer(detail, "openPositions"),
      positionsClosed: integer(detail, "positionsClosed"),
      candidatesInterviewed: integer(detail, "candidatesInterviewed"),
      employeesOnboarded: integer(detail, "employeesOnboarded"),
      documentsCompleted: integer(detail, "documentsCompleted"),
      documentsPending: integer(detail, "documentsPending"),
      employeeIssuesResolved: integer(detail, "employeeIssuesResolved"),
      remarks: detail.remarks ?? null
    };
  }

  if (code === "DEV") {
    return {
      tasksAssigned: integer(detail, "tasksAssigned"),
      tasksCompleted: integer(detail, "tasksCompleted"),
      tasksPending: integer(detail, "tasksPending"),
      bugsAssigned: integer(detail, "bugsAssigned"),
      bugsResolved: integer(detail, "bugsResolved"),
      projectsWorkedOn: integer(detail, "projectsWorkedOn"),
      deploymentsCompleted: integer(detail, "deploymentsCompleted"),
      onTimeDeliveryPercent:
        typeof detail.onTimeDeliveryPercent === "number" ? detail.onTimeDeliveryPercent : null,
      remarks: detail.remarks ?? null
    };
  }

  if (code === "PAY") {
    return {
      employeesProcessed: integer(detail, "employeesProcessed"),
      payrollCompleted: integer(detail, "payrollCompleted"),
      payrollErrors: integer(detail, "payrollErrors"),
      correctionsRequired: integer(detail, "correctionsRequired"),
      payslipsGenerated: integer(detail, "payslipsGenerated"),
      payslipsPending: integer(detail, "payslipsPending"),
      employeeQueries: integer(detail, "employeeQueries"),
      queriesResolved: integer(detail, "queriesResolved"),
      pfStatus: detail.pfStatus ?? "",
      esiStatus: detail.esiStatus ?? "",
      tdsStatus: detail.tdsStatus ?? "",
      remarks: detail.remarks ?? null
    };
  }

  throw new HttpError(400, "Monthly reports are not configured for this department");
}

async function writeDepartmentDetail(
  transaction: Prisma.TransactionClient,
  code: string,
  monthlyReportId: string,
  detail: DepartmentDetail,
  create: boolean
) {
  const data = detailData(code, detail);
  if (code === "HR") {
    const hrData = data as Prisma.HrMonthlyReportDetailUpdateInput;
    if (create) {
      await transaction.hrMonthlyReportDetail.create({
        data: {
          monthlyReportId,
          ...(hrData as Omit<Prisma.HrMonthlyReportDetailUncheckedCreateInput, "id" | "monthlyReportId">)
        }
      });
    } else await transaction.hrMonthlyReportDetail.update({ where: { monthlyReportId }, data: hrData });
  } else if (code === "DEV") {
    const developerData = data as Prisma.DeveloperMonthlyReportDetailUpdateInput;
    if (create) {
      await transaction.developerMonthlyReportDetail.create({
        data: {
          monthlyReportId,
          ...(developerData as Omit<
            Prisma.DeveloperMonthlyReportDetailUncheckedCreateInput,
            "id" | "monthlyReportId"
          >)
        }
      });
    } else {
      await transaction.developerMonthlyReportDetail.update({
        where: { monthlyReportId },
        data: developerData
      });
    }
  } else if (code === "PAY") {
    const payrollData = data as Prisma.PayrollMonthlyReportDetailUpdateInput;
    if (create) {
      await transaction.payrollMonthlyReportDetail.create({
        data: {
          monthlyReportId,
          ...(payrollData as Omit<
            Prisma.PayrollMonthlyReportDetailUncheckedCreateInput,
            "id" | "monthlyReportId"
          >)
        }
      });
    } else {
      await transaction.payrollMonthlyReportDetail.update({
        where: { monthlyReportId },
        data: payrollData
      });
    }
  }
}

export async function listMonthlyReports(auth: AuthenticatedUser, query: MonthlyReportListQuery) {
  const actor = await getActor(auth);
  let accessWhere: Prisma.MonthlyReportWhereInput;

  if (query.scope === "mine") {
    if (!actor.employeeId) throw new HttpError(403, "Your account is not linked to an employee");
    accessWhere = { employeeId: actor.employeeId };
  } else if (actor.roleName === "MANAGER") {
    if (!actor.employeeId) throw new HttpError(403, "Your account is not linked to an employee");
    accessWhere = {
      employee: { managerId: actor.employeeId },
      status: { in: ["SUBMITTED", "RETURNED", "APPROVED"] }
    };
  } else if (actor.roleName === "HR_ADMIN" || actor.roleName === "SUPER_ADMIN") {
    accessWhere = {};
  } else if (actor.roleName === "AUDITOR") {
    accessWhere = { status: { in: ["SUBMITTED", "APPROVED"] } };
  } else {
    throw new HttpError(403, "You do not have permission to review monthly reports");
  }

  const where: Prisma.MonthlyReportWhereInput = {
    AND: [
      accessWhere,
      query.month ? { month: query.month } : {},
      query.year ? { year: query.year } : {},
      query.status ? { status: query.status } : {},
      query.employeeId ? { employeeId: query.employeeId } : {},
      query.departmentId ? { employee: { departmentId: query.departmentId } } : {}
    ]
  };

  const employeeAccessWhere: Prisma.EmployeeWhereInput = query.scope === "mine"
    ? { id: actor.employeeId ?? "" }
    : actor.roleName === "MANAGER"
      ? { managerId: actor.employeeId ?? "" }
      : {};

  const [reports, total, departments, employees] = await prisma.$transaction([
    prisma.monthlyReport.findMany({
      where,
      select: reportListSelect,
      orderBy: [{ year: "desc" }, { month: "desc" }, { updatedAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    prisma.monthlyReport.count({ where }),
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.employee.findMany({
      where: employeeAccessWhere,
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 200
    })
  ]);

  return {
    reports,
    departments,
    employees,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize))
    }
  };
}

export async function getCurrentMonthlyReport(auth: AuthenticatedUser) {
  const actor = await getActor(auth);
  if (!actor.employeeId) return null;
  const now = new Date();
  return prisma.monthlyReport.findUnique({
    where: {
      employeeId_month_year: {
        employeeId: actor.employeeId,
        month: now.getMonth() + 1,
        year: now.getFullYear()
      }
    },
    select: reportListSelect
  });
}

export async function getMonthlyReport(auth: AuthenticatedUser, id: string) {
  const [actor, report] = await Promise.all([getActor(auth), getReportOrThrow(id)]);
  if (!canViewMonthlyReport(accessContext(actor, report))) {
    throw new HttpError(403, "You do not have permission to view this monthly report");
  }
  return report;
}

export async function createMonthlyReport(auth: AuthenticatedUser, input: CreateMonthlyReportInput) {
  const actor = await getActor(auth);
  if (!actor.employeeId) throw new HttpError(403, "Your account is not linked to an employee");

  const employee = await prisma.employee.findUnique({
    where: { id: actor.employeeId },
    select: { department: { select: { code: true } } }
  });
  if (!employee) throw new HttpError(403, "Your employee record no longer exists");

  const duplicate = await prisma.monthlyReport.findUnique({
    where: { employeeId_month_year: { employeeId: actor.employeeId, month: input.month, year: input.year } },
    select: { id: true }
  });
  if (duplicate) throw new HttpError(409, "A monthly report for this period already exists.");

  const id = await prisma.$transaction(async (transaction) => {
    const report = await transaction.monthlyReport.create({
      data: {
        employeeId: actor.employeeId!,
        month: input.month,
        year: input.year,
        reportPeriod: reportPeriod(input.month, input.year),
        summary: input.summary,
        achievements: input.achievements,
        challenges: input.challenges,
        pendingWork: input.pendingWork,
        nextMonthPlan: input.nextMonthPlan,
        employeeComments: input.employeeComments
      }
    });
    await writeDepartmentDetail(
      transaction,
      employee.department.code,
      report.id,
      input.departmentDetail,
      true
    );
    await transaction.monthlyReportActionHistory.create({
      data: { monthlyReportId: report.id, action: "CREATED", performedByUserId: actor.id }
    });
    return report.id;
  });

  return getReportOrThrow(id);
}

export async function updateMonthlyReport(
  auth: AuthenticatedUser,
  id: string,
  input: UpdateMonthlyReportInput
) {
  const [actor, report] = await Promise.all([getActor(auth), getReportOrThrow(id)]);
  if (!canEditMonthlyReport(accessContext(actor, report))) {
    throw new HttpError(403, "Only the owner can edit a draft or returned monthly report");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.monthlyReport.update({ where: { id }, data: commonData(input) });
    if (input.departmentDetail) {
      await writeDepartmentDetail(
        transaction,
        report.employee.department.code,
        id,
        input.departmentDetail,
        false
      );
    }
    await transaction.monthlyReportActionHistory.create({
      data: { monthlyReportId: id, action: "UPDATED", performedByUserId: actor.id }
    });
  });

  return getReportOrThrow(id);
}

function validateForSubmission(report: ReportWithDetails) {
  const required = [
    ["summary", report.summary],
    ["achievements", report.achievements],
    ["challenges", report.challenges],
    ["pending work", report.pendingWork],
    ["next month plan", report.nextMonthPlan]
  ] as const;
  const missing = required.find(([, value]) => !value.trim());
  if (missing) throw new HttpError(400, `${missing[0]} is required before submission`);
  if (report.attachments.length === 0) {
    throw new HttpError(400, "Upload at least one supporting file before submission");
  }
  if (report.employee.department.code === "PAY") {
    const payroll = report.payrollDetail;
    if (!payroll || !payroll.pfStatus.trim() || !payroll.esiStatus.trim() || !payroll.tdsStatus.trim()) {
      throw new HttpError(400, "PF, ESI, and TDS statuses are required before submission");
    }
  }
}

export async function submitMonthlyReport(auth: AuthenticatedUser, id: string) {
  const [actor, report] = await Promise.all([getActor(auth), getReportOrThrow(id)]);
  if (!canSubmitMonthlyReport(accessContext(actor, report))) {
    throw new HttpError(403, "Only the owner can submit a draft or returned monthly report");
  }
  validateForSubmission(report);
  const action = nextSubmitAction(report.status);
  if (!action) throw new HttpError(409, "This monthly report cannot be submitted from its current status");

  await prisma.$transaction([
    prisma.monthlyReport.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date(), reviewedAt: null, reviewedById: null }
    }),
    prisma.monthlyReportActionHistory.create({
      data: { monthlyReportId: id, action, performedByUserId: actor.id }
    })
  ]);
  return getReportOrThrow(id);
}

async function reviewMonthlyReport(
  auth: AuthenticatedUser,
  id: string,
  decision: "APPROVED" | "RETURNED",
  comment: string
) {
  const [actor, report] = await Promise.all([getActor(auth), getReportOrThrow(id)]);
  if (!canReviewMonthlyReport(accessContext(actor, report))) {
    throw new HttpError(403, "You do not have permission to review this submitted report");
  }

  await prisma.$transaction([
    prisma.monthlyReport.update({
      where: { id },
      data: {
        status: decision,
        managerComments: comment || null,
        reviewedAt: new Date(),
        reviewedById: actor.id
      }
    }),
    prisma.monthlyReportActionHistory.create({
      data: {
        monthlyReportId: id,
        action: decision as MonthlyReportAction,
        performedByUserId: actor.id,
        comment: comment || null
      }
    })
  ]);
  return getReportOrThrow(id);
}

export function approveMonthlyReport(auth: AuthenticatedUser, id: string, comment: string) {
  return reviewMonthlyReport(auth, id, "APPROVED", comment);
}

export function returnMonthlyReport(auth: AuthenticatedUser, id: string, comment: string) {
  return reviewMonthlyReport(auth, id, "RETURNED", comment);
}

export async function addMonthlyReportAttachments(
  auth: AuthenticatedUser,
  id: string,
  files: Express.Multer.File[]
) {
  if (files.length === 0) throw new HttpError(400, "Select at least one file to upload");
  const cleanUploadedFiles = () =>
    Promise.all(files.map((file) => unlink(file.path).catch(() => undefined)));
  const [actor, report] = await Promise.all([getActor(auth), getReportOrThrow(id)]).catch(
    async (error) => {
      await cleanUploadedFiles();
      throw error;
    }
  );
  if (!canEditMonthlyReport(accessContext(actor, report))) {
    await cleanUploadedFiles();
    throw new HttpError(403, "Attachments can only be changed on your draft or returned report");
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.monthlyReportAttachment.createMany({
        data: files.map((file) => ({
          monthlyReportId: id,
          originalName: path.basename(file.originalname),
          storedName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          uploadedById: actor.id
        }))
      });
      await transaction.monthlyReportActionHistory.create({
        data: {
          monthlyReportId: id,
          action: "ATTACHMENT_ADDED",
          performedByUserId: actor.id,
          comment: `${files.length} file${files.length === 1 ? "" : "s"} uploaded`
        }
      });
    });
  } catch (error) {
    await cleanUploadedFiles();
    throw error;
  }

  return getReportOrThrow(id);
}

export async function getMonthlyReportAttachment(
  auth: AuthenticatedUser,
  id: string,
  attachmentId: string
) {
  const report = await getMonthlyReport(auth, id);
  const attachment = await prisma.monthlyReportAttachment.findFirst({
    where: { id: attachmentId, monthlyReportId: report.id }
  });
  if (!attachment) throw new HttpError(404, "Attachment not found");

  const filePath = path.resolve(monthlyReportUploadDirectory, attachment.storedName);
  if (!filePath.startsWith(`${monthlyReportUploadDirectory}${path.sep}`)) {
    throw new HttpError(400, "Invalid attachment path");
  }
  return { attachment, filePath };
}

export async function removeMonthlyReportAttachment(
  auth: AuthenticatedUser,
  id: string,
  attachmentId: string
) {
  const [actor, report] = await Promise.all([getActor(auth), getReportOrThrow(id)]);
  if (!canEditMonthlyReport(accessContext(actor, report))) {
    throw new HttpError(403, "Attachments can only be changed on your draft or returned report");
  }
  const attachment = await prisma.monthlyReportAttachment.findFirst({
    where: { id: attachmentId, monthlyReportId: id }
  });
  if (!attachment) throw new HttpError(404, "Attachment not found");

  await prisma.$transaction([
    prisma.monthlyReportAttachment.delete({ where: { id: attachment.id } }),
    prisma.monthlyReportActionHistory.create({
      data: {
        monthlyReportId: id,
        action: "ATTACHMENT_REMOVED",
        performedByUserId: actor.id,
        comment: attachment.originalName
      }
    })
  ]);
  await unlink(path.resolve(monthlyReportUploadDirectory, attachment.storedName)).catch(() => undefined);
  return getReportOrThrow(id);
}
