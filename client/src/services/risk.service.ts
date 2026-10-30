import { apiDownload, apiRequest } from "./api";
import type { Risk, RiskDashboard, RiskFilters, RiskList, RiskOptions } from "../types/risk";
export function riskRequest<T>(path: string, method = "GET", body?: unknown) { return apiRequest<T>(`/risks${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
export function riskQuery(filters: RiskFilters) { const params = new URLSearchParams(); Object.entries(filters).forEach(([key,value]) => { if (value !== undefined && value !== "") params.set(key,String(value)); }); return params.toString(); }
export const fetchRisks = (filters: RiskFilters) => riskRequest<RiskList>(`?${riskQuery(filters)}`);
export const fetchRisk = (id: string) => riskRequest<{ risk: Risk }>(`/${id}`);
export const fetchRiskOptions = (findingId?: string) => riskRequest<RiskOptions>(`/options${findingId ? `?findingId=${encodeURIComponent(findingId)}` : ""}`);
export const fetchRiskDashboard = () => riskRequest<RiskDashboard>("/dashboard");
export function uploadRiskEvidence(id: string, files: File[]) { const body = new FormData(); files.forEach((file) => body.append("files",file)); return apiRequest<{ risk: Risk }>(`/risks/${id}/evidence`, { method:"POST",body }); }
export async function downloadRiskEvidence(id: string, name: string) { const blob = await apiDownload(`/risks/evidence/${id}`); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href=url; link.download=name; link.click(); URL.revokeObjectURL(url); }
