export const roleNames = [
  "EMPLOYEE",
  "MANAGER",
  "HR_ADMIN",
  "AUDITOR",
  "SUPER_ADMIN"
] as const;

export type RoleName = (typeof roleNames)[number];

export type AuthenticatedUser = {
  userId: string;
  email: string;
  roleName: RoleName;
  mustChangePassword: boolean;
};
