import { z } from "zod";
import { riskColours, riskStatuses, validRiskLevels } from "./riskRules.js";
const id = z.string().trim().min(1).max(100);
const text = z.string().trim().max(10000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((value) => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "Select a valid date");
const score = z.number().int().min(1).max(5);
const fields = {
  title: z.string().trim().min(3).max(250), description: text.min(5), departmentId: id,
  processActivity: z.string().trim().min(1).max(250), category: z.string().trim().min(1).max(100),
  hazardSource: text.default(""), potentialConsequence: text.default(""), existingControls: text.default(""),
  likelihood: score, severity: score, additionalMitigation: text.default(""), responsibleEmployeeId: id,
  targetDate: date.nullable().default(null), completionDate: date.nullable().default(null),
  residualLikelihood: score.nullable().default(null), residualSeverity: score.nullable().default(null),
  reviewDate: date, comments: text.default(""), auditId: id.nullable().default(null), findingId: id.nullable().default(null), capaId: id.nullable().default(null)
};
export const riskInputSchema = z.object(fields).strict();
export const riskUpdateSchema = z.object(fields).partial().extend({ expectedUpdatedAt: z.string().datetime({ offset: true }), status: z.enum(riskStatuses).optional() }).strict();
export const riskReviewSchema = z.object({ expectedUpdatedAt: z.string().datetime({ offset: true }), nextReviewDate: date, comment: text.min(3) }).strict();
export const riskDecisionSchema = z.object({ expectedUpdatedAt: z.string().datetime({ offset: true }), comment: text.min(3) }).strict();
export const riskCommentSchema = z.object({ comment: text.min(1) }).strict();
export const riskQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(250).optional(), departmentId: id.optional(), responsibleEmployeeId: id.optional(),
  level: z.string().max(50).optional(), status: z.enum(riskStatuses).optional(), category: z.string().max(100).optional(),
  reviewFrom: date.optional(), reviewTo: date.optional(), view: z.enum(["ALL", "OVERDUE", "REVIEW_DUE", "OPEN"]).optional(),
  auditId: id.optional(), findingId: id.optional(), capaId: id.optional()
}).refine((input) => !input.reviewFrom || !input.reviewTo || input.reviewFrom <= input.reviewTo, { message: "Review-date range is reversed", path: ["reviewTo"] });
export const riskLevelSchema = z.object({ code: z.string().regex(/^[A-Z][A-Z0-9_]{0,29}$/), label: z.string().trim().min(1).max(50), minScore: z.number().int().min(1).max(25), maxScore: z.number().int().min(1).max(25), colour: z.enum(riskColours) }).strict();
export const riskConfigurationSchema = z.object({ expectedVersion: z.number().int().min(1), levels: z.array(riskLevelSchema).min(4).max(8).refine(validRiskLevels, "Bands must uniquely cover scores 1–25 without gaps/overlaps and retain LOW, MEDIUM, HIGH, CRITICAL"), comment: text.min(3) }).strict();
export type RiskInput = z.infer<typeof riskInputSchema>;
export type RiskUpdate = z.infer<typeof riskUpdateSchema>;
export type RiskQuery = z.infer<typeof riskQuerySchema>;
