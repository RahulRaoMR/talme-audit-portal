import type { RoleName } from "./auth";

export type EmploymentStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED";
export type AssignableRoleName = Exclude<RoleName, "SUPER_ADMIN">;

export type EmployeeRecord = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  designation: string;
  joiningDate: string;
  employmentStatus: EmploymentStatus;
  createdAt: string;
  updatedAt: string;
  department: {
    id: string;
    name: string;
    code: string;
  };
  manager: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
  } | null;
  user: {
    id: string;
    isActive: boolean;
    mustChangePassword: boolean;
    role: {
      id: string;
      name: RoleName;
      description: string | null;
    };
  } | null;
};

export type EmployeeFormInput = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  designation: string;
  managerId: string;
  joiningDate: string;
  employmentStatus: EmploymentStatus;
  roleName: AssignableRoleName;
};

export type EmployeeOptions = {
  departments: Array<{ id: string; name: string; code: string }>;
  roles: Array<{ id: string; name: AssignableRoleName; description: string | null }>;
  managers: Array<{
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
  }>;
};

export type EmployeeListResponse = {
  employees: EmployeeRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
