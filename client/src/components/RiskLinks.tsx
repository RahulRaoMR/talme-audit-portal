import { useEffect,useState } from "react";
import { Link } from "react-router-dom";
import { fetchRisks } from "../services/risk.service";
import type { Risk } from "../types/risk";
import { AuditBadge,AuditError,auditSecondaryClass } from "./AuditUi";
import { RiskLevelBadge } from "./RiskUi";
export function RiskLinks({ auditId,findingId,canCreate=false }: { auditId?:string;findingId?:string;canCreate?:boolean }){
  const [risks,setRisks]=useState<Risk[]>([]);const [total,setTotal]=useState(0);const [error,setError]=useState("");
  useEffect(()=>{let current=true;fetchRisks({auditId,findingId,pageSize:10}).then((data)=>{if(current){setRisks(data.risks);setTotal(data.pagination.total);}}).catch((caught:Error)=>{if(current)setError(caught.message);});return()=>{current=false;};},[auditId,findingId]);
  return <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Linked Risk Assessments</h2>{findingId&&canCreate?<Link className={auditSecondaryClass} to={`/risks/new?findingId=${findingId}`}>Create risk from finding</Link>:null}</div><AuditError error={error}/><div className="divide-y">{risks.map((risk)=><div key={risk.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><Link className="font-semibold text-brand-700" to={`/risks/${risk.id}`}>{risk.reference} · {risk.title}</Link><div className="flex gap-2"><RiskLevelBadge level={risk.riskLevel} score={risk.riskScore}/><AuditBadge value={risk.status}/></div></div>)}</div>{!risks.length&&!error?<p className="text-sm text-slate-500">No linked risks in your access scope.</p>:null}{total>10?<Link className="text-sm font-semibold text-brand-700" to={`/risks?${findingId?`findingId=${findingId}`:`auditId=${auditId}`}`}>View all {total} linked risks →</Link>:null}</section>;
}
