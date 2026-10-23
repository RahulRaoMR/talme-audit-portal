import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, FilePlus2, FileText, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { MonthlyReportStatusBadge } from "../components/MonthlyReportStatusBadge";
import { fetchMonthlyReports } from "../services/monthlyReport.service";
import type { MonthlyReportFilters, MonthlyReportListResponse } from "../types/monthlyReport";

const selectClass = "h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

export function MonthlyReportListPage({ scope = "mine" }: { scope?: "mine" | "review" }) {
  const [filters, setFilters] = useState<MonthlyReportFilters>({ scope, page: 1, pageSize: 10 });
  const [result, setResult] = useState<MonthlyReportListResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      setResult(await fetchMonthlyReports(filters));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load monthly reports");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => setFilters({ scope, page: 1, pageSize: 10 }), [scope]);

  function setFilter(key: keyof MonthlyReportFilters, value: string | number) {
    setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 1 }));
  }

  const title = scope === "review" ? "Monthly Report Review" : "Monthly Reports";

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-brand-50 text-brand-700"><FileText className="h-5 w-5" /></span>
          <div><h1 className="text-2xl font-bold text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">{result ? `${result.pagination.total} reports` : "Report records"}</p></div>
        </div>
        {scope === "mine" ? (
          <Link className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600" to="/monthly-reports/new"><FilePlus2 className="h-4 w-4" /> New Report</Link>
        ) : null}
      </header>

      <section className="border-y border-slate-200 bg-white px-4 py-4 sm:rounded-md sm:border">
        <div className={`grid gap-3 sm:grid-cols-2 ${scope === "review" ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
          <select className={selectClass} value={filters.month ?? ""} onChange={(event) => setFilter("month", event.target.value)} aria-label="Month filter">
            <option value="">All months</option>
            {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2024, index, 1))}</option>)}
          </select>
          <input className={selectClass} type="number" min="2000" max="2200" placeholder="Year" value={filters.year ?? ""} onChange={(event) => setFilter("year", event.target.value)} aria-label="Year filter" />
          <select className={selectClass} value={filters.status ?? ""} onChange={(event) => setFilter("status", event.target.value)} aria-label="Status filter">
            <option value="">All statuses</option>
            {['DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED'].map((status) => <option key={status} value={status}>{status.charAt(0) + status.slice(1).toLowerCase()}</option>)}
          </select>
          <select className={selectClass} value={filters.departmentId ?? ""} onChange={(event) => setFilter("departmentId", event.target.value)} aria-label="Department filter">
            <option value="">All departments</option>
            {result?.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          {scope === "review" ? <select className={selectClass} value={filters.employeeId ?? ""} onChange={(event) => setFilter("employeeId", event.target.value)} aria-label="Employee filter"><option value="">All employees</option>{result?.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} ({employee.employeeCode})</option>)}</select> : null}
        </div>
      </section>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="overflow-hidden border-y border-slate-200 bg-white sm:rounded-md sm:border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500"><tr>{["Period", "Employee", "Department", "Status", "Files", "Submitted", "Reviewed", "Actions"].map((heading) => <th className="border-b border-slate-200 px-4 py-3" key={heading}>{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {result?.reports.map((report) => (
                <tr className="hover:bg-slate-50" key={report.id}>
                  <td className="px-4 py-3 font-semibold text-slate-950">{report.reportPeriod}</td>
                  <td className="px-4 py-3 text-slate-700"><span className="font-medium text-slate-950">{report.employee.firstName} {report.employee.lastName}</span><span className="block text-xs text-slate-500">{report.employee.employeeCode}</span></td>
                  <td className="px-4 py-3 text-slate-600">{report.employee.department.name}</td>
                  <td className="px-4 py-3"><MonthlyReportStatusBadge status={report.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{report._count.attachments}</td>
                  <td className="px-4 py-3 text-slate-600">{report.submittedAt ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(report.submittedAt)) : "Not submitted"}</td>
                  <td className="px-4 py-3 text-slate-600">{report.reviewedAt ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(report.reviewedAt)) : "Not reviewed"}</td>
                  <td className="px-4 py-3"><div className="flex gap-1"><Link className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" to={`/monthly-reports/${report.id}`} aria-label="View report" title="View report"><Eye className="h-4 w-4" /></Link>{scope === "mine" && ["DRAFT", "RETURNED"].includes(report.status) ? <Link className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" to={`/monthly-reports/${report.id}/edit`} aria-label="Edit report" title="Edit report"><Pencil className="h-4 w-4" /></Link> : null}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading ? <p className="px-6 py-12 text-center text-sm text-slate-500">Loading monthly reports...</p> : null}
        {!isLoading && result?.reports.length === 0 ? <p className="px-6 py-12 text-center text-sm text-slate-500">No monthly reports match these filters.</p> : null}
        {result ? <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3"><p className="text-sm text-slate-500">Page {result.pagination.page} of {result.pagination.totalPages}</p><div className="flex gap-2"><button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 disabled:opacity-40" disabled={result.pagination.page <= 1} onClick={() => setFilter("page", result.pagination.page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button><button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 disabled:opacity-40" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => setFilter("page", result.pagination.page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button></div></footer> : null}
      </section>
    </div>
  );
}
