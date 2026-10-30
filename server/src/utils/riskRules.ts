import { calendarDay } from "./auditRules.js";

export const riskStatuses = ["OPEN", "MITIGATION_IN_PROGRESS", "MITIGATED", "ACCEPTED", "CLOSED"] as const;
export const riskColours = ["green", "amber", "orange", "red", "blue", "slate"] as const;
export type RiskLevel = { code: string; label: string; minScore: number; maxScore: number; colour: typeof riskColours[number] };
export const defaultRiskLevels: RiskLevel[] = [
  { code: "LOW", label: "Low", minScore: 1, maxScore: 4, colour: "green" },
  { code: "MEDIUM", label: "Medium", minScore: 5, maxScore: 9, colour: "amber" },
  { code: "HIGH", label: "High", minScore: 10, maxScore: 16, colour: "orange" },
  { code: "CRITICAL", label: "Critical", minScore: 17, maxScore: 25, colour: "red" }
];
export function riskBusinessDate(value = new Date()) { return new Date(calendarDay(value)).toISOString().slice(0, 10); }
export function riskScore(likelihood: number, severity: number) {
  if (![likelihood, severity].every((value) => Number.isInteger(value) && value >= 1 && value <= 5)) throw new Error("Likelihood and severity must be integers from 1 to 5");
  return likelihood * severity;
}
export function validRiskLevels(levels: RiskLevel[]) {
  const sorted = [...levels].sort((a, b) => a.minScore - b.minScore);
  return sorted.length >= 4 && sorted.length <= 8 && new Set(sorted.map((item) => item.code)).size === sorted.length
    && ["LOW", "MEDIUM", "HIGH", "CRITICAL"].every((code) => sorted.some((item) => item.code === code))
    && sorted[0]?.minScore === 1 && sorted.at(-1)?.maxScore === 25
    && sorted.every((item, index) => Number.isInteger(item.minScore) && Number.isInteger(item.maxScore) && item.minScore <= item.maxScore && (index === 0 || item.minScore === sorted[index - 1].maxScore + 1));
}
export function riskLevelFor(score: number | null, levels: RiskLevel[]) { return score === null ? null : levels.find((item) => score >= item.minScore && score <= item.maxScore) ?? null; }
export function riskMetrics(risk: { targetDate: Date | null; reviewDate: Date; completionDate: Date | null; status: string }, now = new Date()) {
  const today = calendarDay(now);
  const day = 86400000;
  const mitigationPending = !["MITIGATED", "ACCEPTED", "CLOSED"].includes(risk.status) && !risk.completionDate;
  const daysRemaining = risk.targetDate ? Math.round((new Date(risk.targetDate.toISOString().slice(0, 10)).getTime() - new Date(today).getTime()) / day) : null;
  return { isOverdue: mitigationPending && daysRemaining !== null && daysRemaining < 0, daysOverdue: mitigationPending && daysRemaining !== null ? Math.max(0, -daysRemaining) : 0, daysRemaining, dueForReview: risk.status !== "CLOSED" && risk.reviewDate.toISOString().slice(0, 10) <= riskBusinessDate(now) };
}
export function riskReadyForStatus(status: string, risk: { additionalMitigation: string; completionDate: Date | null; residualLikelihood: number | null; residualSeverity: number | null }) {
  const residual = risk.residualLikelihood !== null && risk.residualSeverity !== null;
  if (status === "MITIGATED" || status === "CLOSED") return Boolean(risk.additionalMitigation.trim() && risk.completionDate && residual);
  if (status === "ACCEPTED") return residual;
  return true;
}
