import { z } from "zod";

export const quarters = ["Q1", "Q2", "Q3", "Q4"] as const;
export const quarterlyStatuses = ["DRAFT", "SUBMITTED", "MANAGER_REVIEWED", "RETURNED", "FINALIZED"] as const;
export const kpiUnitTypes = ["NUMBER", "PERCENTAGE", "BOOLEAN", "RATING", "TEXT"] as const;
const currentYear = new Date().getFullYear();
const optionalText = z.string().trim().max(5000).optional().default("");
const nullableText = z.preprocess((value) => value === "" ? null : value, z.string().trim().max(5000).nullable().optional());

const quarterlyContent = {
  summary: optionalText,
  majorAchievements: optionalText,
  majorChallenges: optionalText,
  nextQuarterFocus: optionalText,
  employeeComments: nullableText
};

export const createQuarterlyReportSchema = z.object({
  quarter: z.enum(quarters),
  year: z.coerce.number().int().min(currentYear - 2).max(currentYear + 2),
  ...quarterlyContent
});

export const updateQuarterlyReportSchema = z.object(quarterlyContent).partial().refine(
  (input) => Object.keys(input).length > 0,
  "At least one report field is required"
);

export const quarterlyReportListQuerySchema = z.object({
  scope: z.enum(["mine", "review"]).default("mine"),
  quarter: z.enum(quarters).optional(),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  status: z.enum(quarterlyStatuses).optional(),
  departmentId: z.string().trim().min(1).optional(),
  employeeId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10)
});

export const quarterlyPreviewQuerySchema = z.object({
  quarter: z.enum(quarters),
  year: z.coerce.number().int().min(currentYear - 2).max(currentYear + 2)
});

export const quarterlyIdParamsSchema = z.object({ id: z.string().trim().min(1) });
export const reviewCommentSchema = z.object({ comment: z.string().trim().max(5000).default("") });
export const returnQuarterlySchema = z.object({ comment: z.string().trim().min(1, "A return comment is required").max(5000) });

export const managerReviewSchema = z.object({
  managerComments: z.string().trim().max(5000).optional().default(""),
  scores: z.array(z.object({
    kpiId: z.string().trim().min(1),
    targetValue: nullableText,
    actualValue: nullableText,
    score: z.coerce.number().min(0).max(100),
    managerComment: nullableText
  })).min(1, "At least one KPI score is required")
});

export const finalizeQuarterlySchema = z.object({ hrComments: z.string().trim().max(5000).optional().default("") });

const kpiFields = {
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9_]+$/).transform((value) => value.toUpperCase()),
  description: nullableText,
  departmentId: z.preprocess((value) => value === "" ? null : value, z.string().trim().min(1).nullable().optional()),
  isCommon: z.boolean(),
  unitType: z.enum(kpiUnitTypes),
  weightage: z.coerce.number().min(0).max(100),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(0)
};

export const createKpiSchema = z.object(kpiFields).superRefine((input, context) => {
  if (input.isCommon && input.departmentId) context.addIssue({ code: z.ZodIssueCode.custom, message: "Common KPIs cannot have a department", path: ["departmentId"] });
  if (!input.isCommon && !input.departmentId) context.addIssue({ code: z.ZodIssueCode.custom, message: "Department-specific KPIs require a department", path: ["departmentId"] });
});

export const updateKpiSchema = z.object(kpiFields).partial().refine(
  (input) => Object.keys(input).length > 0,
  "At least one KPI field is required"
);
export const updateKpiStatusSchema = z.object({ isActive: z.boolean() });

export const ratingRangeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  minScore: z.coerce.number().min(0).max(100),
  maxScore: z.coerce.number().min(0).max(100),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(0)
}).refine((input) => input.minScore <= input.maxScore, { message: "Minimum score cannot exceed maximum score" });

export type CreateQuarterlyReportInput = z.infer<typeof createQuarterlyReportSchema>;
export type UpdateQuarterlyReportInput = z.infer<typeof updateQuarterlyReportSchema>;
export type QuarterlyReportListQuery = z.infer<typeof quarterlyReportListQuerySchema>;
export type QuarterlyPreviewQuery = z.infer<typeof quarterlyPreviewQuerySchema>;
export type ManagerReviewInput = z.infer<typeof managerReviewSchema>;
export type CreateKpiInput = z.infer<typeof createKpiSchema>;
export type UpdateKpiInput = z.infer<typeof updateKpiSchema>;
export type RatingRangeInput = z.infer<typeof ratingRangeSchema>;
