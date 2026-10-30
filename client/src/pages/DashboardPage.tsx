import { RiskDashboardPanel } from "../components/RiskDashboardPanel";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarCheck, ClipboardList, FileBarChart, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { MonthlyReportStatusBadge } from "../components/MonthlyReportStatusBadge";
import { useAuth } from "../hooks/useAuth";
import { fetchCurrentMonthlyReport } from "../services/monthlyReport.service";
import { fetchCurrentQuarterlyReport } from "../services/quarterlyReport.service";
import type { MonthlyReportListItem } from "../types/monthlyReport";
import { AuditDashboardPanel } from "../components/AuditDashboardPanel";

const placeholderCards = [
  {
    title: "Attendance",
    value: "Awaiting data",
    icon: CalendarCheck
  }
];

export function DashboardPage() {
  const { user } = useAuth();
  const [currentReport, setCurrentReport] = useState<MonthlyReportListItem | null>(null);
  const [quarterlyReport, setQuarterlyReport] = useState<Awaited<ReturnType<typeof fetchCurrentQuarterlyReport>>["report"]>(null);

  useEffect(() => {
    fetchCurrentMonthlyReport().then(({ report }) => setCurrentReport(report)).catch(() => undefined);
    fetchCurrentQuarterlyReport().then(({ report }) => setQuarterlyReport(report)).catch(() => undefined);
  }, []);
  const employeeName = user?.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`
    : user?.email ?? "Employee";
  const department = user?.employee?.department.name ?? "Not assigned";
  const designation = user?.employee?.designation ?? "Not assigned";
  const role = user?.role.name ?? "EMPLOYEE";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
          TALME EMPLOYEE AUDIT PORTAL
        </p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-end">
          <div>
            <h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">
              Welcome, {employeeName}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              This dashboard is prepared for employee reporting, manager review, and internal
              audit workflows.
            </p>
          </div>

          <dl className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-3 lg:grid-cols-1">
            <div>
              <dt className="font-medium text-slate-500">Department</dt>
              <dd className="mt-1 font-semibold text-slate-950">{department}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Designation</dt>
              <dd className="mt-1 font-semibold text-slate-950">{designation}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Role</dt>
              <dd className="mt-1 font-semibold text-slate-950">{role}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Monthly Report</h3>
              <div className="mt-3">{currentReport ? <MonthlyReportStatusBadge status={currentReport.status} /> : <span className="text-sm text-slate-500">Not started</span>}</div>
              <Link className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-600" to={currentReport ? (["DRAFT", "RETURNED"].includes(currentReport.status) ? `/monthly-reports/${currentReport.id}/edit` : `/monthly-reports/${currentReport.id}`) : "/monthly-reports/new"}>{currentReport ? (["DRAFT", "RETURNED"].includes(currentReport.status) ? "Continue report" : "View report") : "Create report"}<ArrowRight className="h-4 w-4" /></Link>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-700"><ClipboardList className="h-5 w-5" /></span>
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-semibold text-slate-950">Quarterly Report</h3><p className="mt-3 text-sm text-slate-500">{quarterlyReport ? `${quarterlyReport.quarter} ${quarterlyReport.year} · ${quarterlyReport.status.replace(/_/g, " ")}` : "Not started"}</p>{quarterlyReport?.status === "FINALIZED" ? <p className="mt-2 text-sm font-semibold text-emerald-700">{Number(quarterlyReport.overallScore).toFixed(2)} · {quarterlyReport.finalRating}</p> : null}<Link className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700" to={quarterlyReport ? `/quarterly-reports/${quarterlyReport.id}` : "/quarterly-reports/new"}>{quarterlyReport ? "View report" : "Create report"}<ArrowRight className="h-4 w-4" /></Link></div><span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-cyan-700"><FileBarChart className="h-5 w-5" /></span></div>
        </article>
        {placeholderCards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.title}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">{card.title}</h3>
                  <p className="mt-3 text-sm text-slate-500">{card.value}</p>
                </div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
            </article>
          );
        })}
      </section>
      <AuditDashboardPanel /><RiskDashboardPanel />
    </div>
  );
}
