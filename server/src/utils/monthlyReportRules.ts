import type { MonthlyReportStatus } from "@prisma/client";
import type { RoleName } from "../types/auth.js";

export type ReportAccessContext = {
  actorEmployeeId: string | null;
  roleName: RoleName;
  ownerEmployeeId: string;
  ownerManagerId: string | null;
  status: MonthlyReportStatus;
};

export function canViewMonthlyReport(context: ReportAccessContext) {
  if (context.actorEmployeeId === context.ownerEmployeeId) return true;
  if (context.roleName === "SUPER_ADMIN" || context.roleName === "HR_ADMIN") return true;
  if (context.roleName === "MANAGER" && context.actorEmployeeId === context.ownerManagerId) return true;
  return context.roleName === "AUDITOR" && ["SUBMITTED", "APPROVED"].includes(context.status);
}

export function canReviewMonthlyReport(context: ReportAccessContext) {
  if (context.status !== "SUBMITTED") return false;
  if (context.actorEmployeeId === context.ownerEmployeeId) return false;
  if (context.roleName === "SUPER_ADMIN" || context.roleName === "HR_ADMIN") return true;
  return context.roleName === "MANAGER" && context.actorEmployeeId === context.ownerManagerId;
}

export function canEditMonthlyReport(context: ReportAccessContext) {
  return (
    context.actorEmployeeId === context.ownerEmployeeId &&
    (context.status === "DRAFT" || context.status === "RETURNED")
  );
}

export function canSubmitMonthlyReport(context: ReportAccessContext) {
  return canEditMonthlyReport(context);
}

export function nextSubmitAction(status: MonthlyReportStatus) {
  if (status === "DRAFT") return "SUBMITTED" as const;
  if (status === "RETURNED") return "RESUBMITTED" as const;
  return null;
}

