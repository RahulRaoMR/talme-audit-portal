export type RoleName = "EMPLOYEE" | "MANAGER" | "HR_ADMIN" | "AUDITOR" | "SUPER_ADMIN";

export type DepartmentSummary = {
  id: string;
  name: string;
  code: string;
};

export type EmployeeSummary = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string;
  department: DepartmentSummary;
};

export type UserProfile = {
  id: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: {
    id: string;
    name: RoleName;
    description: string | null;
  };
  employee: EmployeeSummary | null;
};

export type AuthResponse = {
  token: string;
  user: UserProfile;
};
