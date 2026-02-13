/*
  Warnings:

  - Added the required column `configJson` to the `RecoveryPlanInstance` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'CLINIC');

-- AlterTable
ALTER TABLE "ActivationCode" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "configCapturedAt" TIMESTAMP(3),
ADD COLUMN     "configCapturedByUserId" TEXT,
ADD COLUMN     "configJson" JSONB;

-- AlterTable
ALTER TABLE "RecoveryPlanInstance" ADD COLUMN     "configJson" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "clinicTag" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'PATIENT';

-- CreateTable
CREATE TABLE "ActivationBatch" (
    "id" TEXT NOT NULL,
    "clinicTag" TEXT,
    "quantity" INTEGER NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivationBatch_clinicTag_idx" ON "ActivationBatch"("clinicTag");

-- CreateIndex
CREATE INDEX "ActivationBatch_createdByUserId_idx" ON "ActivationBatch"("createdByUserId");

-- CreateIndex
CREATE INDEX "ActivationCode_batchId_idx" ON "ActivationCode"("batchId");

-- CreateIndex
CREATE INDEX "ActivationCode_configCapturedByUserId_idx" ON "ActivationCode"("configCapturedByUserId");

-- CreateIndex
CREATE INDEX "User_clinicTag_idx" ON "User"("clinicTag");

-- AddForeignKey
ALTER TABLE "ActivationBatch" ADD CONSTRAINT "ActivationBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ActivationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_configCapturedByUserId_fkey" FOREIGN KEY ("configCapturedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
