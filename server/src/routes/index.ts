import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { employeeRouter } from "./employee.routes.js";
import { monthlyReportRouter } from "./monthlyReport.routes.js";
import { kpiRouter } from "./kpi.routes.js";
import { performanceRatingRouter } from "./performanceRating.routes.js";
import { quarterlyReportRouter } from "./quarterlyReport.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/employees", employeeRouter);
apiRouter.use("/monthly-reports", monthlyReportRouter);
apiRouter.use("/kpis", kpiRouter);
apiRouter.use("/performance-rating-ranges", performanceRatingRouter);
apiRouter.use("/quarterly-reports", quarterlyReportRouter);
