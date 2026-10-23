import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, FilePlus2, Layers3, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { QuarterlyStatusBadge } from "../components/QuarterlyStatusBadge";
import { fetchQuarterlyReports } from "../services/quarterlyReport.service";
import type { QuarterlyFilters, QuarterlyListItem } from "../types/quarterlyReport";

type Result = Awaited<ReturnType<typeof fetchQuarterlyReports>>;
const selectClass = "h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

export function QuarterlyReportListPage({ scope = "mine" }: { scope?: "mine" | "review" }) {
  const [filters, setFilters] = useState<QuarterlyFilters>({ scope, page: 1, pageSize: 10 });
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setResult(await fetchQuarterlyReports(filters)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load quarterly reports"); }
    finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => setFilters({ scope, page: 1, pageSize: 10 }), [scope]);
  function setFilter(key: keyof QuarterlyFilters, value: string | number) { setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 1 })); }
  const monthlyComplete = (report: QuarterlyListItem) => [report.monthlyReport1, report.monthlyReport2, report.monthlyReport3].filter((monthly) => monthly?.status === "APPROVED").length;

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-brand-50 text-brand-700"><Layers3 className="h-5 w-5" /></span><div><h1 className="text-2xl font-bold text-slate-950">{scope === "review" ? "Quarterly Report Review" : "Quarterly Reports"}</h1><p className="mt-1 text-sm text-slate-500">{result ? `${result.pagination.total} reports` : "Quarterly records"}</p></div></div>{scope === "mine" ? <Link className="inline-flex items-center gap-2 rounded-md bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600" to="/quarterly-reports/new"><FilePlus2 className="h-4 w-4" /> New Quarterly Report</Link> : null}</header>
    <section className="border-y border-slate-200 bg-white px-4 py-4 sm:rounded-md sm:border"><div className={`grid gap-3 sm:grid-cols-2 ${scope === "review" ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
      <select className={selectClass} value={filters.quarter ?? ""} onChange={(event) => setFilter("quarter", event.target.value)}><option value="">All quarters</option>{["Q1", "Q2", "Q3", "Q4"].map((quarter) => <option key={quarter}>{quarter}</option>)}</select>
      <input className={selectClass} type="number" placeholder="Year" value={filters.year ?? ""} onChange={(event) => setFilter("year", event.target.value)} />
      <select className={selectClass} value={filters.status ?? ""} onChange={(event) => setFilter("status", event.target.value)}><option value="">All statuses</option>{["DRAFT", "SUBMITTED", "MANAGER_REVIEWED", "RETURNED", "FINALIZED"].map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select>
      <select className={selectClass} value={filters.departmentId ?? ""} onChange={(event) => setFilter("departmentId", event.target.value)}><option value="">All departments</option>{result?.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
      {scope === "review" ? <select className={selectClass} value={filters.employeeId ?? ""} onChange={(event) => setFilter("employeeId", event.target.value)}><option value="">All employees</option>{result?.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select> : null}
    </div></section>
    {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    <section className="overflow-hidden border-y border-slate-200 bg-white sm:rounded-md sm:border"><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500"><tr>{["Quarter", "Employee", "Department", "Monthly Reports", "Status", "Final Score", "Actions"].map((heading) => <th className="border-b border-slate-200 px-4 py-3" key={heading}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{result?.reports.map((report) => <tr className="hover:bg-slate-50" key={report.id}><td className="px-4 py-3 font-semibold text-slate-950">{report.quarter} {report.year}</td><td className="px-4 py-3"><span className="font-medium text-slate-950">{report.employee.firstName} {report.employee.lastName}</span><span className="block text-xs text-slate-500">{report.employee.employeeCode}</span></td><td className="px-4 py-3 text-slate-600">{report.employee.department.name}</td><td className="px-4 py-3 text-slate-600">{monthlyComplete(report)}/3 approved</td><td className="px-4 py-3"><QuarterlyStatusBadge status={report.status} /></td><td className="px-4 py-3 text-slate-700">{report.status === "FINALIZED" ? `${Number(report.overallScore).toFixed(2)} · ${report.finalRating}` : "Not finalized"}</td><td className="px-4 py-3"><div className="flex gap-1"><Link className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" to={`/quarterly-reports/${report.id}`} title="View report"><Eye className="h-4 w-4" /></Link>{scope === "mine" && ["DRAFT", "RETURNED"].includes(report.status) ? <Link className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" to={`/quarterly-reports/${report.id}/edit`} title="Edit report"><Pencil className="h-4 w-4" /></Link> : null}</div></td></tr>)}</tbody></table></div>
      {loading ? <p className="px-6 py-12 text-center text-sm text-slate-500">Loading quarterly reports...</p> : null}{!loading && result?.reports.length === 0 ? <p className="px-6 py-12 text-center text-sm text-slate-500">No quarterly reports match these filters.</p> : null}
      {result ? <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3"><p className="text-sm text-slate-500">Page {result.pagination.page} of {result.pagination.totalPages}</p><div className="flex gap-2"><button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 disabled:opacity-40" disabled={result.pagination.page <= 1} onClick={() => setFilter("page", result.pagination.page - 1)}><ChevronLeft className="h-4 w-4" /></button><button className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 disabled:opacity-40" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => setFilter("page", result.pagination.page + 1)}><ChevronRight className="h-4 w-4" /></button></div></footer> : null}
    </section>
  </div>;
}

