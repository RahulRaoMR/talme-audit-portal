BEGIN;
-- CreateEnum
CREATE TYPE "InternalAuditStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'AUDIT_COMPLETED', 'FINDINGS_ISSUED', 'CAPA_PENDING', 'CAPA_UNDER_REVIEW', 'VERIFICATION_PENDING', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditFindingStatus" AS ENUM ('OPEN', 'CAPA_PENDING', 'UNDER_REVIEW', 'ACTION_IN_PROGRESS', 'VERIFICATION_PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "CapaStatus" AS ENUM ('OPEN', 'RCA_PENDING', 'PREPARATION', 'SUBMITTED', 'UNDER_REVIEW', 'ACTION_IN_PROGRESS', 'VERIFICATION_PENDING', 'VERIFIED', 'CLOSED', 'RETURNED');

-- CreateEnum
CREATE TYPE "CapaActionType" AS ENUM ('CONTAINMENT', 'CORRECTIVE', 'PREVENTIVE');

-- CreateEnum
CREATE TYPE "CapaActionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'VERIFICATION_PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EvidenceReviewStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MonthlyReportAction" ADD VALUE 'AUDIT_CREATED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'AUDIT_UPDATED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'AUDIT_STATUS_CHANGED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'AUDITOR_ASSIGNED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'FINDING_CREATED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'FINDING_UPDATED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'FINDING_CLOSED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'CAPA_UPDATED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'CAPA_SUBMITTED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'CAPA_REVIEW_STARTED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'CAPA_ACCEPTED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'CAPA_RETURNED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'ACTION_CREATED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'ACTION_UPDATED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'ACTION_COMPLETED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'ACTION_VERIFIED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'ACTION_REJECTED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'EVIDENCE_REVIEWED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'VERIFICATION_REQUESTED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'CAPA_VERIFIED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'VERIFICATION_REJECTED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'COMMENT_ADDED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'AUDIT_CLOSED';
ALTER TYPE "MonthlyReportAction" ADD VALUE 'AUDIT_REOPENED';

-- AlterTable
ALTER TABLE "MonthlyReportAttachment" ADD COLUMN     "actionItemId" TEXT,
ADD COLUMN     "auditId" TEXT,
ADD COLUMN     "capaId" TEXT,
ADD COLUMN     "findingId" TEXT,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "reviewComment" TEXT,
ADD COLUMN     "reviewStatus" "EvidenceReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewedAt" TIMESTAMPTZ(3),
ADD COLUMN     "reviewedById" TEXT,
ALTER COLUMN "monthlyReportId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MonthlyReportActionHistory" ADD COLUMN     "auditId" TEXT,
ADD COLUMN     "capaId" TEXT,
ADD COLUMN     "findingId" TEXT,
ADD COLUMN     "newStatus" TEXT,
ADD COLUMN     "previousStatus" TEXT,
ALTER COLUMN "monthlyReportId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AuditCounter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AuditCounter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "FindingRating" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FindingRating_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "InternalAudit" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "auditorId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "auditDate" DATE,
    "scope" TEXT NOT NULL DEFAULT '',
    "auditType" TEXT NOT NULL DEFAULT 'INTERNAL',
    "location" TEXT NOT NULL DEFAULT '',
    "standardReference" TEXT NOT NULL DEFAULT 'RBA',
    "status" "InternalAuditStatus" NOT NULL DEFAULT 'DRAFT',
    "capaPreparationDueDate" DATE,
    "findingsIssuedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "findingSequence" INTEGER NOT NULL DEFAULT 0,
    "sourceDocument" TEXT,
    "sourceImportKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "InternalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTeamMember" (
    "auditId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AuditTeamMember_pkey" PRIMARY KEY ("auditId","userId")
);

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "rbaSection" TEXT NOT NULL,
    "rbaReference" TEXT NOT NULL,
    "ratingCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "responsibleEmployeeId" TEXT,
    "status" "AuditFindingStatus" NOT NULL DEFAULT 'OPEN',
    "sourceModule" TEXT,
    "sourceRecordId" TEXT,
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capa" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "status" "CapaStatus" NOT NULL DEFAULT 'OPEN',
    "rcaMethod" TEXT NOT NULL DEFAULT 'STANDARD',
    "rootCause" TEXT NOT NULL DEFAULT '',
    "problemStatement" TEXT NOT NULL DEFAULT '',
    "why1" TEXT NOT NULL DEFAULT '',
    "why2" TEXT NOT NULL DEFAULT '',
    "why3" TEXT NOT NULL DEFAULT '',
    "why4" TEXT NOT NULL DEFAULT '',
    "why5" TEXT NOT NULL DEFAULT '',
    "finalRootCause" TEXT NOT NULL DEFAULT '',
    "containmentAction" TEXT NOT NULL DEFAULT '',
    "correctiveAction" TEXT NOT NULL DEFAULT '',
    "preventiveAction" TEXT NOT NULL DEFAULT '',
    "dateEstablished" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" DATE,
    "targetDate" DATE,
    "implementationDays" INTEGER,
    "completionDate" DATE,
    "preparedById" TEXT,
    "reviewedById" TEXT,
    "verifiedById" TEXT,
    "closedById" TEXT,
    "submittedAt" TIMESTAMPTZ(3),
    "reviewedAt" TIMESTAMPTZ(3),
    "verifiedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "auditorStatus" TEXT NOT NULL DEFAULT 'NOT_REVIEWED',
    "auditorComments" TEXT NOT NULL DEFAULT '',
    "verificationResult" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Capa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaActionItem" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "actionType" "CapaActionType" NOT NULL,
    "description" TEXT NOT NULL,
    "ownerEmployeeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "targetDate" DATE NOT NULL,
    "completionDate" DATE,
    "status" "CapaActionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "comments" TEXT NOT NULL DEFAULT '',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CapaActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapaVerification" (
    "id" TEXT NOT NULL,
    "capaId" TEXT NOT NULL,
    "result" "EvidenceReviewStatus" NOT NULL,
    "comment" TEXT NOT NULL,
    "evidenceIds" JSONB NOT NULL DEFAULT '[]',
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapaVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalNotification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternalAudit_reference_key" ON "InternalAudit"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "InternalAudit_sourceImportKey_key" ON "InternalAudit"("sourceImportKey");

-- CreateIndex
CREATE INDEX "InternalAudit_departmentId_status_auditDate_idx" ON "InternalAudit"("departmentId", "status", "auditDate");

-- CreateIndex
CREATE INDEX "InternalAudit_auditorId_status_idx" ON "InternalAudit"("auditorId", "status");

-- CreateIndex
CREATE INDEX "InternalAudit_createdById_idx" ON "InternalAudit"("createdById");

-- CreateIndex
CREATE INDEX "InternalAudit_status_auditDate_idx" ON "InternalAudit"("status", "auditDate");

-- CreateIndex
CREATE INDEX "AuditTeamMember_userId_idx" ON "AuditTeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFinding_reference_key" ON "AuditFinding"("reference");

-- CreateIndex
CREATE INDEX "AuditFinding_auditId_status_idx" ON "AuditFinding"("auditId", "status");

-- CreateIndex
CREATE INDEX "AuditFinding_departmentId_status_idx" ON "AuditFinding"("departmentId", "status");

-- CreateIndex
CREATE INDEX "AuditFinding_responsibleEmployeeId_status_idx" ON "AuditFinding"("responsibleEmployeeId", "status");

-- CreateIndex
CREATE INDEX "AuditFinding_ratingCode_status_idx" ON "AuditFinding"("ratingCode", "status");

-- CreateIndex
CREATE INDEX "AuditFinding_sourceModule_sourceRecordId_idx" ON "AuditFinding"("sourceModule", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFinding_auditId_sourceModule_sourceRecordId_key" ON "AuditFinding"("auditId", "sourceModule", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Capa_reference_key" ON "Capa"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Capa_findingId_key" ON "Capa"("findingId");

-- CreateIndex
CREATE INDEX "Capa_status_targetDate_idx" ON "Capa"("status", "targetDate");

-- CreateIndex
CREATE INDEX "Capa_preparedById_idx" ON "Capa"("preparedById");

-- CreateIndex
CREATE INDEX "Capa_reviewedById_idx" ON "Capa"("reviewedById");

-- CreateIndex
CREATE INDEX "Capa_verifiedById_idx" ON "Capa"("verifiedById");

-- CreateIndex
CREATE INDEX "Capa_closedById_idx" ON "Capa"("closedById");

-- CreateIndex
CREATE INDEX "CapaActionItem_capaId_status_idx" ON "CapaActionItem"("capaId", "status");

-- CreateIndex
CREATE INDEX "CapaActionItem_ownerEmployeeId_status_targetDate_idx" ON "CapaActionItem"("ownerEmployeeId", "status", "targetDate");

-- CreateIndex
CREATE INDEX "CapaActionItem_departmentId_status_idx" ON "CapaActionItem"("departmentId", "status");

-- CreateIndex
CREATE INDEX "CapaActionItem_verifiedById_idx" ON "CapaActionItem"("verifiedById");

-- CreateIndex
CREATE INDEX "CapaActionItem_status_targetDate_idx" ON "CapaActionItem"("status", "targetDate");

-- CreateIndex
CREATE INDEX "CapaVerification_capaId_createdAt_idx" ON "CapaVerification"("capaId", "createdAt");

-- CreateIndex
CREATE INDEX "CapaVerification_performedById_idx" ON "CapaVerification"("performedById");

-- CreateIndex
CREATE INDEX "PortalNotification_recipientId_readAt_createdAt_idx" ON "PortalNotification"("recipientId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalNotification_recipientId_dedupeKey_key" ON "PortalNotification"("recipientId", "dedupeKey");

-- CreateIndex
CREATE INDEX "MonthlyReportAttachment_auditId_createdAt_idx" ON "MonthlyReportAttachment"("auditId", "createdAt");

-- CreateIndex
CREATE INDEX "MonthlyReportAttachment_findingId_idx" ON "MonthlyReportAttachment"("findingId");

-- CreateIndex
CREATE INDEX "MonthlyReportAttachment_capaId_idx" ON "MonthlyReportAttachment"("capaId");

-- CreateIndex
CREATE INDEX "MonthlyReportAttachment_actionItemId_idx" ON "MonthlyReportAttachment"("actionItemId");

-- CreateIndex
CREATE INDEX "MonthlyReportAttachment_reviewedById_idx" ON "MonthlyReportAttachment"("reviewedById");

-- CreateIndex
CREATE INDEX "MonthlyReportActionHistory_auditId_createdAt_idx" ON "MonthlyReportActionHistory"("auditId", "createdAt");

-- CreateIndex
CREATE INDEX "MonthlyReportActionHistory_findingId_idx" ON "MonthlyReportActionHistory"("findingId");

-- CreateIndex
CREATE INDEX "MonthlyReportActionHistory_capaId_idx" ON "MonthlyReportActionHistory"("capaId");

-- AddForeignKey
ALTER TABLE "MonthlyReportAttachment" ADD CONSTRAINT "MonthlyReportAttachment_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "InternalAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReportAttachment" ADD CONSTRAINT "MonthlyReportAttachment_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReportAttachment" ADD CONSTRAINT "MonthlyReportAttachment_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReportAttachment" ADD CONSTRAINT "MonthlyReportAttachment_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "CapaActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReportAttachment" ADD CONSTRAINT "MonthlyReportAttachment_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReportActionHistory" ADD CONSTRAINT "MonthlyReportActionHistory_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "InternalAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReportActionHistory" ADD CONSTRAINT "MonthlyReportActionHistory_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReportActionHistory" ADD CONSTRAINT "MonthlyReportActionHistory_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAudit" ADD CONSTRAINT "InternalAudit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAudit" ADD CONSTRAINT "InternalAudit_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalAudit" ADD CONSTRAINT "InternalAudit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTeamMember" ADD CONSTRAINT "AuditTeamMember_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "InternalAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTeamMember" ADD CONSTRAINT "AuditTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "InternalAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_ratingCode_fkey" FOREIGN KEY ("ratingCode") REFERENCES "FindingRating"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_responsibleEmployeeId_fkey" FOREIGN KEY ("responsibleEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capa" ADD CONSTRAINT "Capa_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaActionItem" ADD CONSTRAINT "CapaActionItem_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaActionItem" ADD CONSTRAINT "CapaActionItem_ownerEmployeeId_fkey" FOREIGN KEY ("ownerEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaActionItem" ADD CONSTRAINT "CapaActionItem_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaActionItem" ADD CONSTRAINT "CapaActionItem_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaVerification" ADD CONSTRAINT "CapaVerification_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "Capa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapaVerification" ADD CONSTRAINT "CapaVerification_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalNotification" ADD CONSTRAINT "PortalNotification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Keep all new data private to the authenticated backend connection.
DO $privacy$
DECLARE table_name text; api_role text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['AuditCounter','FindingRating','InternalAudit','AuditTeamMember','AuditFinding','Capa','CapaActionItem','CapaVerification','PortalNotification'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', table_name);
    FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
      EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', table_name, api_role);
    END LOOP;
  END LOOP;
END;
$privacy$;
ALTER TABLE "MonthlyReportAttachment" ADD CONSTRAINT "attachment_context_check" CHECK (
  ("monthlyReportId" IS NOT NULL AND "auditId" IS NULL AND "findingId" IS NULL AND "capaId" IS NULL AND "actionItemId" IS NULL)
  OR ("monthlyReportId" IS NULL AND "auditId" IS NOT NULL)
);
ALTER TABLE "MonthlyReportActionHistory" ADD CONSTRAINT "history_context_check" CHECK (("monthlyReportId" IS NOT NULL)::integer + ("auditId" IS NOT NULL)::integer = 1);
ALTER TABLE "Capa" ADD CONSTRAINT "capa_rca_method_check" CHECK ("rcaMethod" IN ('STANDARD','FIVE_WHY'));
ALTER TABLE "Capa" ADD CONSTRAINT "capa_target_date_check" CHECK ("startDate" IS NULL OR "targetDate" IS NULL OR "targetDate" >= "startDate");
ALTER TABLE "Capa" ADD CONSTRAINT "capa_completion_date_check" CHECK ("startDate" IS NULL OR "completionDate" IS NULL OR "completionDate" >= "startDate");
ALTER TABLE "Capa" ADD CONSTRAINT "capa_closed_check" CHECK ("status" <> 'CLOSED' OR ("closedAt" IS NOT NULL AND "closedById" IS NOT NULL AND "verifiedAt" IS NOT NULL));
ALTER TABLE "CapaActionItem" ADD CONSTRAINT "capa_action_dates_check" CHECK ("targetDate" >= "startDate" AND ("completionDate" IS NULL OR "completionDate" >= "startDate"));
ALTER TABLE "CapaActionItem" ADD CONSTRAINT "capa_action_verified_check" CHECK ("status" <> 'VERIFIED' OR ("completionDate" IS NOT NULL AND "verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL));
ALTER TABLE "CapaActionItem" ADD CONSTRAINT "capa_action_description_check" CHECK (length(btrim("description")) > 0);
ALTER TABLE "AuditFinding" ADD CONSTRAINT "finding_closed_check" CHECK ("status" <> 'CLOSED' OR "closedAt" IS NOT NULL);
ALTER TABLE "InternalAudit" ADD CONSTRAINT "audit_closed_check" CHECK ("status" <> 'CLOSED' OR "closedAt" IS NOT NULL);
INSERT INTO "FindingRating" ("code","label","severity","isActive") VALUES ('MAJOR_NC','Major NC',100,true),('MINOR_NC','Minor NC',50,true),('OFI','OFI',10,true);
COMMIT;
