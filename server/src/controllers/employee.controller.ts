import {
  createEmployee,
  getEmployee,
  getEmployeeOptions,
  listEmployees,
  updateEmployee,
  updateEmployeeAccountStatus
} from "../services/employee.service.js";
import type {
  CreateEmployeeInput,
  EmployeeListQuery,
  UpdateEmployeeInput,
  UpdateEmployeeStatusInput
} from "../utils/employeeSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const index = asyncHandler(async (req, res) => {
  res.json(await listEmployees(req.query as unknown as EmployeeListQuery));
});

export const show = asyncHandler(async (req, res) => {
  res.json({ employee: await getEmployee(req.params.id) });
});

export const options = asyncHandler(async (_req, res) => {
  res.json(await getEmployeeOptions());
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await createEmployee(req.body as CreateEmployeeInput));
});

export const update = asyncHandler(async (req, res) => {
  res.json({ employee: await updateEmployee(req.params.id, req.body as UpdateEmployeeInput) });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const input = req.body as UpdateEmployeeStatusInput;
  res.json({ employee: await updateEmployeeAccountStatus(req.params.id, input.isActive) });
});
