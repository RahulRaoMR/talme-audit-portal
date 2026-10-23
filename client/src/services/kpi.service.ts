import { apiRequest } from "./api";
import type { Kpi, KpiInput, RatingRange } from "../types/quarterlyReport";

export type KpiListResponse = {
  kpis: Kpi[];
  departments: Array<{ id: string; name: string; code: string }>;
  weightTotals: Array<{ department: { id: string; name: string; code: string }; total: number; isValid: boolean }>;
};

export const fetchKpis = () => apiRequest<KpiListResponse>("/kpis");
export const fetchKpi = (id: string) => apiRequest<{ kpi: Kpi }>(`/kpis/${id}`);
export const createKpi = (input: KpiInput) => apiRequest<{ kpi: Kpi }>("/kpis", { method: "POST", body: JSON.stringify(input) });
export const updateKpi = (id: string, input: KpiInput) => apiRequest<{ kpi: Kpi }>(`/kpis/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const updateKpiStatus = (id: string, isActive: boolean) => apiRequest<{ kpi: Kpi }>(`/kpis/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) });
export const fetchRatingRanges = () => apiRequest<{ ranges: RatingRange[] }>("/performance-rating-ranges");
export const createRatingRange = (input: Omit<RatingRange, "id">) => apiRequest<{ range: RatingRange }>("/performance-rating-ranges", { method: "POST", body: JSON.stringify(input) });
export const updateRatingRange = (id: string, input: Omit<RatingRange, "id">) => apiRequest<{ range: RatingRange }>(`/performance-rating-ranges/${id}`, { method: "PATCH", body: JSON.stringify(input) });

