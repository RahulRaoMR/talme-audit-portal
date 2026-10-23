import { apiRequest } from "./api";
import type { QuarterlyFilters, QuarterlyInput, QuarterlyListItem, QuarterlyReport } from "../types/quarterlyReport";

function queryString(filters: QuarterlyFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
  return params.toString();
}

export const fetchQuarterlyReports = (filters: QuarterlyFilters) => apiRequest<{ reports: QuarterlyListItem[]; departments: Array<{ id: string; name: string; code: string }>; employees: Array<{ id: string; employeeCode: string; firstName: string; lastName: string }>; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(`/quarterly-reports?${queryString(filters)}`);
export const fetchQuarterlyReport = (id: string) => apiRequest<{ report: QuarterlyReport }>(`/quarterly-reports/${id}`);
export const fetchQuarterlyPreview = (quarter: string, year: number) => apiRequest<{ monthlyReports: QuarterlyReport["monthlyReports"] }>(`/quarterly-reports/preview?quarter=${quarter}&year=${year}`);
export const createQuarterlyReport = (input: QuarterlyInput) => apiRequest<{ report: QuarterlyReport }>("/quarterly-reports", { method: "POST", body: JSON.stringify(input) });
export const updateQuarterlyReport = (id: string, input: Omit<QuarterlyInput, "quarter" | "year">) => apiRequest<{ report: QuarterlyReport }>(`/quarterly-reports/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const submitQuarterlyReport = (id: string) => apiRequest<{ report: QuarterlyReport }>(`/quarterly-reports/${id}/submit`, { method: "POST" });
export const returnQuarterlyReport = (id: string, comment: string) => apiRequest<{ report: QuarterlyReport }>(`/quarterly-reports/${id}/return`, { method: "POST", body: JSON.stringify({ comment }) });
export const saveQuarterlyReview = (id: string, input: unknown, submit: boolean) => apiRequest<{ report: QuarterlyReport }>(`/quarterly-reports/${id}/manager-review${submit ? "" : "/save"}`, { method: "POST", body: JSON.stringify(input) });
export const finalizeQuarterlyReport = (id: string, hrComments: string) => apiRequest<{ report: QuarterlyReport }>(`/quarterly-reports/${id}/finalize`, { method: "POST", body: JSON.stringify({ hrComments }) });
export const fetchCurrentQuarterlyReport = () => apiRequest<{ report: { id: string; quarter: string; year: number; status: string; overallScore: string | number | null; finalRating: string | null } | null }>("/quarterly-reports/current");
