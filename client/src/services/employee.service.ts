import { apiRequest } from "./api";
import type {
  EmployeeFormInput,
  EmployeeListResponse,
  EmployeeOptions,
  EmployeeRecord
} from "../types/employee";

export type EmployeeFilters = {
  page: number;
  pageSize: number;
  search?: string;
  departmentId?: string;
  roleName?: string;
  employmentStatus?: string;
  isActive?: string;
};

export function fetchEmployees(filters: EmployeeFilters) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return apiRequest<EmployeeListResponse>(`/employees?${query.toString()}`);
}

export function fetchEmployee(id: string) {
  return apiRequest<{ employee: EmployeeRecord }>(`/employees/${id}`);
}

export function fetchEmployeeOptions() {
  return apiRequest<EmployeeOptions>("/employees/options");
}

export function createEmployee(input: EmployeeFormInput) {
  return apiRequest<{ employee: EmployeeRecord; temporaryPassword: string }>("/employees", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateEmployee(id: string, input: Omit<EmployeeFormInput, "employeeCode" | "email">) {
  return apiRequest<{ employee: EmployeeRecord }>(`/employees/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function updateEmployeeStatus(id: string, isActive: boolean) {
  return apiRequest<{ employee: EmployeeRecord }>(`/employees/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive })
  });
}
