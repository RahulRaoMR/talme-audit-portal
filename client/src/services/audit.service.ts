import { apiDownload, apiRequest } from "./api";
import type { Audit, AuditDashboard, AuditFinding, AuditListItem, AuditOptions, Pagination, RegisterFilters } from "../types/audit";
export function auditQuery(filters: RegisterFilters = {}) { const params = new URLSearchParams(); Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); }); return params.toString(); }
export function auditRequest<T>(path: string, method = "GET", body?: unknown) { return apiRequest<T>(`/audits${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
export const fetchAuditOptions = () => auditRequest<AuditOptions>("/options");
export const fetchAudits = (filters: RegisterFilters) => auditRequest<{ audits: AuditListItem[]; pagination: Pagination }>(`?${auditQuery(filters)}`);
export const fetchCapas = (filters: RegisterFilters) => auditRequest<{ findings: AuditFinding[]; pagination: Pagination }>(`/capas?${auditQuery(filters)}`);
export const fetchAudit = (id: string) => auditRequest<{ audit: Audit }>(`/${id}`);
export const fetchFinding = (id: string) => auditRequest<{ finding: AuditFinding }>(`/findings/${id}`);
export const fetchAuditDashboard = () => auditRequest<AuditDashboard>("/dashboard");
export async function auditDownload(path: string, name: string) { const blob = await apiDownload(`/audits${path}`); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }
export function uploadAuditEvidence(auditId: string, files: File[], context: Record<string, string> = {}) { const body = new FormData(); files.forEach((file) => body.append("files", file)); Object.entries(context).forEach(([key, value]) => { if (value) body.append(key, value); }); return apiRequest<{ audit: Audit }>(`/audits/${auditId}/evidence`, { method: "POST", body }); }
