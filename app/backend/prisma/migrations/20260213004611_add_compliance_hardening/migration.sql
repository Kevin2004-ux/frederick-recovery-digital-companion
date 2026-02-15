/*
  Warnings:

  - The values [UNUSED] on the enum `ActivationCodeStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ActivationCodeStatus_new" AS ENUM ('ISSUED', 'DRAFT', 'APPROVED', 'CLAIMED', 'INVALIDATED');
ALTER TABLE "public"."ActivationCode" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ActivationCode" ALTER COLUMN "status" TYPE "ActivationCodeStatus_new" USING ("status"::text::"ActivationCodeStatus_new");
ALTER TYPE "ActivationCodeStatus" RENAME TO "ActivationCodeStatus_old";
ALTER TYPE "ActivationCodeStatus_new" RENAME TO "ActivationCodeStatus";
DROP TYPE "public"."ActivationCodeStatus_old";
ALTER TABLE "ActivationCode" ALTER COLUMN "status" SET DEFAULT 'ISSUED';
COMMIT;

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'OWNER';

-- AlterTable
ALTER TABLE "ActivationCode" ALTER COLUMN "status" SET DEFAULT 'ISSUED';

-- AlterTable
ALTER TABLE "LogEntry" ALTER COLUMN "schemaVersion" SET DEFAULT 2;

-- CreateTable
CREATE TABLE "SecurityAudit" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" TEXT NOT NULL,
    "eventCategory" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "clinicTag" TEXT,
    "patientUserId" TEXT,
    "targetObjectType" TEXT,
    "targetObjectId" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityAudit_timestamp_idx" ON "SecurityAudit"("timestamp");

-- CreateIndex
CREATE INDEX "SecurityAudit_actorUserId_idx" ON "SecurityAudit"("actorUserId");

-- CreateIndex
CREATE INDEX "SecurityAudit_clinicTag_idx" ON "SecurityAudit"("clinicTag");
