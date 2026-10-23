-- CreateEnum
CREATE TYPE "Quarter" AS ENUM ('Q1', 'Q2', 'Q3', 'Q4');
CREATE TYPE "QuarterlyReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'MANAGER_REVIEWED', 'RETURNED', 'FINALIZED');
CREATE TYPE "KpiUnitType" AS ENUM ('NUMBER', 'PERCENTAGE', 'BOOLEAN', 'RATING', 'TEXT');
CREATE TYPE "QuarterlyReportAction" AS ENUM ('CREATED', 'UPDATED', 'SUBMITTED', 'RETURNED', 'MANAGER_REVIEWED', 'FINALIZED');

-- CreateTable
CREATE TABLE "Kpi" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT,
    "isCommon" BOOLEAN NOT NULL DEFAULT false,
    "unitType" "KpiUnitType" NOT NULL,
    "weightage" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Kpi_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Kpi_weightage_check" CHECK ("weightage" >= 0 AND "weightage" <= 100),
    CONSTRAINT "Kpi_scope_check" CHECK (("isCommon" = true AND "departmentId" IS NULL) OR ("isCommon" = false AND "departmentId" IS NOT NULL))
);

CREATE TABLE "PerformanceRatingRange" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minScore" DECIMAL(5,2) NOT NULL,
    "maxScore" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "PerformanceRatingRange_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PerformanceRatingRange_scores_check" CHECK ("minScore" >= 0 AND "maxScore" <= 100 AND "minScore" <= "maxScore")
);

CREATE TABLE "QuarterlyReport" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "quarter" "Quarter" NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "QuarterlyReportStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT NOT NULL,
    "majorAchievements" TEXT NOT NULL,
    "majorChallenges" TEXT NOT NULL,
    "nextQuarterFocus" TEXT NOT NULL,
    "employeeComments" TEXT,
    "managerComments" TEXT,
    "hrComments" TEXT,
    "monthlyReport1Id" TEXT,
    "monthlyReport2Id" TEXT,
    "monthlyReport3Id" TEXT,
    "employeeSubmittedAt" TIMESTAMPTZ(3),
    "managerReviewedAt" TIMESTAMPTZ(3),
    "hrReviewedAt" TIMESTAMPTZ(3),
    "finalizedAt" TIMESTAMPTZ(3),
    "managerReviewedById" TEXT,
    "hrReviewedById" TEXT,
    "overallScore" DECIMAL(5,2),
    "finalRating" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "QuarterlyReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "QuarterlyReport_year_check" CHECK ("year" BETWEEN 2000 AND 2200),
    CONSTRAINT "QuarterlyReport_overall_score_check" CHECK ("overallScore" IS NULL OR ("overallScore" >= 0 AND "overallScore" <= 100))
);

CREATE TABLE "QuarterlyKpiScore" (
    "id" TEXT NOT NULL,
    "quarterlyReportId" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "targetValue" TEXT,
    "actualValue" TEXT,
    "score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "weightageSnapshot" DECIMAL(5,2) NOT NULL,
    "weightedScore" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "managerComment" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "QuarterlyKpiScore_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "QuarterlyKpiScore_score_check" CHECK ("score" >= 0 AND "score" <= 100),
    CONSTRAINT "QuarterlyKpiScore_weightage_check" CHECK ("weightageSnapshot" >= 0 AND "weightageSnapshot" <= 100),
    CONSTRAINT "QuarterlyKpiScore_weighted_score_check" CHECK ("weightedScore" >= 0 AND "weightedScore" <= 100)
);

