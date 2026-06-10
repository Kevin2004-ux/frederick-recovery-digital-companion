ALTER TABLE "ClinicPlanConfig"
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "ClinicPlanConfig_archivedAt_updatedAt_idx"
ON "ClinicPlanConfig"("archivedAt", "updatedAt");
