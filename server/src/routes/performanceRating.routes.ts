import { Router } from "express";
import { ratingCreate, ratingIndex, ratingUpdate } from "../controllers/kpi.controller.js";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { quarterlyIdParamsSchema, ratingRangeSchema } from "../utils/quarterlyReportSchemas.js";

export const performanceRatingRouter = Router();
performanceRatingRouter.use(authenticate, requirePasswordChanged, requireRole("SUPER_ADMIN", "HR_ADMIN"));
performanceRatingRouter.get("/", ratingIndex);
performanceRatingRouter.post("/", validate(ratingRangeSchema), ratingCreate);
performanceRatingRouter.patch("/:id", validate(quarterlyIdParamsSchema, "params"), validate(ratingRangeSchema), ratingUpdate);

