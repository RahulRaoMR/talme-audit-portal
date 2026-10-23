import type { QuarterlyStatus } from "../types/quarterlyReport";

const styles: Record<QuarterlyStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-50 text-blue-700",
  MANAGER_REVIEWED: "bg-cyan-50 text-cyan-800",
  RETURNED: "bg-amber-50 text-amber-800",
  FINALIZED: "bg-emerald-50 text-emerald-700"
};

export function QuarterlyStatusBadge({ status }: { status: QuarterlyStatus }) {
  return <span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${styles[status]}`}>{status.replace(/_/g, " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}</span>;
}

