import { Router } from "express";
import { fileURLToPath } from "node:url";
import { unlink } from "node:fs/promises";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { uploadMonthlyReportAttachments } from "../config/monthlyReportUpload.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as schema from "../utils/auditSchemas.js";
import * as service from "../services/audit.service.js";
import { exportAuditRegister } from "../services/auditExport.service.js";

export const auditRouter = Router();
auditRouter.use(authenticate, requirePasswordChanged);
auditRouter.get("/options", asyncHandler(async (req, res) => { res.json(await service.auditOptions(req.auth!)); }));
auditRouter.get("/dashboard", asyncHandler(async (req, res) => { res.json(await service.auditDashboard(req.auth!)); }));
auditRouter.get("/reference", asyncHandler(async (req, res) => { const actor = await service.actorFor(req.auth!); const importedAudit = await service.importedAuditFor(req.auth!); res.json({ filename: "TELME _LA_CAPA_Template_Ver2.xlsx", findings: service.canCreateAudit(actor) ? service.templateFindings : [], importedAudit, instructions: ["Auditors record RBA sections, references, ratings and findings.", "Auditees prepare CAPAs within two weeks after the final audit report.", "Typical implementation periods are 30, 60 or 90 days; priority findings need immediate containment.", "Use standard RCA or the 5 Why method to identify the root cause.", "The auditor reviews status, evidence and comments before closure."], complianceModules: ["Legal Register", "Training Register", "Training Effectiveness", "Management Review", "Organisation Chart / Responsibility Matrix"] }); }));
auditRouter.get("/template", requireRole("AUDITOR", "HR_ADMIN", "SUPER_ADMIN"), (_req, res) => { res.download(fileURLToPath(service.templateFilePath), "TELME_LA_CAPA_Template_Ver2.xlsx"); });
auditRouter.post("/import-template", asyncHandler(async (req, res) => { res.status(201).json({ audit: await service.importTemplate(req.auth!, typeof req.body.auditId === "string" ? req.body.auditId : undefined) }); }));
auditRouter.get("/exports/:kind", validate(schema.registerQuerySchema, "query"), asyncHandler(async (req, res) => { const output = await exportAuditRegister(req.auth!, req.params.kind, req.query as unknown as schema.RegisterQuery); res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); res.setHeader("Content-Disposition", `attachment; filename="audit-${req.params.kind}.xlsx"`); res.send(output); }));
auditRouter.get("/capas", validate(schema.registerQuerySchema, "query"), asyncHandler(async (req, res) => { res.json(await service.listCapas(req.auth!, req.query as unknown as schema.RegisterQuery)); }));
auditRouter.get("/findings/:id", asyncHandler(async (req, res) => { res.json({ finding: await service.getFinding(req.auth!, req.params.id) }); }));
auditRouter.patch("/findings/:id", validate(schema.findingUpdateSchema), asyncHandler(async (req, res) => { res.json({ finding: await service.updateFinding(req.auth!, req.params.id, req.body) }); }));
auditRouter.post("/findings/:id/close", validate(schema.commentSchema), asyncHandler(async (req, res) => { res.json({ finding: await service.closeFinding(req.auth!, req.params.id, req.body.comment) }); }));
auditRouter.post("/findings/:id/reopen", validate(schema.commentSchema), asyncHandler(async (req, res) => { res.json({ finding: await service.reopenFinding(req.auth!, req.params.id, req.body.comment) }); }));
auditRouter.patch("/capas/:id", validate(schema.capaPlanSchema), asyncHandler(async (req, res) => { res.json({ finding: await service.saveCapaPlan(req.auth!, req.params.id, req.body) }); }));
auditRouter.post("/capas/:id/review", validate(schema.reviewSchema), asyncHandler(async (req, res) => { res.json({ finding: await service.transitionCapa(req.auth!, req.params.id, req.body.decision, req.body.comment) }); }));
auditRouter.post("/capas/:id/actions", validate(schema.actionInputSchema), asyncHandler(async (req, res) => { res.status(201).json({ finding: await service.addCapaAction(req.auth!, req.params.id, req.body) }); }));
auditRouter.patch("/actions/:id", validate(schema.actionUpdateSchema), asyncHandler(async (req, res) => { res.json({ finding: await service.updateCapaAction(req.auth!, req.params.id, req.body) }); }));
auditRouter.get("/evidence/:id", asyncHandler(async (req, res) => { const { evidence, filePath } = await service.getAuditEvidence(req.auth!, req.params.id); res.download(filePath, evidence.originalName); }));
auditRouter.post("/evidence/:id/review", validate(schema.evidenceReviewSchema), asyncHandler(async (req, res) => { res.json({ audit: await service.reviewAuditEvidence(req.auth!, req.params.id, req.body.reviewStatus, req.body.comment) }); }));
auditRouter.post("/ratings", validate(schema.ratingSchema), asyncHandler(async (req, res) => { res.json({ rating: await service.saveFindingRating(req.auth!, req.body) }); }));
auditRouter.get("/", validate(schema.registerQuerySchema, "query"), asyncHandler(async (req, res) => { res.json(await service.listAudits(req.auth!, req.query as unknown as schema.RegisterQuery)); }));
auditRouter.post("/", validate(schema.auditInputSchema), asyncHandler(async (req, res) => { res.status(201).json({ audit: await service.createAudit(req.auth!, req.body) }); }));
auditRouter.get("/:id", asyncHandler(async (req, res) => { res.json({ audit: await service.getAudit(req.auth!, req.params.id) }); }));
auditRouter.patch("/:id", validate(schema.auditUpdateSchema), asyncHandler(async (req, res) => { res.json({ audit: await service.updateAudit(req.auth!, req.params.id, req.body) }); }));
auditRouter.post("/:id/status", validate(schema.auditStatusSchema), asyncHandler(async (req, res) => { res.json({ audit: await service.changeAuditStatus(req.auth!, req.params.id, req.body.status, req.body.comment) }); }));
auditRouter.post("/:id/findings", validate(schema.findingInputSchema), asyncHandler(async (req, res) => { res.status(201).json({ finding: await service.createFinding(req.auth!, req.params.id, req.body) }); }));
auditRouter.post("/:id/comments", validate(schema.commentSchema), asyncHandler(async (req, res) => { res.json({ audit: await service.addAuditComment(req.auth!, req.params.id, req.body.comment, typeof req.body.findingId === "string" ? req.body.findingId : undefined) }); }));
auditRouter.post("/:id/evidence", uploadMonthlyReportAttachments, asyncHandler(async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try { const context = schema.evidenceContextSchema.parse(req.body); res.status(201).json({ audit: await service.addAuditEvidence(req.auth!, req.params.id, files, context) }); }
  catch (error) { await Promise.all(files.map((file) => unlink(file.path).catch(() => undefined))); throw error; }
}));

export const notificationRouter = Router();
notificationRouter.use(authenticate, requirePasswordChanged);
notificationRouter.get("/", asyncHandler(async (req, res) => { res.json(await service.listNotifications(req.auth!)); }));
notificationRouter.post("/:id/read", asyncHandler(async (req, res) => { res.json(await service.readNotification(req.auth!, req.params.id)); }));
