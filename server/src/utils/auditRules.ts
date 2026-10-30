export const auditStatuses = ["DRAFT", "SCHEDULED", "IN_PROGRESS", "AUDIT_COMPLETED", "FINDINGS_ISSUED", "CAPA_PENDING", "CAPA_UNDER_REVIEW", "VERIFICATION_PENDING", "CLOSED", "CANCELLED"] as const;
export const capaStatuses = ["OPEN", "RCA_PENDING", "PREPARATION", "SUBMITTED", "UNDER_REVIEW", "ACTION_IN_PROGRESS", "VERIFICATION_PENDING", "VERIFIED", "CLOSED", "RETURNED"] as const;
export const actionStatuses = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "VERIFICATION_PENDING", "VERIFIED", "REJECTED"] as const;
export const editablePlanStatuses = ["OPEN", "RCA_PENDING", "PREPARATION", "RETURNED"] as const;
export const adminRoles = ["HR_ADMIN", "SUPER_ADMIN"] as const;

const dayMilliseconds = 86400000;
export function calendarDay(value: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (name: string) => Number(parts.find((item) => item.type === name)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"));
}
export function addDays(value: Date, days: number): Date { return new Date(value.getTime() + days * dayMilliseconds); }
export function dueMetrics(target: Date | string | null, created: Date | string, status: string, now = new Date(), resolvedAt?: Date | string | null) {
  const today = calendarDay(now);
  const targetDay = target ? Date.parse(new Date(target).toISOString().slice(0, 10)) : null;
  const terminal = ["CLOSED", "VERIFIED", "COMPLETED", "CANCELLED"].includes(status);
  const daysRemaining = targetDay === null ? null : Math.round((targetDay - today) / dayMilliseconds);
  const ageingEnd = terminal && resolvedAt ? Math.min(today, calendarDay(new Date(resolvedAt))) : today;
  return {
    isResolved: terminal,
    isOverdue: !terminal && daysRemaining !== null && daysRemaining < 0,
    daysRemaining,
    daysOverdue: !terminal && daysRemaining !== null ? Math.max(0, -daysRemaining) : 0,
    ageingDays: Math.max(0, Math.floor((ageingEnd - calendarDay(new Date(created))) / dayMilliseconds))
  };
}

export function canTransitionAudit(from: string, to: string, admin = false) {
  if (to === "CANCELLED") return !["CLOSED", "CANCELLED"].includes(from);
  if (from === "CLOSED") return admin && to === "IN_PROGRESS";
  const transitions: Record<string, string[]> = {
    DRAFT: ["SCHEDULED", "IN_PROGRESS"], SCHEDULED: ["IN_PROGRESS"], IN_PROGRESS: ["AUDIT_COMPLETED"],
    AUDIT_COMPLETED: ["FINDINGS_ISSUED", "CLOSED"], FINDINGS_ISSUED: ["CAPA_PENDING"],
    CAPA_PENDING: ["CAPA_UNDER_REVIEW", "VERIFICATION_PENDING", "CLOSED"],
    CAPA_UNDER_REVIEW: ["CAPA_PENDING", "VERIFICATION_PENDING", "CLOSED"], VERIFICATION_PENDING: ["CAPA_PENDING", "CAPA_UNDER_REVIEW", "CLOSED"]
  };
  return transitions[from]?.includes(to) ?? false;
}

export function planIsComplete(capa: { rcaMethod: string; rootCause: string; problemStatement: string; why1: string; why2: string; why3: string; why4: string; why5: string; finalRootCause: string; targetDate: Date | null; correctiveAction: string; preventiveAction: string; actions: { actionType: string }[] }, owner: string | null) {
  const rca = capa.rcaMethod === "FIVE_WHY"
    ? [capa.problemStatement, capa.why1, capa.why2, capa.why3, capa.why4, capa.why5, capa.finalRootCause].every((value) => value.trim())
    : Boolean(capa.rootCause.trim());
  return Boolean(owner && capa.targetDate && rca && capa.correctiveAction.trim() && capa.preventiveAction.trim() && capa.actions.some((item) => item.actionType === "CORRECTIVE") && capa.actions.some((item) => item.actionType === "PREVENTIVE"));
}
export function actionsReadyForVerification(actions: { status: string }[]) {
  return actions.length > 0 && actions.every((item) => ["COMPLETED", "VERIFICATION_PENDING", "VERIFIED"].includes(item.status));
}
export function actionsVerified(actions: { status: string }[]) { return actions.length > 0 && actions.every((item) => item.status === "VERIFIED"); }
