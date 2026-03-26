-- CreateEnum
CREATE TYPE "OperationalAlertType" AS ENUM ('MISSED_CHECK_IN', 'REVIEW_SIGNAL');

-- CreateEnum
CREATE TYPE "OperationalAlertSeverity" AS ENUM ('REVIEW', 'URGENT');

-- CreateEnum
CREATE TYPE "OperationalAlertStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "OperationalAlert" (
    "id" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "clinicTag" TEXT NOT NULL,
    "activationCodeId" TEXT,
    "type" "OperationalAlertType" NOT NULL,
    "severity" "OperationalAlertSeverity" NOT NULL,
    "status" "OperationalAlertStatus" NOT NULL DEFAULT 'OPEN',
    "reasonsJson" JSONB,
    "detailsJson" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperationalAlert_dedupeKey_key" ON "OperationalAlert"("dedupeKey");

-- CreateIndex
CREATE INDEX "OperationalAlert_clinicTag_status_severity_idx" ON "OperationalAlert"("clinicTag", "status", "severity");

-- CreateIndex
CREATE INDEX "OperationalAlert_patientUserId_status_idx" ON "OperationalAlert"("patientUserId", "status");

-- CreateIndex
CREATE INDEX "OperationalAlert_activationCodeId_idx" ON "OperationalAlert"("activationCodeId");

-- CreateIndex
CREATE INDEX "OperationalAlert_clinicTag_patientUserId_status_idx" ON "OperationalAlert"("clinicTag", "patientUserId", "status");

-- AddForeignKey
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_activationCodeId_fkey" FOREIGN KEY ("activationCodeId") REFERENCES "ActivationCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

