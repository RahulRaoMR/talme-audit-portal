import { Router } from "express";
import {
  create,
  current,
  finalize,
  index,
  managerReview,
  preview,
  returnForChanges,
  saveReview,
  show,
  submit,
  update
} from "../controllers/quarterlyReport.controller.js";
import { authenticate, requirePasswordChanged } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createQuarterlyReportSchema,
  finalizeQuarterlySchema,
  managerReviewSchema,
  quarterlyIdParamsSchema,
  quarterlyPreviewQuerySchema,
  quarterlyReportListQuerySchema,
  returnQuarterlySchema,
  updateQuarterlyReportSchema
} from "../utils/quarterlyReportSchemas.js";

export const quarterlyReportRouter = Router();
quarterlyReportRouter.use(authenticate, requirePasswordChanged);
quarterlyReportRouter.get("/", validate(quarterlyReportListQuerySchema, "query"), index);
quarterlyReportRouter.get("/current", current);
quarterlyReportRouter.get("/preview", validate(quarterlyPreviewQuerySchema, "query"), preview);
quarterlyReportRouter.get("/:id", validate(quarterlyIdParamsSchema, "params"), show);
quarterlyReportRouter.post("/", validate(createQuarterlyReportSchema), create);
quarterlyReportRouter.patch("/:id", validate(quarterlyIdParamsSchema, "params"), validate(updateQuarterlyReportSchema), update);
quarterlyReportRouter.post("/:id/submit", validate(quarterlyIdParamsSchema, "params"), submit);
quarterlyReportRouter.post("/:id/return", validate(quarterlyIdParamsSchema, "params"), validate(returnQuarterlySchema), returnForChanges);
quarterlyReportRouter.post("/:id/manager-review/save", validate(quarterlyIdParamsSchema, "params"), validate(managerReviewSchema), saveReview);
quarterlyReportRouter.post("/:id/manager-review", validate(quarterlyIdParamsSchema, "params"), validate(managerReviewSchema), managerReview);
quarterlyReportRouter.post("/:id/finalize", validate(quarterlyIdParamsSchema, "params"), validate(finalizeQuarterlySchema), finalize);
