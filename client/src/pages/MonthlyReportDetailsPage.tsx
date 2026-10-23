import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, Pencil, RotateCcw } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { MonthlyReportStatusBadge } from "../components/MonthlyReportStatusBadge";
import { useAuth } from "../hooks/useAuth";
import {
  approveMonthlyReport,
  downloadMonthlyReportAttachment,
  fetchMonthlyReport,
  returnMonthlyReport
} from "../services/monthlyReport.service";
import type { MonthlyReport } from "../types/monthlyReport";

const commonLabels: Array<[keyof MonthlyReport, string]> = [
  ["summary", "Work Summary"],
  ["achievements", "Key Achievements"],
  ["challenges", "Challenges"],
  ["pendingWork", "Pending Work"],
  ["nextMonthPlan", "Next Month Plan"],
  ["employeeComments", "Additional Comments"]
];

const detailLabels: Record<string, Record<string, string>> = {
  HR: { openPositions: "Open Positions", positionsClosed: "Positions Closed", candidatesInterviewed: "Candidates Interviewed", employeesOnboarded: "Employees Onboarded", documentsCompleted: "Documents Completed", documentsPending: "Documents Pending", employeeIssuesResolved: "Employee Issues Resolved", remarks: "Remarks" },
  DEV: { tasksAssigned: "Tasks Assigned", tasksCompleted: "Tasks Completed", tasksPending: "Tasks Pending", bugsAssigned: "Bugs Assigned", bugsResolved: "Bugs Resolved", projectsWorkedOn: "Projects Worked On", deploymentsCompleted: "Deployments Completed", onTimeDeliveryPercent: "On-time Delivery (%)", remarks: "Remarks" },
  PAY: { employeesProcessed: "Employees Processed", payrollCompleted: "Payroll Runs Completed", payrollErrors: "Payroll Errors", correctionsRequired: "Corrections Required", payslipsGenerated: "Payslips Generated", payslipsPending: "Payslips Pending", employeeQueries: "Employee Queries", queriesResolved: "Queries Resolved", pfStatus: "PF Status", esiStatus: "ESI Status", tdsStatus: "TDS Status", remarks: "Remarks" }
};

function actorName(action: MonthlyReport["history"][number]) {
  const employee = action.performedByUser.employee;
  return employee ? `${employee.firstName} ${employee.lastName}` : action.performedByUser.email;
}

