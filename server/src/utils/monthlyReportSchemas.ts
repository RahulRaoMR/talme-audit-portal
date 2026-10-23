import { z } from "zod";

export const monthlyReportStatuses = ["DRAFT", "SUBMITTED", "RETURNED", "APPROVED"] as const;
export const monthlyReportScopes = ["mine", "review"] as const;

const currentYear = new Date().getFullYear();
const optionalText = z.string().trim().max(5000).optional().default("");
const optionalComment = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().trim().max(5000).nullable().optional()
);
const nonNegativeInteger = z.coerce.number().int().min(0).optional().default(0);
const optionalPercent = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.coerce.number().min(0).max(100).nullable().optional()
);

export const departmentDetailSchema = z
  .object({
    openPositions: nonNegativeInteger,
    positionsClosed: nonNegativeInteger,
    candidatesInterviewed: nonNegativeInteger,
    employeesOnboarded: nonNegativeInteger,
    documentsCompleted: nonNegativeInteger,
    documentsPending: nonNegativeInteger,
    employeeIssuesResolved: nonNegativeInteger,
    tasksAssigned: nonNegativeInteger,
    tasksCompleted: nonNegativeInteger,
    tasksPending: nonNegativeInteger,
    bugsAssigned: nonNegativeInteger,
    bugsResolved: nonNegativeInteger,
    projectsWorkedOn: nonNegativeInteger,
    deploymentsCompleted: nonNegativeInteger,
    onTimeDeliveryPercent: optionalPercent,
    employeesProcessed: nonNegativeInteger,
    payrollCompleted: nonNegativeInteger,
    payrollErrors: nonNegativeInteger,
    correctionsRequired: nonNegativeInteger,
    payslipsGenerated: nonNegativeInteger,
    payslipsPending: nonNegativeInteger,
    employeeQueries: nonNegativeInteger,
    queriesResolved: nonNegativeInteger,
    pfStatus: z.string().trim().max(120).optional().default(""),
    esiStatus: z.string().trim().max(120).optional().default(""),
    tdsStatus: z.string().trim().max(120).optional().default(""),
    remarks: optionalComment
  })
  .partial();

const reportContentFields = {
  summary: optionalText,
  achievements: optionalText,
  challenges: optionalText,
  pendingWork: optionalText,
  nextMonthPlan: optionalText,
  employeeComments: optionalComment,
  departmentDetail: departmentDetailSchema.optional().default({})
};

export const createMonthlyReportSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(currentYear - 2).max(currentYear + 2),
  ...reportContentFields
});

export const updateMonthlyReportSchema = z
  .object(reportContentFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one report field is required");

export const monthlyReportListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  scope: z.enum(monthlyReportScopes).default("mine"),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  departmentId: z.string().trim().min(1).optional(),
  employeeId: z.string().trim().min(1).optional(),
  status: z.enum(monthlyReportStatuses).optional()
});

export const monthlyReportIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Monthly report id is required")
});

export const monthlyReportAttachmentParamsSchema = monthlyReportIdParamsSchema.extend({
  attachmentId: z.string().trim().min(1, "Attachment id is required")
});

export const monthlyReportReviewSchema = z.object({
  comment: z.preprocess(
    (value) => (value === undefined || value === null ? "" : value),
    z.string().trim().max(5000)
  )
});

export const monthlyReportReturnSchema = monthlyReportReviewSchema.refine(
  (input) => input.comment.length > 0,
  { message: "A return comment is required" }
);

export type CreateMonthlyReportInput = z.infer<typeof createMonthlyReportSchema>;
export type UpdateMonthlyReportInput = z.infer<typeof updateMonthlyReportSchema>;
export type MonthlyReportListQuery = z.infer<typeof monthlyReportListQuerySchema>;
export type MonthlyReportReviewInput = z.infer<typeof monthlyReportReviewSchema>;

