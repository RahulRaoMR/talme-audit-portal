import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Save } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MonthlyReportForm } from "../components/MonthlyReportForm";
import { useAuth } from "../hooks/useAuth";
import {
  createMonthlyReport,
  deleteMonthlyReportAttachment,
  downloadMonthlyReportAttachment,
  fetchMonthlyReport,
  submitMonthlyReport,
  updateMonthlyReport,
  uploadMonthlyReportAttachments
} from "../services/monthlyReport.service";
import type { MonthlyReport, MonthlyReportInput } from "../types/monthlyReport";

const now = new Date();
const emptyInput: MonthlyReportInput = {
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  summary: "",
  achievements: "",
  challenges: "",
  pendingWork: "",
  nextMonthPlan: "",
  employeeComments: "",
  departmentDetail: {}
};

function toInput(report: MonthlyReport): MonthlyReportInput {
  const detail = report.hrDetail ?? report.developerDetail ?? report.payrollDetail;
  return {
    month: report.month,
    year: report.year,
    summary: report.summary,
    achievements: report.achievements,
    challenges: report.challenges,
    pendingWork: report.pendingWork,
    nextMonthPlan: report.nextMonthPlan,
    employeeComments: report.employeeComments ?? "",
    departmentDetail: detail ? { ...detail } : {}
  };
}

export function MonthlyReportEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [input, setInput] = useState<MonthlyReportInput>(emptyInput);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchMonthlyReport(id)
      .then(({ report: loaded }) => {
        if (!["DRAFT", "RETURNED"].includes(loaded.status)) {
          navigate(`/monthly-reports/${loaded.id}`, { replace: true });
          return;
        }
        setReport(loaded);
        setInput(toInput(loaded));
      })
      .catch((caughtError) =>
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load monthly report")
      )
      .finally(() => setIsLoading(false));
  }, [id, navigate]);

  const department = useMemo(
    () => report?.employee.department ?? user?.employee?.department,
    [report, user]
  );

  async function save(shouldSubmit: boolean) {
    if (!department) {
      setError("Your account must be linked to a department before creating a report");
      return;
    }
    try {
      setIsSaving(true);
      setError("");
      let saved = report;
      if (saved) {
        const { month: _month, year: _year, ...update } = input;
        saved = (await updateMonthlyReport(saved.id, update)).report;
      } else {
        saved = (await createMonthlyReport(input)).report;
      }

      if (files.length) {
        saved = (await uploadMonthlyReportAttachments(saved.id, files)).report;
        setFiles([]);
      }
      setReport(saved);

      if (shouldSubmit) {
        saved = (await submitMonthlyReport(saved.id)).report;
      }
      navigate(`/monthly-reports/${saved.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save monthly report");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAttachment(attachmentId: string) {
    if (!report) return;
    try {
      setError("");
      setReport((await deleteMonthlyReportAttachment(report.id, attachmentId)).report);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete attachment");
    }
  }

  if (isLoading) return <p className="text-sm text-slate-600">Loading monthly report...</p>;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950" to="/monthly-reports">
            <ArrowLeft className="h-4 w-4" /> Back to monthly reports
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-slate-950">{report ? "Edit Monthly Report" : "Create Monthly Report"}</h1>
          <p className="mt-1 text-sm text-slate-500">Complete your work summary, department metrics, and supporting files.</p>
        </div>
      </header>

      {report?.status === "RETURNED" && report.managerComments ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Returned for changes:</strong> {report.managerComments}
        </div>
      ) : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {department ? (
        <MonthlyReportForm
          value={input}
          departmentCode={department.code}
          departmentName={department.name}
          periodLocked={Boolean(report)}
          files={files}
          attachments={report?.attachments ?? []}
          onChange={setInput}
          onFilesChange={setFiles}
          onDownload={(attachment) => report && void downloadMonthlyReportAttachment(report.id, attachment.id, attachment.originalName)}
          onDeleteAttachment={(attachment) => void deleteAttachment(attachment.id)}
        />
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">No employee department is assigned to this account.</p>
      )}

      <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
        <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" type="button" disabled={isSaving || !department} onClick={() => void save(false)}>
          <Save className="h-4 w-4" /> Save Draft
        </button>
        <button className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50" type="button" disabled={isSaving || !department} onClick={() => void save(true)}>
          <CheckCircle2 className="h-4 w-4" /> Save and Submit
        </button>
      </footer>
    </div>
  );
}

