import { Router } from "express";
import { uploadMonthlyReportAttachments } from "../config/monthlyReportUpload.js";
import {
  approve,
  create,
  current,
  deleteAttachment,
  downloadAttachment,
  index,
  returnForChanges,
  show,
  submit,
  update,
  uploadAttachments
} from "../controllers/monthlyReport.controller.js";
import { authenticate, requirePasswordChanged } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createMonthlyReportSchema,
  monthlyReportAttachmentParamsSchema,
  monthlyReportIdParamsSchema,
  monthlyReportListQuerySchema,
  monthlyReportReturnSchema,
  monthlyReportReviewSchema,
  updateMonthlyReportSchema
} from "../utils/monthlyReportSchemas.js";

export const monthlyReportRouter = Router();

monthlyReportRouter.use(authenticate, requirePasswordChanged);
monthlyReportRouter.get("/", validate(monthlyReportListQuerySchema, "query"), index);
monthlyReportRouter.get("/current", current);
monthlyReportRouter.get("/:id", validate(monthlyReportIdParamsSchema, "params"), show);
monthlyReportRouter.post("/", validate(createMonthlyReportSchema), create);
monthlyReportRouter.patch(
  "/:id",
  validate(monthlyReportIdParamsSchema, "params"),
  validate(updateMonthlyReportSchema),
  update
);
monthlyReportRouter.post(
  "/:id/submit",
  validate(monthlyReportIdParamsSchema, "params"),
  submit
);
monthlyReportRouter.post(
  "/:id/approve",
  validate(monthlyReportIdParamsSchema, "params"),
  validate(monthlyReportReviewSchema),
  approve
);
monthlyReportRouter.post(
  "/:id/return",
  validate(monthlyReportIdParamsSchema, "params"),
  validate(monthlyReportReturnSchema),
  returnForChanges
);
monthlyReportRouter.post(
  "/:id/attachments",
  validate(monthlyReportIdParamsSchema, "params"),
  uploadMonthlyReportAttachments,
  uploadAttachments
);
monthlyReportRouter.get(
  "/:id/attachments/:attachmentId",
  validate(monthlyReportAttachmentParamsSchema, "params"),
  downloadAttachment
);
monthlyReportRouter.delete(
  "/:id/attachments/:attachmentId",
  validate(monthlyReportAttachmentParamsSchema, "params"),
  deleteAttachment
);

