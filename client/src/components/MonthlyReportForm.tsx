import { Download, FileUp, Trash2 } from "lucide-react";
import type { MonthlyReportAttachment, MonthlyReportInput } from "../types/monthlyReport";

type DetailField = { key: string; label: string; type?: "text" | "number" };

const detailFields: Record<string, DetailField[]> = {
  HR: [
    { key: "openPositions", label: "Open Positions", type: "number" },
    { key: "positionsClosed", label: "Positions Closed", type: "number" },
    { key: "candidatesInterviewed", label: "Candidates Interviewed", type: "number" },
    { key: "employeesOnboarded", label: "Employees Onboarded", type: "number" },
    { key: "documentsCompleted", label: "Documents Completed", type: "number" },
    { key: "documentsPending", label: "Documents Pending", type: "number" },
    { key: "employeeIssuesResolved", label: "Employee Issues Resolved", type: "number" }
  ],
  DEV: [
    { key: "tasksAssigned", label: "Tasks Assigned", type: "number" },
    { key: "tasksCompleted", label: "Tasks Completed", type: "number" },
    { key: "tasksPending", label: "Tasks Pending", type: "number" },
    { key: "bugsAssigned", label: "Bugs Assigned", type: "number" },
    { key: "bugsResolved", label: "Bugs Resolved", type: "number" },
    { key: "projectsWorkedOn", label: "Projects Worked On", type: "number" },
    { key: "deploymentsCompleted", label: "Deployments Completed", type: "number" },
    { key: "onTimeDeliveryPercent", label: "On-time Delivery (%)", type: "number" }
  ],
  PAY: [
    { key: "employeesProcessed", label: "Employees Processed", type: "number" },
    { key: "payrollCompleted", label: "Payroll Runs Completed", type: "number" },
    { key: "payrollErrors", label: "Payroll Errors", type: "number" },
    { key: "correctionsRequired", label: "Corrections Required", type: "number" },
    { key: "payslipsGenerated", label: "Payslips Generated", type: "number" },
    { key: "payslipsPending", label: "Payslips Pending", type: "number" },
    { key: "employeeQueries", label: "Employee Queries", type: "number" },
    { key: "queriesResolved", label: "Queries Resolved", type: "number" },
    { key: "pfStatus", label: "PF Status" },
    { key: "esiStatus", label: "ESI Status" },
    { key: "tdsStatus", label: "TDS Status" }
  ]
};

const textFields: Array<{ key: keyof MonthlyReportInput; label: string }> = [
  { key: "summary", label: "Work Summary" },
  { key: "achievements", label: "Key Achievements" },
  { key: "challenges", label: "Challenges" },
  { key: "pendingWork", label: "Pending Work" },
  { key: "nextMonthPlan", label: "Next Month Plan" },
  { key: "employeeComments", label: "Additional Comments" }
];

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

type Props = {
  value: MonthlyReportInput;
  departmentCode: string;
  departmentName: string;
  periodLocked: boolean;
  files: File[];
  attachments: MonthlyReportAttachment[];
  onChange: (value: MonthlyReportInput) => void;
  onFilesChange: (files: File[]) => void;
  onDownload: (attachment: MonthlyReportAttachment) => void;
  onDeleteAttachment: (attachment: MonthlyReportAttachment) => void;
};

export function MonthlyReportForm({
  value,
  departmentCode,
  departmentName,
  periodLocked,
  files,
  attachments,
  onChange,
  onFilesChange,
  onDownload,
  onDeleteAttachment
}: Props) {
  const fields = detailFields[departmentCode] ?? [];
  const years = Array.from({ length: 5 }, (_, index) => new Date().getFullYear() - 2 + index);

  function updateDetail(key: string, fieldValue: string) {
    const field = fields.find((item) => item.key === key);
    onChange({
      ...value,
      departmentDetail: {
        ...value.departmentDetail,
        [key]: field?.type === "number" ? Number(fieldValue || 0) : fieldValue
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="border-y border-slate-200 bg-white px-5 py-5 sm:rounded-md sm:border">
        <h2 className="text-base font-bold text-slate-950">Report Period</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Month
            <select
              className={inputClass}
              value={value.month}
              disabled={periodLocked}
              onChange={(event) => onChange({ ...value, month: Number(event.target.value) })}
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2024, index, 1))}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Year
            <select
              className={inputClass}
              value={value.year}
              disabled={periodLocked}
              onChange={(event) => onChange({ ...value, year: Number(event.target.value) })}
            >
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Department
            <input className={`${inputClass} bg-slate-50`} value={departmentName} disabled />
          </label>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white px-5 py-5 sm:rounded-md sm:border">
        <h2 className="text-base font-bold text-slate-950">Monthly Work</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {textFields.map((field) => (
            <label className="text-sm font-medium text-slate-700" key={field.key}>
              {field.label}
              <textarea
                className={`${inputClass} min-h-28 resize-y`}
                value={String(value[field.key] ?? "")}
                onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
                maxLength={5000}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white px-5 py-5 sm:rounded-md sm:border">
        <h2 className="text-base font-bold text-slate-950">{departmentName} Metrics</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {fields.map((field) => (
            <label className="text-sm font-medium text-slate-700" key={field.key}>
              {field.label}
              <input
                className={inputClass}
                type={field.type ?? "text"}
                min={field.type === "number" ? 0 : undefined}
                max={field.key === "onTimeDeliveryPercent" ? 100 : undefined}
                value={String(value.departmentDetail[field.key] ?? (field.type === "number" ? 0 : ""))}
                onChange={(event) => updateDetail(field.key, event.target.value)}
              />
            </label>
          ))}
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Department Remarks
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
            value={String(value.departmentDetail.remarks ?? "")}
            onChange={(event) => updateDetail("remarks", event.target.value)}
          />
        </label>
      </section>

      <section className="border-y border-slate-200 bg-white px-5 py-5 sm:rounded-md sm:border">
        <div className="flex items-center gap-3">
          <FileUp className="h-5 w-5 text-brand-700" />
          <div>
            <h2 className="text-base font-bold text-slate-950">Supporting Files</h2>
            <p className="text-sm text-slate-500">At least one file is required before submission.</p>
          </div>
        </div>
        <label className="mt-4 block rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm font-medium text-slate-700 hover:border-brand-500">
          Select files
          <input
            className="sr-only"
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            onChange={(event) => onFilesChange(Array.from(event.target.files ?? []).slice(0, 5))}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">PDF, Word, Excel, PNG or JPEG, up to 10 MB each</span>
        </label>

        {files.length ? (
          <ul className="mt-3 divide-y divide-slate-100 border-y border-slate-200 text-sm">
            {files.map((file) => <li className="py-2 text-slate-700" key={`${file.name}-${file.size}`}>{file.name}</li>)}
          </ul>
        ) : null}

        {attachments.length ? (
          <ul className="mt-4 divide-y divide-slate-100 border-y border-slate-200">
            {attachments.map((attachment) => (
              <li className="flex items-center justify-between gap-3 py-3" key={attachment.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-950">{attachment.originalName}</p>
                  <p className="text-xs text-slate-500">{(attachment.size / 1024).toFixed(1)} KB</p>
                </div>
                <div className="flex gap-1">
                  <button className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" type="button" title="Download file" aria-label="Download file" onClick={() => onDownload(attachment)}><Download className="h-4 w-4" /></button>
                  <button className="inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 hover:bg-red-50" type="button" title="Delete file" aria-label="Delete file" onClick={() => onDeleteAttachment(attachment)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

