/*
  Warnings:

  - A unique constraint covering the columns `[clinicTag,category,version]` on the table `RecoveryPlanTemplate` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "RecoveryPlanTemplate_category_version_key";

-- AlterTable
ALTER TABLE "RecoveryPlanTemplate" ADD COLUMN     "clinicTag" TEXT;

-- CreateIndex
CREATE INDEX "RecoveryPlanTemplate_clinicTag_idx" ON "RecoveryPlanTemplate"("clinicTag");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryPlanTemplate_clinicTag_category_version_key" ON "RecoveryPlanTemplate"("clinicTag", "category", "version");

-- AddForeignKey
ALTER TABLE "RecoveryPlanTemplate" ADD CONSTRAINT "RecoveryPlanTemplate_clinicTag_fkey" FOREIGN KEY ("clinicTag") REFERENCES "ClinicPlanConfig"("clinicTag") ON DELETE CASCADE ON UPDATE CASCADE;
