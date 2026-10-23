import {
  createKpi,
  createRatingRange,
  getDepartmentKpis,
  getKpi,
  listKpis,
  listRatingRanges,
  updateKpi,
  updateKpiStatus,
  updateRatingRange
} from "../services/kpi.service.js";
import type { CreateKpiInput, RatingRangeInput, UpdateKpiInput } from "../utils/quarterlyReportSchemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const index = asyncHandler(async (_req, res) => { res.json(await listKpis()); });
export const show = asyncHandler(async (req, res) => { res.json({ kpi: await getKpi(req.params.id) }); });
export const create = asyncHandler(async (req, res) => { res.status(201).json({ kpi: await createKpi(req.body as CreateKpiInput) }); });
export const update = asyncHandler(async (req, res) => { res.json({ kpi: await updateKpi(req.params.id, req.body as UpdateKpiInput) }); });
export const updateStatus = asyncHandler(async (req, res) => { res.json({ kpi: await updateKpiStatus(req.params.id, (req.body as { isActive: boolean }).isActive) }); });
export const department = asyncHandler(async (req, res) => { res.json({ kpis: await getDepartmentKpis(req.params.departmentId) }); });
export const ratingIndex = asyncHandler(async (_req, res) => { res.json({ ranges: await listRatingRanges() }); });
export const ratingCreate = asyncHandler(async (req, res) => { res.status(201).json({ range: await createRatingRange(req.body as RatingRangeInput) }); });
export const ratingUpdate = asyncHandler(async (req, res) => { res.json({ range: await updateRatingRange(req.params.id, req.body as RatingRangeInput) }); });
