ALTER TABLE "ActivationBatch"
ADD COLUMN "educationBundleId" TEXT,
ADD COLUMN "boxTemplateId" TEXT,
ADD COLUMN "productMode" TEXT NOT NULL DEFAULT 'full_platform',
ADD COLUMN "procedureName" TEXT;

ALTER TABLE "ActivationCode"
ADD COLUMN "educationBundleId" TEXT,
ADD COLUMN "boxTemplateId" TEXT,
ADD COLUMN "productMode" TEXT NOT NULL DEFAULT 'full_platform',
ADD COLUMN "procedureName" TEXT,
ADD COLUMN "assignedBoxItemsJson" JSONB,
ADD COLUMN "assignedEducationJson" JSONB;

CREATE INDEX "ActivationBatch_educationBundleId_idx" ON "ActivationBatch"("educationBundleId");
CREATE INDEX "ActivationBatch_boxTemplateId_idx" ON "ActivationBatch"("boxTemplateId");
CREATE INDEX "ActivationBatch_productMode_idx" ON "ActivationBatch"("productMode");

CREATE INDEX "ActivationCode_educationBundleId_idx" ON "ActivationCode"("educationBundleId");
CREATE INDEX "ActivationCode_boxTemplateId_idx" ON "ActivationCode"("boxTemplateId");
CREATE INDEX "ActivationCode_productMode_idx" ON "ActivationCode"("productMode");
