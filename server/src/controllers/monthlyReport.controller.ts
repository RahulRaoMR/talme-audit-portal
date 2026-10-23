import {
  addMonthlyReportAttachments,
  approveMonthlyReport,
  createMonthlyReport,
  getCurrentMonthlyReport,
  getMonthlyReport,
  getMonthlyReportAttachment,
  listMonthlyReports,
  removeMonthlyReportAttachment,
  returnMonthlyReport,
  submitMonthlyReport,
  updateMonthlyReport
} from "../services/monthlyReport.service.js";
import type {
  CreateMonthlyReportInput,
  MonthlyReportListQuery,
  MonthlyReportReviewInput,
  UpdateMonthlyReportInput
} from "../utils/monthlyReportSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const index = asyncHandler(async (req, res) => {
  res.json(await listMonthlyReports(req.auth!, req.query as unknown as MonthlyReportListQuery));
});

export const current = asyncHandler(async (req, res) => {
  res.json({ report: await getCurrentMonthlyReport(req.auth!) });
});

export const show = asyncHandler(async (req, res) => {
  res.json({ report: await getMonthlyReport(req.auth!, req.params.id) });
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json({
    report: await createMonthlyReport(req.auth!, req.body as CreateMonthlyReportInput)
  });
});

export const update = asyncHandler(async (req, res) => {
  res.json({
    report: await updateMonthlyReport(req.auth!, req.params.id, req.body as UpdateMonthlyReportInput)
  });
});

export const submit = asyncHandler(async (req, res) => {
  res.json({ report: await submitMonthlyReport(req.auth!, req.params.id) });
});

export const approve = asyncHandler(async (req, res) => {
  const input = req.body as MonthlyReportReviewInput;
  res.json({ report: await approveMonthlyReport(req.auth!, req.params.id, input.comment) });
});

export const returnForChanges = asyncHandler(async (req, res) => {
  const input = req.body as MonthlyReportReviewInput;
  res.json({ report: await returnMonthlyReport(req.auth!, req.params.id, input.comment) });
});

export const uploadAttachments = asyncHandler(async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  res.status(201).json({
    report: await addMonthlyReportAttachments(req.auth!, req.params.id, files)
  });
});

export const downloadAttachment = asyncHandler(async (req, res) => {
  const { attachment, filePath } = await getMonthlyReportAttachment(
    req.auth!,
    req.params.id,
    req.params.attachmentId
  );
  res.type(attachment.mimeType);
  res.download(filePath, attachment.originalName);
});

export const deleteAttachment = asyncHandler(async (req, res) => {
  res.json({
    report: await removeMonthlyReportAttachment(
      req.auth!,
      req.params.id,
      req.params.attachmentId
    )
  });
});