export function MonthlyReportDetailsPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    fetchMonthlyReport(id)
      .then(({ report: loaded }) => setReport(loaded))
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "Unable to load report"));
  }, [id]);

  async function review(decision: "approve" | "return") {
    if (!report) return;
    try {
      setIsWorking(true);
      setError("");
      const response = decision === "approve"
        ? await approveMonthlyReport(report.id, comment)
        : await returnMonthlyReport(report.id, comment);
      setReport(response.report);
      setComment("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to review report");
    } finally {
      setIsWorking(false);
    }
  }

  if (!report) return <p className="text-sm text-slate-600">{error || "Loading monthly report..."}</p>;

  const isOwner = user?.employee?.id === report.employee.id;
  const canEdit = isOwner && ["DRAFT", "RETURNED"].includes(report.status);
  const canReview = report.status === "SUBMITTED" && !isOwner && (
    ["SUPER_ADMIN", "HR_ADMIN"].includes(user?.role.name ?? "") ||
    (user?.role.name === "MANAGER" && user.employee?.id === report.employee.managerId)
  );
  const detail = report.hrDetail ?? report.developerDetail ?? report.payrollDetail;
  const labels = detailLabels[report.employee.department.code] ?? {};
  const backPath = isOwner ? "/monthly-reports" : "/monthly-reports/review";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950" to={backPath}><ArrowLeft className="h-4 w-4" /> Back to reports</Link>
          <div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold text-slate-950">{report.reportPeriod}</h1><MonthlyReportStatusBadge status={report.status} /></div>
          <p className="mt-1 text-sm text-slate-500">{report.employee.firstName} {report.employee.lastName} · {report.employee.employeeCode} · {report.employee.department.name}</p>
        </div>
        {canEdit ? <Link className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600" to={`/monthly-reports/${report.id}/edit`}><Pencil className="h-4 w-4" /> Edit Report</Link> : null}
      </header>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {report.status === "RETURNED" && report.managerComments ? <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Returned for changes:</strong> {report.managerComments}</p> : null}

      <section className="border-y border-slate-200 bg-white sm:rounded-md sm:border">
        <dl className="grid sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-b border-slate-100 px-5 py-4"><dt className="text-xs font-semibold uppercase text-slate-500">Designation</dt><dd className="mt-1.5 text-sm font-medium text-slate-950">{report.employee.designation}</dd></div>
          <div className="border-b border-slate-100 px-5 py-4"><dt className="text-xs font-semibold uppercase text-slate-500">Submitted</dt><dd className="mt-1.5 text-sm font-medium text-slate-950">{report.submittedAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(report.submittedAt)) : "Not submitted"}</dd></div>
          <div className="border-b border-slate-100 px-5 py-4"><dt className="text-xs font-semibold uppercase text-slate-500">Reviewed</dt><dd className="mt-1.5 text-sm font-medium text-slate-950">{report.reviewedAt ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(report.reviewedAt)) : "Not reviewed"}</dd></div>
          <div className="border-b border-slate-100 px-5 py-4"><dt className="text-xs font-semibold uppercase text-slate-500">Reviewed By</dt><dd className="mt-1.5 text-sm font-medium text-slate-950">{report.reviewedBy?.employee ? `${report.reviewedBy.employee.firstName} ${report.reviewedBy.employee.lastName}` : report.reviewedBy?.email ?? "Not reviewed"}</dd></div>
        </dl>
      </section>

      <section className="border-y border-slate-200 bg-white sm:rounded-md sm:border">
        <h2 className="border-b border-slate-200 px-5 py-4 text-base font-bold text-slate-950">Monthly Work</h2>
        <dl className="grid lg:grid-cols-2">
          {commonLabels.map(([key, label]) => <div className="border-b border-slate-100 px-5 py-4" key={key}><dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt><dd className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{String(report[key] || "Not provided")}</dd></div>)}
        </dl>
      </section>

      <section className="border-y border-slate-200 bg-white sm:rounded-md sm:border">
        <h2 className="border-b border-slate-200 px-5 py-4 text-base font-bold text-slate-950">{report.employee.department.name} Metrics</h2>
        <dl className="grid sm:grid-cols-2 lg:grid-cols-4">
          {detail ? Object.entries(detail).filter(([key]) => key !== "id" && key !== "monthlyReportId").map(([key, value]) => <div className="border-b border-slate-100 px-5 py-4" key={key}><dt className="text-xs font-semibold uppercase text-slate-500">{labels[key] ?? key}</dt><dd className="mt-1.5 text-sm font-medium text-slate-950">{value === null || value === "" ? "Not provided" : String(value)}</dd></div>) : null}
        </dl>
      </section>

      <section className="border-y border-slate-200 bg-white sm:rounded-md sm:border">
        <h2 className="border-b border-slate-200 px-5 py-4 text-base font-bold text-slate-950">Supporting Files</h2>
        {report.attachments.length ? <ul className="divide-y divide-slate-100">{report.attachments.map((attachment) => <li className="flex items-center justify-between gap-3 px-5 py-3" key={attachment.id}><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-950">{attachment.originalName}</p><p className="text-xs text-slate-500">{(attachment.size / 1024).toFixed(1)} KB</p></div><button className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" type="button" onClick={() => void downloadMonthlyReportAttachment(report.id, attachment.id, attachment.originalName)} aria-label="Download attachment" title="Download attachment"><Download className="h-4 w-4" /></button></li>)}</ul> : <p className="px-5 py-6 text-sm text-slate-500">No files uploaded.</p>}
      </section>

      {canReview ? (
        <section className="border-y border-slate-200 bg-white px-5 py-5 sm:rounded-md sm:border">
          <h2 className="text-base font-bold text-slate-950">Manager Review</h2>
          <label className="mt-4 block text-sm font-medium text-slate-700">Review Comment<textarea className="mt-1.5 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={5000} /></label>
          <div className="mt-4 flex flex-wrap justify-end gap-3"><button className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50" type="button" disabled={isWorking} onClick={() => void review("return")}><RotateCcw className="h-4 w-4" /> Return for Changes</button><button className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50" type="button" disabled={isWorking} onClick={() => void review("approve")}><CheckCircle2 className="h-4 w-4" /> Approve</button></div>
        </section>
      ) : null}

      <section className="border-y border-slate-200 bg-white sm:rounded-md sm:border">
        <h2 className="border-b border-slate-200 px-5 py-4 text-base font-bold text-slate-950">Action History</h2>
        <ol className="divide-y divide-slate-100">{report.history.map((entry) => <li className="px-5 py-4" key={entry.id}><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-semibold text-slate-950">{entry.action.replace(/_/g, " ")}</p><time className="text-xs text-slate-500">{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</time></div><p className="mt-1 text-sm text-slate-600">{actorName(entry)}{entry.comment ? `: ${entry.comment}` : ""}</p></li>)}</ol>
      </section>
    </div>
  );
}
