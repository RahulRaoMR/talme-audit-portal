import { Router } from "express";
import {
  create,
  index,
  options,
  show,
  update,
  updateStatus
} from "../controllers/employee.controller.js";
import {
  authenticate,
  requirePasswordChanged,
  requireRole
} from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createEmployeeSchema,
  employeeIdParamsSchema,
  employeeListQuerySchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema
} from "../utils/employeeSchemas.js";

export const employeeRouter = Router();

employeeRouter.use(authenticate, requirePasswordChanged, requireRole("SUPER_ADMIN", "HR_ADMIN"));
employeeRouter.get("/options", options);
employeeRouter.get("/", validate(employeeListQuerySchema, "query"), index);
employeeRouter.get("/:id", validate(employeeIdParamsSchema, "params"), show);
employeeRouter.post("/", validate(createEmployeeSchema), create);
employeeRouter.patch("/:id", validate(employeeIdParamsSchema, "params"), validate(updateEmployeeSchema), update);
employeeRouter.patch(
  "/:id/status",
  validate(employeeIdParamsSchema, "params"),
  validate(updateEmployeeStatusSchema),
  updateStatus
);
