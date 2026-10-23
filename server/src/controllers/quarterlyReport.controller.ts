import {
  createQuarterlyReport,
  finalizeQuarterlyReport,
  getCurrentQuarterlyReport,
  getQuarterlyPreview,
  getQuarterlyReport,
  listQuarterlyReports,
  returnQuarterlyReport,
  saveManagerReview,
  submitQuarterlyReport,
  updateQuarterlyReport
} from "../services/quarterlyReport.service.js";
import type {
  CreateQuarterlyReportInput,
  ManagerReviewInput,
  QuarterlyReportListQuery,
  QuarterlyPreviewQuery,
  UpdateQuarterlyReportInput
} from "../utils/quarterlyReportSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const index = asyncHandler(async (req, res) => {
  res.json(await listQuarterlyReports(req.auth!, req.query as unknown as QuarterlyReportListQuery));
});
export const current = asyncHandler(async (req, res) => {
  res.json({ report: await getCurrentQuarterlyReport(req.auth!) });
});
export const preview = asyncHandler(async (req, res) => {
  res.json({ monthlyReports: await getQuarterlyPreview(req.auth!, req.query as unknown as QuarterlyPreviewQuery) });
});
export const show = asyncHandler(async (req, res) => {
  res.json({ report: await getQuarterlyReport(req.auth!, req.params.id) });
});
export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ report: await createQuarterlyReport(req.auth!, req.body as CreateQuarterlyReportInput) });
});
export const update = asyncHandler(async (req, res) => {
  res.json({ report: await updateQuarterlyReport(req.auth!, req.params.id, req.body as UpdateQuarterlyReportInput) });
});
export const submit = asyncHandler(async (req, res) => {
  res.json({ report: await submitQuarterlyReport(req.auth!, req.params.id) });
});
export const saveReview = asyncHandler(async (req, res) => {
  res.json({ report: await saveManagerReview(req.auth!, req.params.id, req.body as ManagerReviewInput, false) });
});
export const managerReview = asyncHandler(async (req, res) => {
  res.json({ report: await saveManagerReview(req.auth!, req.params.id, req.body as ManagerReviewInput, true) });
});
export const returnForChanges = asyncHandler(async (req, res) => {
  res.json({ report: await returnQuarterlyReport(req.auth!, req.params.id, (req.body as { comment: string }).comment) });
});
export const finalize = asyncHandler(async (req, res) => {
  res.json({ report: await finalizeQuarterlyReport(req.auth!, req.params.id, (req.body as { hrComments: string }).hrComments) });
});
