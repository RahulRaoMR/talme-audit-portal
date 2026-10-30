import type { AuthenticatedUser } from "../types/auth.js";
import type { RegisterQuery } from "../utils/auditSchemas.js";
import { spreadsheetExport } from "../utils/spreadsheetExport.js";
import { HttpError } from "../utils/httpError.js";
import { listAudits, listCapas } from "./audit.service.js";

const date = (value: Date | string | null | undefined) => value ? new Date(value).toISOString().slice(0, 10) : "";
const person = (value: { firstName: string; lastName: string } | null | undefined) => value ? `${value.firstName} ${value.lastName}` : "Unassigned";
export async function exportAuditRegister(auth: AuthenticatedUser, kind: string, query: RegisterQuery) {
  if (!["audits", "findings", "capas", "overdue", "departments"].includes(kind)) throw new HttpError(400, "Unknown audit export");
  const request = { ...query, page: 1, pageSize: 100, ...(kind === "overdue" ? { view: "OVERDUE" as const } : {}) };
  if (kind === "audits") {
    const result = await listAudits(auth, request); const rows = [...result.audits];
    if (result.pagination.total > 10000) throw new HttpError(413, "Filter this export to 10,000 audits or fewer");
    for (let page = 2; page <= result.pagination.totalPages; page++) rows.push(...(await listAudits(auth, { ...request, page })).audits);
    return spreadsheetExport("Audit Summary", ["Audit ID", "Title", "Organisation", "Department", "Auditor", "Audit Date", "Status", "Findings", "Major NC", "Minor NC", "OFI", "Open CAPAs", "Overdue CAPAs"], rows.map((item) => [item.reference, item.title, item.organisation, item.department.name, item.auditor.email, date(item.auditDate), item.status, item.stats.totalFindings, item.stats.byRating.MAJOR_NC ?? 0, item.stats.byRating.MINOR_NC ?? 0, item.stats.byRating.OFI ?? 0, item.stats.openCapas, item.stats.overdueCapas]));
  }
  const result = await listCapas(auth, request); const rows = [...result.findings];
  if (result.pagination.total > 10000) throw new HttpError(413, "Filter this export to 10,000 findings or fewer");
  for (let page = 2; page <= result.pagination.totalPages; page++) rows.push(...(await listCapas(auth, { ...request, page })).findings);
  const headers = ["Audit ID", "Finding ID", "CAPA ID", "Organisation", "Department", "RBA Section", "RBA Reference", "Finding Rating", "Audit Finding", "RCA Method", "Root Cause", "Problem Statement", "Why 1", "Why 2", "Why 3", "Why 4", "Why 5", "Final Root Cause", "Containment", "Corrective Action", "CA Start", "CA Target", "CA Actual", "Preventive Action", "PA Start", "PA Target", "PA Actual", "Responsible Person", "CAPA Prepared By", "Date Established", "CAPA Target", "CAPA Completion", "Status", "Auditor Status", "Auditor Comments", "Verification Result", "Closed By", "Closure Date", "Days Remaining", "Days Overdue", "CAPA Ageing Days", "Finding Ageing Days"];
  const values = rows.map((item) => {
    const capa = item.capa!;
    const actions = (type: string, field: "startDate" | "targetDate" | "completionDate") => capa.actions.filter((action) => action.actionType === type).map((action) => date(action[field])).filter(Boolean).join("; ");
    return [item.audit.reference, item.reference, capa.reference, item.audit.organisation, item.department.name, item.rbaSection, item.rbaReference, item.rating.label, item.description, capa.rcaMethod, capa.rootCause, capa.problemStatement, capa.why1, capa.why2, capa.why3, capa.why4, capa.why5, capa.finalRootCause, capa.containmentAction, capa.correctiveAction, actions("CORRECTIVE", "startDate"), actions("CORRECTIVE", "targetDate"), actions("CORRECTIVE", "completionDate"), capa.preventiveAction, actions("PREVENTIVE", "startDate"), actions("PREVENTIVE", "targetDate"), actions("PREVENTIVE", "completionDate"), person(item.responsibleEmployee), capa.preparedBy?.email ?? "", date(capa.dateEstablished), date(capa.targetDate), date(capa.completionDate), capa.status, capa.auditorStatus, capa.auditorComments, capa.verificationResult, capa.closedBy?.email ?? "", date(capa.closedAt), capa.metrics.daysRemaining, capa.metrics.daysOverdue, capa.metrics.ageingDays, item.metrics.ageingDays];
  });
  return spreadsheetExport(kind === "overdue" ? "Overdue CAPA Report" : kind === "departments" ? "Department Audit Report" : kind === "findings" ? "Finding Register" : "CAPA Register", headers, values);
}
