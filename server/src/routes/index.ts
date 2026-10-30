import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { employeeRouter } from "./employee.routes.js";
import { monthlyReportRouter } from "./monthlyReport.routes.js";
import { kpiRouter } from "./kpi.routes.js";
import { performanceRatingRouter } from "./performanceRating.routes.js";
import { quarterlyReportRouter } from "./quarterlyReport.routes.js";
import { prisma } from "../config/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { auditRouter, notificationRouter } from "./audit.routes.js";
import { riskRouter } from "./risk.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", asyncHandler(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", database: "connected" });
}));

apiRouter.use("/auth", authRouter);
apiRouter.use("/audits", auditRouter);
apiRouter.use("/risks", riskRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/employees", employeeRouter);
apiRouter.use("/monthly-reports", monthlyReportRouter);
apiRouter.use("/kpis", kpiRouter);
apiRouter.use("/performance-rating-ranges", performanceRatingRouter);
apiRouter.use("/quarterly-reports", quarterlyReportRouter);
