import type { MonthlyReportStatus } from "../types/monthlyReport";

const styles: Record<MonthlyReportStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-50 text-blue-700",
  RETURNED: "bg-amber-50 text-amber-800",
  APPROVED: "bg-emerald-50 text-emerald-700"
};

export function MonthlyReportStatusBadge({ status }: { status: MonthlyReportStatus }) {
  return (
    <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${styles[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

