import { z } from "zod";
import { actionStatuses, auditStatuses, capaStatuses } from "./auditRules.js";

const id = z.string().trim().min(1).max(100);
const text = z.string().trim().max(10000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date").refine((value) => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "Use a real calendar date");
const optionalDate = z.preprocess((value) => value === "" ? null : value, date.nullable().optional());
const optionalId = z.preprocess((value) => value === "" ? null : value, id.nullable().optional());
export const auditInputSchema = z.object({
  title: z.string().trim().min(3).max(250), organisation: z.string().trim().min(1).max(200), departmentId: id, auditorId: id,
  auditDate: optionalDate, scope: text.default(""), auditType: z.string().trim().min(1).max(100).default("INTERNAL"),
  location: z.string().trim().max(250).default(""), standardReference: z.string().trim().max(250).default("RBA"),
  teamMemberIds: z.array(id).max(30).default([])
});
export const auditUpdateSchema = auditInputSchema.partial();
export const findingInputSchema = z.object({
  rbaSection: z.string().trim().min(1).max(100), rbaReference: z.string().trim().min(1).max(1000),
  ratingCode: z.string().trim().min(1).max(50), description: text.min(1), departmentId: id,
  responsibleEmployeeId: optionalId, sourceModule: z.string().trim().max(100).nullable().optional(), sourceRecordId: optionalId
});
export const findingUpdateSchema = findingInputSchema.partial();
export const capaPlanSchema = z.object({
  rcaMethod: z.enum(["STANDARD", "FIVE_WHY"]).optional(), rootCause: text.optional(), problemStatement: text.optional(),
  why1: text.optional(), why2: text.optional(), why3: text.optional(), why4: text.optional(), why5: text.optional(), finalRootCause: text.optional(),
  containmentAction: text.optional(), correctiveAction: text.optional(), preventiveAction: text.optional(),
  responsibleEmployeeId: optionalId, dateEstablished: date.optional(), startDate: optionalDate, targetDate: optionalDate,
  implementationDays: z.union([z.literal(30), z.literal(60), z.literal(90)]).nullable().optional(),
  expectedUpdatedAt: z.string().datetime().optional()
});
export const actionInputSchema = z.object({
  actionType: z.enum(["CONTAINMENT", "CORRECTIVE", "PREVENTIVE"]), description: text.min(1),
  ownerEmployeeId: id, departmentId: id, startDate: date, targetDate: date, completionDate: optionalDate,
  status: z.enum(actionStatuses).optional(), comments: text.default("")
}).superRefine((input, ctx) => {
  if (input.targetDate < input.startDate) ctx.addIssue({ code: "custom", message: "Target date cannot be before start date" });
  if (input.completionDate && input.completionDate < input.startDate) ctx.addIssue({ code: "custom", message: "Completion date cannot be before start date" });
});
export const actionUpdateSchema = z.object({
  description: text.optional(), ownerEmployeeId: id.optional(), departmentId: id.optional(), startDate: date.optional(), targetDate: date.optional(),
  completionDate: optionalDate, status: z.enum(actionStatuses).optional(), comments: text.optional()
});
export const auditStatusSchema = z.object({ status: z.enum(auditStatuses), comment: text.default("") });
export const reviewSchema = z.object({
  decision: z.enum(["SUBMIT", "START_REVIEW", "ACCEPT", "RETURN", "REQUEST_VERIFICATION", "VERIFY", "REJECT_VERIFICATION"]), comment: text.default("")
});
export const commentSchema = z.object({ comment: text.min(1), findingId: id.optional() });
export const evidenceContextSchema = z.object({ findingId: optionalId, capaId: optionalId, actionItemId: optionalId, purpose: z.enum(["GENERAL", "VERIFICATION"]).default("GENERAL") });
export const evidenceReviewSchema = z.object({ reviewStatus: z.enum(["ACCEPTED", "REJECTED"]), comment: text.default("") });
export const ratingSchema = z.object({ code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,49}$/), label: z.string().trim().min(1).max(100), severity: z.coerce.number().int().min(0).max(1000).default(0), isActive: z.boolean().default(true) });
export const registerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(), departmentId: id.optional(), auditorId: id.optional(), responsibleEmployeeId: id.optional(),
  ratingCode: z.string().trim().max(50).optional(), status: z.string().trim().max(50).optional(),
  dateFrom: date.optional(), dateTo: date.optional(), view: z.enum(["ALL", "OPEN", "CLOSED", "OVERDUE"]).default("ALL")
}).superRefine((value, ctx) => {
  if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) ctx.addIssue({ code: "custom", message: "Date range is reversed" });
  if (value.status && ![...auditStatuses, ...capaStatuses].includes(value.status as typeof auditStatuses[number])) ctx.addIssue({ code: "custom", message: "Invalid status" });
});
export type AuditInput = z.infer<typeof auditInputSchema>;
export type FindingInput = z.infer<typeof findingInputSchema>;
export type CapaPlanInput = z.infer<typeof capaPlanSchema>;
export type ActionInput = z.infer<typeof actionInputSchema>;
export type RegisterQuery = z.infer<typeof registerQuerySchema>;
