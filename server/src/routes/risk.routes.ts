import { Router } from "express";
import { unlink } from "node:fs/promises";
import { authenticate, requirePasswordChanged } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { uploadMonthlyReportAttachments } from "../config/monthlyReportUpload.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as schema from "../utils/riskSchemas.js";
import * as service from "../services/risk.service.js";

export const riskRouter = Router();
riskRouter.use(authenticate, requirePasswordChanged);
riskRouter.get("/options", asyncHandler(async (req, res) => { res.json(await service.riskOptions(req.auth!, typeof req.query.findingId === "string" ? req.query.findingId : undefined)); }));
riskRouter.get("/dashboard", asyncHandler(async (req, res) => { res.json(await service.riskDashboard(req.auth!)); }));
riskRouter.get("/configuration", asyncHandler(async (req, res) => { res.json(await service.getRiskConfiguration(req.auth!)); }));
riskRouter.put("/configuration", validate(schema.riskConfigurationSchema), asyncHandler(async (req, res) => { res.json(await service.saveRiskConfiguration(req.auth!, req.body)); }));
riskRouter.get("/evidence/:id", asyncHandler(async (req, res) => { const { file, filePath } = await service.getRiskEvidence(req.auth!, req.params.id); res.download(filePath, file.originalName); }));
riskRouter.get("/", validate(schema.riskQuerySchema, "query"), asyncHandler(async (req, res) => { res.json(await service.listRisks(req.auth!, req.query as unknown as schema.RiskQuery)); }));
riskRouter.post("/", validate(schema.riskInputSchema), asyncHandler(async (req, res) => { res.status(201).json({ risk: await service.createRisk(req.auth!, req.body) }); }));
riskRouter.post("/from-finding/:findingId", validate(schema.riskInputSchema), asyncHandler(async (req, res) => { res.status(201).json({ risk: await service.createRisk(req.auth!, { ...req.body, findingId: req.params.findingId }) }); }));
riskRouter.get("/:id", asyncHandler(async (req, res) => { res.json({ risk: await service.getRisk(req.auth!, req.params.id) }); }));
riskRouter.patch("/:id", validate(schema.riskUpdateSchema), asyncHandler(async (req, res) => { res.json({ risk: await service.updateRisk(req.auth!, req.params.id, req.body) }); }));
riskRouter.post("/:id/review", validate(schema.riskReviewSchema), asyncHandler(async (req, res) => { res.json({ risk: await service.reviewRisk(req.auth!, req.params.id, req.body) }); }));
for (const decision of ["close", "accept", "reopen"] as const) riskRouter.post(`/:id/${decision}`, validate(schema.riskDecisionSchema), asyncHandler(async (req, res) => { res.json({ risk: await service.decideRisk(req.auth!, req.params.id, decision.toUpperCase() as "CLOSE" | "ACCEPT" | "REOPEN", req.body) }); }));
riskRouter.post("/:id/comments", validate(schema.riskCommentSchema), asyncHandler(async (req, res) => { res.json({ risk: await service.addRiskComment(req.auth!, req.params.id, req.body.comment) }); }));
riskRouter.post("/:id/evidence", uploadMonthlyReportAttachments, asyncHandler(async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try { res.status(201).json({ risk: await service.addRiskEvidence(req.auth!, req.params.id, files) }); }
  catch (error) { await Promise.all(files.map((file) => unlink(file.path).catch(() => undefined))); throw error; }
}));
