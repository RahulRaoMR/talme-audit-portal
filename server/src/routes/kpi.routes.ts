import { Router } from "express";
import { create, department, index, show, update, updateStatus } from "../controllers/kpi.controller.js";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { createKpiSchema, quarterlyIdParamsSchema, updateKpiSchema, updateKpiStatusSchema } from "../utils/quarterlyReportSchemas.js";

export const kpiRouter = Router();
kpiRouter.use(authenticate, requirePasswordChanged, requireRole("SUPER_ADMIN", "HR_ADMIN"));
kpiRouter.get("/", index);
kpiRouter.get("/department/:departmentId", department);
kpiRouter.get("/:id", validate(quarterlyIdParamsSchema, "params"), show);
kpiRouter.post("/", validate(createKpiSchema), create);
kpiRouter.patch("/:id", validate(quarterlyIdParamsSchema, "params"), validate(updateKpiSchema), update);
kpiRouter.patch("/:id/status", validate(quarterlyIdParamsSchema, "params"), validate(updateKpiStatusSchema), updateStatus);

