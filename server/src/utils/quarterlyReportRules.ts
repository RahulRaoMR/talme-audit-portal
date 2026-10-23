import type { Quarter, QuarterlyReportStatus } from "@prisma/client";
import type { RoleName } from "../types/auth.js";

export const quarterMonths: Record<Quarter, [number, number, number]> = {
  Q1: [1, 2, 3],
  Q2: [4, 5, 6],
  Q3: [7, 8, 9],
  Q4: [10, 11, 12]
};

export function getQuarterMonths(quarter: Quarter) {
  return quarterMonths[quarter];
}

export function getCurrentQuarter(date = new Date()): Quarter {
  return `Q${Math.floor(date.getMonth() / 3) + 1}` as Quarter;
}

export function calculateWeightedScore(score: number, weightage: number) {
  return Math.round((score * weightage) * 100 / 10000 * 100) / 100;
}

export function calculateOverallScore(scores: Array<{ score: number; weightage: number }>) {
  return Math.round(scores.reduce((total, item) => total + calculateWeightedScore(item.score, item.weightage), 0) * 100) / 100;
}

export function calculateWeightTotal(weights: number[]) {
  return Math.round(weights.reduce((total, weight) => total + weight, 0) * 100) / 100;
}

export function isWeightTotalValid(total: number) {
  return Math.abs(total - 100) < 0.005;
}

export function selectRating(
  score: number,
  ranges: Array<{ name: string; minScore: number; maxScore: number; isActive: boolean }>
) {
  return ranges.find((range) => range.isActive && score >= range.minScore && score <= range.maxScore)?.name ?? null;
}

export function kpiAppliesToDepartment(
  kpi: { isCommon: boolean; departmentId: string | null },
  departmentId: string
) {
  return kpi.isCommon || kpi.departmentId === departmentId;
}

export type QuarterlyAccessContext = {
  actorEmployeeId: string | null;
  roleName: RoleName;
  ownerEmployeeId: string;
  ownerManagerId: string | null;
  status: QuarterlyReportStatus;
};

export function canViewQuarterlyReport(context: QuarterlyAccessContext) {
  if (context.actorEmployeeId === context.ownerEmployeeId) return true;
  if (["SUPER_ADMIN", "HR_ADMIN"].includes(context.roleName)) return true;
  if (context.roleName === "MANAGER" && context.actorEmployeeId === context.ownerManagerId) {
    return context.status !== "DRAFT";
  }
  return context.roleName === "AUDITOR" && context.status === "FINALIZED";
}

export function canEditQuarterlyReport(context: QuarterlyAccessContext) {
  return context.actorEmployeeId === context.ownerEmployeeId && ["DRAFT", "RETURNED"].includes(context.status);
}

export function canManagerReviewQuarterlyReport(context: QuarterlyAccessContext) {
  if (context.status !== "SUBMITTED" || context.actorEmployeeId === context.ownerEmployeeId) return false;
  if (["SUPER_ADMIN", "HR_ADMIN"].includes(context.roleName)) return true;
  return context.roleName === "MANAGER" && context.actorEmployeeId === context.ownerManagerId;
}

export function canFinalizeQuarterlyReport(context: QuarterlyAccessContext) {
  return context.status === "MANAGER_REVIEWED" && ["SUPER_ADMIN", "HR_ADMIN"].includes(context.roleName);
}

