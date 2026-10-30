import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchRiskDashboard } from "../services/risk.service";
import type { RiskDashboard } from "../types/risk";
import { AuditError } from "./AuditUi";
import { DistributionChart } from "./AuditDashboardPanel";

export function RiskDashboardPanel({ charts = true }: { charts?: boolean }) {
  const [summary,setSummary] = useState<RiskDashboard>(); const [error,setError] = useState("");
  useEffect(()=>{ fetchRiskDashboard().then(setSummary).catch((caught:Error)=>setError(caught.message)); },[]);
  const cards: Array<[string,keyof RiskDashboard,string]> = [["Total risks","totalRisks",""],["Critical risks","criticalRisks","level=CRITICAL"],["High risks","highRisks","level=HIGH"],["Open risks","openRisks","view=OPEN"],["Overdue mitigations","overdueMitigations","view=OVERDUE"],["Risks due for review","dueForReview","view=REVIEW_DUE"]];
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Risk Assessment</h2><p className="mt-1 text-sm text-slate-500">Current assessments and mitigation progress in your access scope.</p></div>{charts ? <Link className="text-sm font-semibold text-brand-700" to="/risks">Open Risk Register →</Link> : null}</div><AuditError error={error}/>{summary ? <><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{cards.map(([title,key,query])=><Link key={key} to={`/risks${query ? `?${query}` : ""}`} className={`rounded-lg border p-4 hover:border-brand-500 ${["criticalRisks","overdueMitigations"].includes(key) && Number(summary[key]) ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}><p className="text-xs font-semibold text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold">{String(summary[key])}</p></Link>)}</div>{charts ? <div className="grid gap-4 md:grid-cols-3"><DistributionChart title="Risks by department" rows={summary.byDepartment}/><DistributionChart title="Risks by category" rows={summary.byCategory}/><DistributionChart title="Risk trend — new assessments" rows={summary.monthlyTrend}/></div> : null}</> : !error ? <p className="text-sm text-slate-500">Loading risk metrics…</p> : null}</section>;
}