CREATE TABLE "QuarterlyReportActionHistory" (
    "id" TEXT NOT NULL,
    "quarterlyReportId" TEXT NOT NULL,
    "action" "QuarterlyReportAction" NOT NULL,
    "performedByUserId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuarterlyReportActionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kpi_code_key" ON "Kpi"("code");
CREATE INDEX "Kpi_departmentId_isActive_sortOrder_idx" ON "Kpi"("departmentId", "isActive", "sortOrder");
CREATE INDEX "Kpi_isCommon_isActive_idx" ON "Kpi"("isCommon", "isActive");
CREATE UNIQUE INDEX "PerformanceRatingRange_name_key" ON "PerformanceRatingRange"("name");
CREATE INDEX "PerformanceRatingRange_isActive_sortOrder_idx" ON "PerformanceRatingRange"("isActive", "sortOrder");
CREATE UNIQUE INDEX "QuarterlyReport_employeeId_quarter_year_key" ON "QuarterlyReport"("employeeId", "quarter", "year");
CREATE INDEX "QuarterlyReport_status_year_quarter_idx" ON "QuarterlyReport"("status", "year", "quarter");
CREATE INDEX "QuarterlyReport_monthlyReport1Id_idx" ON "QuarterlyReport"("monthlyReport1Id");
CREATE INDEX "QuarterlyReport_monthlyReport2Id_idx" ON "QuarterlyReport"("monthlyReport2Id");
CREATE INDEX "QuarterlyReport_monthlyReport3Id_idx" ON "QuarterlyReport"("monthlyReport3Id");
CREATE INDEX "QuarterlyReport_managerReviewedById_idx" ON "QuarterlyReport"("managerReviewedById");
CREATE INDEX "QuarterlyReport_hrReviewedById_idx" ON "QuarterlyReport"("hrReviewedById");
CREATE UNIQUE INDEX "QuarterlyKpiScore_quarterlyReportId_kpiId_key" ON "QuarterlyKpiScore"("quarterlyReportId", "kpiId");
CREATE INDEX "QuarterlyKpiScore_kpiId_idx" ON "QuarterlyKpiScore"("kpiId");
CREATE INDEX "QuarterlyReportActionHistory_quarterlyReportId_createdAt_idx" ON "QuarterlyReportActionHistory"("quarterlyReportId", "createdAt");
CREATE INDEX "QuarterlyReportActionHistory_performedByUserId_idx" ON "QuarterlyReportActionHistory"("performedByUserId");

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuarterlyReport" ADD CONSTRAINT "QuarterlyReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuarterlyReport" ADD CONSTRAINT "QuarterlyReport_monthlyReport1Id_fkey" FOREIGN KEY ("monthlyReport1Id") REFERENCES "MonthlyReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuarterlyReport" ADD CONSTRAINT "QuarterlyReport_monthlyReport2Id_fkey" FOREIGN KEY ("monthlyReport2Id") REFERENCES "MonthlyReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuarterlyReport" ADD CONSTRAINT "QuarterlyReport_monthlyReport3Id_fkey" FOREIGN KEY ("monthlyReport3Id") REFERENCES "MonthlyReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuarterlyReport" ADD CONSTRAINT "QuarterlyReport_managerReviewedById_fkey" FOREIGN KEY ("managerReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuarterlyReport" ADD CONSTRAINT "QuarterlyReport_hrReviewedById_fkey" FOREIGN KEY ("hrReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuarterlyKpiScore" ADD CONSTRAINT "QuarterlyKpiScore_quarterlyReportId_fkey" FOREIGN KEY ("quarterlyReportId") REFERENCES "QuarterlyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuarterlyKpiScore" ADD CONSTRAINT "QuarterlyKpiScore_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuarterlyReportActionHistory" ADD CONSTRAINT "QuarterlyReportActionHistory_quarterlyReportId_fkey" FOREIGN KEY ("quarterlyReportId") REFERENCES "QuarterlyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuarterlyReportActionHistory" ADD CONSTRAINT "QuarterlyReportActionHistory_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep quarterly and scoring data behind the trusted Express backend.
ALTER TABLE "Kpi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceRatingRange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuarterlyReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuarterlyKpiScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuarterlyReportActionHistory" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "Kpi" FROM anon, authenticated;
REVOKE ALL ON TABLE "PerformanceRatingRange" FROM anon, authenticated;
REVOKE ALL ON TABLE "QuarterlyReport" FROM anon, authenticated;
REVOKE ALL ON TABLE "QuarterlyKpiScore" FROM anon, authenticated;
REVOKE ALL ON TABLE "QuarterlyReportActionHistory" FROM anon, authenticated;
