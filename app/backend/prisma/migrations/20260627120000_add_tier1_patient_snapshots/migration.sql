ALTER TYPE "ActivationCodeStatus" ADD VALUE IF NOT EXISTS 'CONFIGURED';
ALTER TYPE "ActivationCodeStatus" ADD VALUE IF NOT EXISTS 'FINALIZED';
ALTER TYPE "ActivationCodeStatus" ADD VALUE IF NOT EXISTS 'PACKED';
ALTER TYPE "ActivationCodeStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "ActivationCodeStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "ActivationCodeStatus" ADD VALUE IF NOT EXISTS 'VOIDED';
ALTER TYPE "ActivationCodeStatus" ADD VALUE IF NOT EXISTS 'RESET_FOR_REISSUE';

CREATE TABLE "ClinicOrder" (
    "id" TEXT NOT NULL,
    "clinicTag" TEXT NOT NULL,
    "orderNumber" TEXT,
    "externalRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "requestedBoxCount" INTEGER,
    "productMode" TEXT NOT NULL DEFAULT 'kit_only',
    "defaultEducationBundleId" TEXT,
    "defaultBoxTemplateId" TEXT,
    "defaultProcedureName" TEXT,
    "requestedByName" TEXT,
    "requestedByEmail" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicOrder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ActivationBatch"
ADD COLUMN "clinicOrderId" TEXT;

ALTER TABLE "ActivationCode"
ADD COLUMN "finalizedAt" TIMESTAMP(3),
ADD COLUMN "packedAt" TIMESTAMP(3),
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "expiredAt" TIMESTAMP(3),
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "resetForReissueAt" TIMESTAMP(3);

CREATE TABLE "PatientSnapshot" (
    "id" TEXT NOT NULL,
    "activationCodeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "productMode" TEXT NOT NULL DEFAULT 'kit_only',
    "clinicTag" TEXT,
    "procedureName" TEXT,
    "educationBundleId" TEXT,
    "boxTemplateId" TEXT,
    "boxItemsJson" JSONB NOT NULL,
    "guidesJson" JSONB NOT NULL,
    "clinicNotesJson" JSONB,
    "videosJson" JSONB,
    "sourceMetadataJson" JSONB,
    "patientUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicOrder_orderNumber_key" ON "ClinicOrder"("orderNumber");
CREATE INDEX "ClinicOrder_clinicTag_status_idx" ON "ClinicOrder"("clinicTag", "status");
CREATE INDEX "ClinicOrder_createdByUserId_idx" ON "ClinicOrder"("createdByUserId");
CREATE INDEX "ClinicOrder_archivedAt_updatedAt_idx" ON "ClinicOrder"("archivedAt", "updatedAt");

CREATE INDEX "ActivationBatch_clinicOrderId_idx" ON "ActivationBatch"("clinicOrderId");

CREATE INDEX "ActivationCode_finalizedAt_idx" ON "ActivationCode"("finalizedAt");
CREATE INDEX "ActivationCode_packedAt_idx" ON "ActivationCode"("packedAt");
CREATE INDEX "ActivationCode_archivedAt_idx" ON "ActivationCode"("archivedAt");

CREATE UNIQUE INDEX "PatientSnapshot_activationCodeId_version_key" ON "PatientSnapshot"("activationCodeId", "version");
CREATE INDEX "PatientSnapshot_activationCodeId_isCurrent_idx" ON "PatientSnapshot"("activationCodeId", "isCurrent");
CREATE INDEX "PatientSnapshot_patientUserId_idx" ON "PatientSnapshot"("patientUserId");
CREATE INDEX "PatientSnapshot_clinicTag_idx" ON "PatientSnapshot"("clinicTag");
CREATE INDEX "PatientSnapshot_productMode_idx" ON "PatientSnapshot"("productMode");
CREATE INDEX "PatientSnapshot_createdByUserId_idx" ON "PatientSnapshot"("createdByUserId");

ALTER TABLE "ClinicOrder"
ADD CONSTRAINT "ClinicOrder_clinicTag_fkey"
FOREIGN KEY ("clinicTag") REFERENCES "ClinicPlanConfig"("clinicTag") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClinicOrder"
ADD CONSTRAINT "ClinicOrder_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ActivationBatch"
ADD CONSTRAINT "ActivationBatch_clinicOrderId_fkey"
FOREIGN KEY ("clinicOrderId") REFERENCES "ClinicOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PatientSnapshot"
ADD CONSTRAINT "PatientSnapshot_activationCodeId_fkey"
FOREIGN KEY ("activationCodeId") REFERENCES "ActivationCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientSnapshot"
ADD CONSTRAINT "PatientSnapshot_patientUserId_fkey"
FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PatientSnapshot"
ADD CONSTRAINT "PatientSnapshot_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
