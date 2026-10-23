import { apiDownload, apiRequest } from "./api";
import type {
  MonthlyReport,
  MonthlyReportFilters,
  MonthlyReportInput,
  MonthlyReportListItem,
  MonthlyReportListResponse
} from "../types/monthlyReport";

function queryString(filters: MonthlyReportFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export function fetchMonthlyReports(filters: MonthlyReportFilters) {
  return apiRequest<MonthlyReportListResponse>(`/monthly-reports?${queryString(filters)}`);
}

export function fetchCurrentMonthlyReport() {
  return apiRequest<{ report: MonthlyReportListItem | null }>("/monthly-reports/current");
}

export function fetchMonthlyReport(id: string) {
  return apiRequest<{ report: MonthlyReport }>(`/monthly-reports/${id}`);
}

export function createMonthlyReport(input: MonthlyReportInput) {
  return apiRequest<{ report: MonthlyReport }>("/monthly-reports", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateMonthlyReport(id: string, input: Omit<MonthlyReportInput, "month" | "year">) {
  return apiRequest<{ report: MonthlyReport }>(`/monthly-reports/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function submitMonthlyReport(id: string) {
  return apiRequest<{ report: MonthlyReport }>(`/monthly-reports/${id}/submit`, { method: "POST" });
}

export function approveMonthlyReport(id: string, comment: string) {
  return apiRequest<{ report: MonthlyReport }>(`/monthly-reports/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ comment })
  });
}

export function returnMonthlyReport(id: string, comment: string) {
  return apiRequest<{ report: MonthlyReport }>(`/monthly-reports/${id}/return`, {
    method: "POST",
    body: JSON.stringify({ comment })
  });
}

export function uploadMonthlyReportAttachments(id: string, files: File[]) {
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  return apiRequest<{ report: MonthlyReport }>(`/monthly-reports/${id}/attachments`, {
    method: "POST",
    body
  });
}

export function deleteMonthlyReportAttachment(id: string, attachmentId: string) {
  return apiRequest<{ report: MonthlyReport }>(
    `/monthly-reports/${id}/attachments/${attachmentId}`,
    { method: "DELETE" }
  );
}

export async function downloadMonthlyReportAttachment(
  id: string,
  attachmentId: string,
  filename: string
) {
  const blob = await apiDownload(`/monthly-reports/${id}/attachments/${attachmentId}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

