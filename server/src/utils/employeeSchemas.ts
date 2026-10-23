import { z } from "zod";
import { roleNames } from "../types/auth.js";

export const assignableRoleNames = ["EMPLOYEE", "MANAGER", "HR_ADMIN", "AUDITOR"] as const;
export const employmentStatuses = ["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"] as const;

const optionalNullableText = (maximum: number) =>
  z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().trim().max(maximum).nullable().optional()
  );

const optionalManagerId = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().trim().min(1).nullable().optional()
);

const employeeFields = {
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  phone: optionalNullableText(30),
  departmentId: z.string().trim().min(1, "Department is required"),
  designation: z.string().trim().min(1, "Designation is required").max(120),
  managerId: optionalManagerId,
  joiningDate: z.coerce.date({ invalid_type_error: "Enter a valid joining date" }),
  employmentStatus: z.enum(employmentStatuses),
  roleName: z.enum(assignableRoleNames)
};

export const createEmployeeSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .min(2, "Employee code is required")
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, "Employee code can use letters, numbers, hyphens, and underscores")
    .transform((value) => value.toUpperCase()),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .transform((value) => value.toLowerCase()),
  ...employeeFields
});

export const updateEmployeeSchema = z
  .object(employeeFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one field is required");

export const updateEmployeeStatusSchema = z.object({
  isActive: z.boolean()
});

export const employeeIdParamsSchema = z.object({
  id: z.string().trim().min(1, "Employee id is required")
});

export const employeeListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(120).optional(),
  departmentId: z.string().trim().optional(),
  roleName: z.enum(roleNames).optional(),
  employmentStatus: z.enum(employmentStatuses).optional(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true").optional()
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type UpdateEmployeeStatusInput = z.infer<typeof updateEmployeeStatusSchema>;
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;
