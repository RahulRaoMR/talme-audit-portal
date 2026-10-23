import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma.js";
import type {
  CreateEmployeeInput,
  EmployeeListQuery,
  UpdateEmployeeInput
} from "../utils/employeeSchemas.js";
import { assignableRoleNames } from "../utils/employeeSchemas.js";
import { HttpError } from "../utils/httpError.js";

const passwordSaltRounds = 12;

const employeeSelect = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  designation: true,
  joiningDate: true,
  employmentStatus: true,
  createdAt: true,
  updatedAt: true,
  department: {
    select: { id: true, name: true, code: true }
  },
  manager: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true }
  },
  user: {
    select: {
      id: true,
      isActive: true,
      mustChangePassword: true,
      role: { select: { id: true, name: true, description: true } }
    }
  }
} satisfies Prisma.EmployeeSelect;

async function getDepartmentAndRole(departmentId: string, roleName: string) {
  const [department, role] = await Promise.all([
    prisma.department.findFirst({ where: { id: departmentId, isActive: true } }),
    prisma.role.findUnique({ where: { name: roleName } })
  ]);

  if (!department) throw new HttpError(400, "Selected department does not exist or is inactive");
  if (!role || !assignableRoleNames.includes(role.name as (typeof assignableRoleNames)[number])) {
    throw new HttpError(400, "Selected role cannot be assigned through Employee Management");
  }

  return { department, role };
}

async function validateManager(managerId: string | null | undefined, employeeId?: string) {
  if (!managerId) return;
  if (managerId === employeeId) throw new HttpError(400, "An employee cannot report to themselves");

  let currentId: string | null = managerId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === employeeId) {
      throw new HttpError(400, "This reporting manager assignment would create a reporting loop");
    }
    if (visited.has(currentId)) {
      throw new HttpError(400, "The selected reporting hierarchy already contains a loop");
    }
    visited.add(currentId);

    const manager: { managerId: string | null; user: { isActive: boolean } | null } | null =
      await prisma.employee.findUnique({
        where: { id: currentId },
        select: { managerId: true, user: { select: { isActive: true } } }
      });

    if (!manager || !manager.user?.isActive) {
      throw new HttpError(400, "Selected reporting manager does not exist or is inactive");
    }

    currentId = manager.managerId;
  }
}

async function getEmployeeOrThrow(id: string) {
  const employee = await prisma.employee.findUnique({ where: { id }, select: employeeSelect });
  if (!employee) throw new HttpError(404, "Employee not found");
  return employee;
}

export async function listEmployees(query: EmployeeListQuery) {
  const where: Prisma.EmployeeWhereInput = {
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.employmentStatus ? { employmentStatus: query.employmentStatus } : {}),
    ...(query.roleName || query.isActive !== undefined
      ? {
          user: {
            ...(query.roleName ? { role: { name: query.roleName } } : {}),
            ...(query.isActive === undefined ? {} : { isActive: query.isActive })
          }
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { employeeCode: { contains: query.search, mode: "insensitive" } },
            { firstName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [employees, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      select: employeeSelect,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    }),
    prisma.employee.count({ where })
  ]);

  return {
    employees,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize))
    }
  };
}

export function getEmployee(id: string) {
  return getEmployeeOrThrow(id);
}

export async function getEmployeeOptions() {
  const [departments, roles, managers] = await Promise.all([
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.role.findMany({
      where: { name: { in: [...assignableRoleNames] } },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" }
    }),
    prisma.employee.findMany({
      where: {
        user: {
          isActive: true,
          role: { name: { in: ["MANAGER", "HR_ADMIN", "SUPER_ADMIN"] } }
        }
      },
      select: { id: true, employeeCode: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
    })
  ]);

  return { departments, roles, managers };
}

export async function createEmployee(input: CreateEmployeeInput) {
  const [{ role }, duplicate] = await Promise.all([
    getDepartmentAndRole(input.departmentId, input.roleName),
    prisma.employee.findFirst({
      where: { OR: [{ email: input.email }, { employeeCode: input.employeeCode }] },
      select: { email: true, employeeCode: true }
    }),
    validateManager(input.managerId)
  ]);

  if (duplicate?.email === input.email) throw new HttpError(409, "An employee with this email already exists");
  if (duplicate?.employeeCode === input.employeeCode) {
    throw new HttpError(409, "This employee code is already in use");
  }

  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) throw new HttpError(409, "A user with this email already exists");

  const temporaryPassword = `Ta1!${randomBytes(12).toString("base64url")}`;
  const passwordHash = await bcrypt.hash(temporaryPassword, passwordSaltRounds);

  const employee = await prisma.$transaction(async (transaction) => {
    const createdEmployee = await transaction.employee.create({
      data: {
        employeeCode: input.employeeCode,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        departmentId: input.departmentId,
        designation: input.designation,
        managerId: input.managerId,
        joiningDate: input.joiningDate,
        employmentStatus: input.employmentStatus
      }
    });

    await transaction.user.create({
      data: {
        email: input.email,
        passwordHash,
        roleId: role.id,
        employeeId: createdEmployee.id,
        mustChangePassword: true
      }
    });

    return transaction.employee.findUniqueOrThrow({
      where: { id: createdEmployee.id },
      select: employeeSelect
    });
  });

  return { employee, temporaryPassword };
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput) {
  const current = await getEmployeeOrThrow(id);
  if (current.user?.role.name === "SUPER_ADMIN") {
    throw new HttpError(403, "SUPER_ADMIN accounts cannot be changed through Employee Management");
  }

  const departmentId = input.departmentId ?? current.department.id;
  const roleName = input.roleName ?? current.user?.role.name;
  if (!roleName) throw new HttpError(400, "Employee user account is missing a role");

  const [{ role }] = await Promise.all([
    getDepartmentAndRole(departmentId, roleName),
    validateManager(input.managerId, id)
  ]);

  await prisma.$transaction(async (transaction) => {
    await transaction.employee.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        departmentId: input.departmentId,
        designation: input.designation,
        managerId: input.managerId,
        joiningDate: input.joiningDate,
        employmentStatus: input.employmentStatus
      }
    });

    if (current.user) {
      await transaction.user.update({ where: { id: current.user.id }, data: { roleId: role.id } });
    }
  });

  return getEmployeeOrThrow(id);
}

export async function updateEmployeeAccountStatus(id: string, isActive: boolean) {
  const current = await getEmployeeOrThrow(id);
  if (!current.user) throw new HttpError(400, "Employee does not have a user account");
  if (current.user.role.name === "SUPER_ADMIN") {
    throw new HttpError(403, "SUPER_ADMIN accounts cannot be deactivated through Employee Management");
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: current.user.id }, data: { isActive } }),
    prisma.employee.update({
      where: { id },
      data: { employmentStatus: isActive ? "ACTIVE" : "INACTIVE" }
    })
  ]);

  return getEmployeeOrThrow(id);
}
