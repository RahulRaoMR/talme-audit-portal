BEGIN;
-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('OPEN', 'MITIGATION_IN_PROGRESS', 'MITIGATED', 'ACCEPTED', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MonthlyReportAction" ADD VALUE 'RISK_CREATED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'RISK_UPDATED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'RISK_SCORE_CHANGED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'RISK_MITIGATION_UPDATED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'RISK_OWNER_CHANGED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'RISK_STATUS_CHANGED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'RISK_REVIEWED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'RISK_CLOSED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'RISK_REOPENED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'RISK_SCORING_CONFIGURED';

-- AlterTable
ALTER TABLE "MonthlyReportAttachment" ADD COLUMN     "riskId" TEXT;

-- AlterTable
ALTER TABLE "MonthlyReportActionHistory" ADD COLUMN     "riskConfigurationId" TEXT,
ADD COLUMN     "riskId" TEXT;

-- CreateTable
CREATE TABLE "RiskScoringConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "levels" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RiskScoringConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "processActivity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "hazardSource" TEXT NOT NULL DEFAULT '',
    "potentialConsequence" TEXT NOT NULL DEFAULT '',
    "existingControls" TEXT NOT NULL DEFAULT '',
    "likelihood" INTEGER NOT NULL,
    "severity" INTEGER NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "additionalMitigation" TEXT NOT NULL DEFAULT '',
    "responsibleEmployeeId" TEXT NOT NULL,
    "targetDate" DATE,
    "completionDate" DATE,
    "residualLikelihood" INTEGER,
    "residualSeverity" INTEGER,
    "residualRiskScore" INTEGER,
    "status" "RiskStatus" NOT NULL DEFAULT 'OPEN',
    "reviewDate" DATE NOT NULL,
    "comments" TEXT NOT NULL DEFAULT '',
    "auditId" TEXT,
    "findingId" TEXT,
    "capaId" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "closedById" TEXT,
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiskScoringConfiguration_updatedById_idx" ON "RiskScoringConfiguration"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_reference_key" ON "RiskAssessment"("reference");

-- CreateIndex
CREATE INDEX "RiskAssessment_departmentId_status_idx" ON "RiskAssessment"("departmentId", "status");

-- CreateIndex
CREATE INDEX "RiskAssessment_responsibleEmployeeId_status_idx" ON "RiskAssessment"("responsibleEmployeeId", "status");

-- CreateIndex
CREATE INDEX "RiskAssessment_status_targetDate_idx" ON "RiskAssessment"("status", "targetDate");

-- CreateIndex
CREATE INDEX "RiskAssessment_status_reviewDate_idx" ON "RiskAssessment"("status", "reviewDate");

-- CreateIndex
CREATE INDEX "RiskAssessment_riskScore_idx" ON "RiskAssessment"("riskScore");

-- CreateIndex
CREATE INDEX "RiskAssessment_category_status_idx" ON "RiskAssessment"("category", "status");

-- CreateIndex
CREATE INDEX "RiskAssessment_auditId_idx" ON "RiskAssessment"("auditId");

-- CreateIndex
CREATE INDEX "RiskAssessment_findingId_idx" ON "RiskAssessment"("findingId");

-- CreateIndex
CREATE INDEX "RiskAssessment_capaId_idx" ON "RiskAssessment"("capaId");

-- CreateIndex
CREATE INDEX "RiskAssessment_createdById_idx" ON "RiskAssessment"("createdById");

-- CreateIndex
CREATE INDEX "RiskAssessment_reviewedById_idx" ON "RiskAssessment"("reviewedById");

-- CreateIndex
CREATE INDEX "RiskAssessment_closedById_idx" ON "RiskAssessment"("closedById");

-- CreateIndex
CREATE INDEX "RiskAssessment_createdAt_idx" ON "RiskAssessment"("createdAt");

-- CreateIndex
CREATE INDEX "MonthlyReportAttachment_riskId_createdAt_idx" ON "MonthlyReportAttachment"("riskId", "createdAt");

-- CreateIndex
CREATE INDEX "MonthlyReportActionHistory_riskId_createdAt_idx" ON "MonthlyReportActionHistory"("riskId", "createdAt");

-- CreateIndex
CREATE INDEX "MonthlyReportActionHistory_riskConfigurationId_createdAt_idx" ON "MonthlyReportActionHistory"("riskConfigurationId", "createdAt");

-- AddForeignKey
ALTER TABLE "MonthlyReportAttachment" ADD CONSTRAINT "MonthlyReportAttachment_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "RiskAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReportActionHistory" ADD CONSTRAINT "MonthlyReportActionHistory_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "RiskAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReportActionHistory" ADD CONSTRAINT "MonthlyReportActionHistory_riskConfigurationId_fkey" FOREIGN KEY ("riskConfigurationId") REFERENCES "RiskScoringConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScoringConfiguration" ADD CONSTRAINT "RiskScoringConfiguration_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_responsibleEmployeeId_fkey" FOREIGN KEY ("responsibleEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "InternalAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Extend shared evidence/history contexts without changing existing report/audit rows.
ALTER TABLE "MonthlyReportAttachment" DROP CONSTRAINT "attachment_context_check";
ALTER TABLE "MonthlyReportAttachment" ADD CONSTRAINT "attachment_context_check" CHECK (
  ("riskId" IS NULL AND (
    ("monthlyReportId" IS NOT NULL AND "auditId" IS NULL AND "findingId" IS NULL AND "capaId" IS NULL AND "actionItemId" IS NULL)
    OR ("monthlyReportId" IS NULL AND "auditId" IS NOT NULL)
  )) OR ("riskId" IS NOT NULL AND "monthlyReportId" IS NULL AND "auditId" IS NULL AND "findingId" IS NULL AND "capaId" IS NULL AND "actionItemId" IS NULL)
);
ALTER TABLE "MonthlyReportActionHistory" DROP CONSTRAINT "history_context_check";
ALTER TABLE "MonthlyReportActionHistory" ADD CONSTRAINT "history_context_check" CHECK (
  ("monthlyReportId" IS NOT NULL)::integer + ("auditId" IS NOT NULL)::integer + ("riskId" IS NOT NULL)::integer + ("riskConfigurationId" IS NOT NULL)::integer = 1
  AND (("riskId" IS NULL AND "riskConfigurationId" IS NULL) OR ("findingId" IS NULL AND "capaId" IS NULL))
);
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "risk_score_check" CHECK ("likelihood" BETWEEN 1 AND 5 AND "severity" BETWEEN 1 AND 5 AND "riskScore" = "likelihood" * "severity");
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "risk_residual_score_check" CHECK (
  ("residualLikelihood" IS NULL AND "residualSeverity" IS NULL AND "residualRiskScore" IS NULL)
  OR ("residualLikelihood" IS NOT NULL AND "residualSeverity" IS NOT NULL AND "residualRiskScore" IS NOT NULL AND "residualLikelihood" BETWEEN 1 AND 5 AND "residualSeverity" BETWEEN 1 AND 5 AND "residualRiskScore" = "residualLikelihood" * "residualSeverity")
);
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "risk_mitigation_target_check" CHECK (length(btrim("additionalMitigation")) = 0 OR "targetDate" IS NOT NULL);
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "risk_completion_check" CHECK ("status" NOT IN ('MITIGATED','CLOSED') OR ("completionDate" IS NOT NULL AND "residualRiskScore" IS NOT NULL AND length(btrim("additionalMitigation")) > 0));
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "risk_acceptance_check" CHECK ("status" <> 'ACCEPTED' OR "residualRiskScore" IS NOT NULL);
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "risk_closure_check" CHECK (("status" = 'CLOSED' AND "closedAt" IS NOT NULL AND "closedById" IS NOT NULL) OR ("status" <> 'CLOSED' AND "closedAt" IS NULL AND "closedById" IS NULL));
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "risk_source_context_check" CHECK (("capaId" IS NULL OR "findingId" IS NOT NULL) AND ("findingId" IS NULL OR "auditId" IS NOT NULL));
ALTER TABLE "RiskScoringConfiguration" ADD CONSTRAINT "risk_config_check" CHECK ("id" = 'default' AND "version" > 0 AND jsonb_typeof("levels") = 'array');

INSERT INTO "RiskScoringConfiguration" ("id","levels","version","updatedAt") VALUES ('default','[{"code":"LOW","label":"Low","minScore":1,"maxScore":4,"colour":"green"},{"code":"MEDIUM","label":"Medium","minScore":5,"maxScore":9,"colour":"amber"},{"code":"HIGH","label":"High","minScore":10,"maxScore":16,"colour":"orange"},{"code":"CRITICAL","label":"Critical","minScore":17,"maxScore":25,"colour":"red"}]'::jsonb,1,NOW());

DO $privacy$
DECLARE table_name text; api_role text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['RiskAssessment','RiskScoringConfiguration'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',table_name);
    FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
      EXECUTE format('REVOKE ALL ON TABLE %I FROM %I',table_name,api_role);
    END LOOP;
  END LOOP;
END;
$privacy$;
COMMIT;

