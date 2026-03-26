-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('DAILY_CHECK_IN_EMAIL');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "ReminderOutbox" (
    "id" TEXT NOT NULL,
    "patientUserId" TEXT NOT NULL,
    "clinicTag" TEXT NOT NULL,
    "activationCodeId" TEXT,
    "type" "ReminderType" NOT NULL,
    "scheduledForDate" TEXT NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "detailsJson" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReminderOutbox_dedupeKey_key" ON "ReminderOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "ReminderOutbox_clinicTag_scheduledForDate_status_idx" ON "ReminderOutbox"("clinicTag", "scheduledForDate", "status");

-- CreateIndex
CREATE INDEX "ReminderOutbox_patientUserId_type_scheduledForDate_idx" ON "ReminderOutbox"("patientUserId", "type", "scheduledForDate");

-- CreateIndex
CREATE INDEX "ReminderOutbox_activationCodeId_idx" ON "ReminderOutbox"("activationCodeId");

-- AddForeignKey
ALTER TABLE "ReminderOutbox" ADD CONSTRAINT "ReminderOutbox_patientUserId_fkey" FOREIGN KEY ("patientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderOutbox" ADD CONSTRAINT "ReminderOutbox_activationCodeId_fkey" FOREIGN KEY ("activationCodeId") REFERENCES "ActivationCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

