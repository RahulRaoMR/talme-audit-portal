-- CreateEnum
CREATE TYPE "MonthlyReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED');
CREATE TYPE "MonthlyReportAction" AS ENUM ('CREATED', 'UPDATED', 'SUBMITTED', 'RETURNED', 'RESUBMITTED', 'APPROVED', 'ATTACHMENT_ADDED', 'ATTACHMENT_REMOVED');

-- CreateTable
CREATE TABLE "MonthlyReport" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "reportPeriod" TEXT NOT NULL,
    "status" "MonthlyReportStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT NOT NULL,
    "achievements" TEXT NOT NULL,
    "challenges" TEXT NOT NULL,
    "pendingWork" TEXT NOT NULL,
    "nextMonthPlan" TEXT NOT NULL,
    "employeeComments" TEXT,
    "managerComments" TEXT,
    "submittedAt" TIMESTAMPTZ(3),
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "MonthlyReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrMonthlyReportDetail" (
    "id" TEXT NOT NULL,
    "monthlyReportId" TEXT NOT NULL,
    "openPositions" INTEGER NOT NULL DEFAULT 0,
    "positionsClosed" INTEGER NOT NULL DEFAULT 0,
    "candidatesInterviewed" INTEGER NOT NULL DEFAULT 0,
    "employeesOnboarded" INTEGER NOT NULL DEFAULT 0,
    "documentsCompleted" INTEGER NOT NULL DEFAULT 0,
    "documentsPending" INTEGER NOT NULL DEFAULT 0,
    "employeeIssuesResolved" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    CONSTRAINT "HrMonthlyReportDetail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperMonthlyReportDetail" (
    "id" TEXT NOT NULL,
    "monthlyReportId" TEXT NOT NULL,
    "tasksAssigned" INTEGER NOT NULL DEFAULT 0,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "tasksPending" INTEGER NOT NULL DEFAULT 0,
    "bugsAssigned" INTEGER NOT NULL DEFAULT 0,
    "bugsResolved" INTEGER NOT NULL DEFAULT 0,
    "projectsWorkedOn" INTEGER NOT NULL DEFAULT 0,
    "deploymentsCompleted" INTEGER NOT NULL DEFAULT 0,
    "onTimeDeliveryPercent" DOUBLE PRECISION,
    "remarks" TEXT,
    CONSTRAINT "DeveloperMonthlyReportDetail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollMonthlyReportDetail" (
    "id" TEXT NOT NULL,
    "monthlyReportId" TEXT NOT NULL,
    "employeesProcessed" INTEGER NOT NULL DEFAULT 0,
    "payrollCompleted" INTEGER NOT NULL DEFAULT 0,
    "payrollErrors" INTEGER NOT NULL DEFAULT 0,
    "correctionsRequired" INTEGER NOT NULL DEFAULT 0,
    "payslipsGenerated" INTEGER NOT NULL DEFAULT 0,
    "payslipsPending" INTEGER NOT NULL DEFAULT 0,
    "employeeQueries" INTEGER NOT NULL DEFAULT 0,
    "queriesResolved" INTEGER NOT NULL DEFAULT 0,
    "pfStatus" TEXT NOT NULL,
    "esiStatus" TEXT NOT NULL,
    "tdsStatus" TEXT NOT NULL,
    "remarks" TEXT,
    CONSTRAINT "PayrollMonthlyReportDetail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyReportAttachment" (
    "id" TEXT NOT NULL,
    "monthlyReportId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthlyReportAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyReportActionHistory" (
    "id" TEXT NOT NULL,
    "monthlyReportId" TEXT NOT NULL,
    "action" "MonthlyReportAction" NOT NULL,
    "performedByUserId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonthlyReportActionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyReport_employeeId_month_year_key" ON "MonthlyReport"("employeeId", "month", "year");
CREATE INDEX "MonthlyReport_status_year_month_idx" ON "MonthlyReport"("status", "year", "month");
CREATE INDEX "MonthlyReport_reviewedById_idx" ON "MonthlyReport"("reviewedById");
CREATE UNIQUE INDEX "HrMonthlyReportDetail_monthlyReportId_key" ON "HrMonthlyReportDetail"("monthlyReportId");
CREATE UNIQUE INDEX "DeveloperMonthlyReportDetail_monthlyReportId_key" ON "DeveloperMonthlyReportDetail"("monthlyReportId");
CREATE UNIQUE INDEX "PayrollMonthlyReportDetail_monthlyReportId_key" ON "PayrollMonthlyReportDetail"("monthlyReportId");
CREATE UNIQUE INDEX "MonthlyReportAttachment_storedName_key" ON "MonthlyReportAttachment"("storedName");
CREATE INDEX "MonthlyReportAttachment_monthlyReportId_createdAt_idx" ON "MonthlyReportAttachment"("monthlyReportId", "createdAt");
CREATE INDEX "MonthlyReportAttachment_uploadedById_idx" ON "MonthlyReportAttachment"("uploadedById");
CREATE INDEX "MonthlyReportActionHistory_monthlyReportId_createdAt_idx" ON "MonthlyReportActionHistory"("monthlyReportId", "createdAt");
CREATE INDEX "MonthlyReportActionHistory_performedByUserId_idx" ON "MonthlyReportActionHistory"("performedByUserId");

-- AddForeignKey
ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HrMonthlyReportDetail" ADD CONSTRAINT "HrMonthlyReportDetail_monthlyReportId_fkey" FOREIGN KEY ("monthlyReportId") REFERENCES "MonthlyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperMonthlyReportDetail" ADD CONSTRAINT "DeveloperMonthlyReportDetail_monthlyReportId_fkey" FOREIGN KEY ("monthlyReportId") REFERENCES "MonthlyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollMonthlyReportDetail" ADD CONSTRAINT "PayrollMonthlyReportDetail_monthlyReportId_fkey" FOREIGN KEY ("monthlyReportId") REFERENCES "MonthlyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyReportAttachment" ADD CONSTRAINT "MonthlyReportAttachment_monthlyReportId_fkey" FOREIGN KEY ("monthlyReportId") REFERENCES "MonthlyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyReportAttachment" ADD CONSTRAINT "MonthlyReportAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MonthlyReportActionHistory" ADD CONSTRAINT "MonthlyReportActionHistory_monthlyReportId_fkey" FOREIGN KEY ("monthlyReportId") REFERENCES "MonthlyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthlyReportActionHistory" ADD CONSTRAINT "MonthlyReportActionHistory_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep report data behind the trusted Express backend.
ALTER TABLE "MonthlyReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HrMonthlyReportDetail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeveloperMonthlyReportDetail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollMonthlyReportDetail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MonthlyReportAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MonthlyReportActionHistory" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "MonthlyReport" FROM anon, authenticated;
REVOKE ALL ON TABLE "HrMonthlyReportDetail" FROM anon, authenticated;
REVOKE ALL ON TABLE "DeveloperMonthlyReportDetail" FROM anon, authenticated;
REVOKE ALL ON TABLE "PayrollMonthlyReportDetail" FROM anon, authenticated;
REVOKE ALL ON TABLE "MonthlyReportAttachment" FROM anon, authenticated;
REVOKE ALL ON TABLE "MonthlyReportActionHistory" FROM anon, authenticated;
