CREATE TABLE "BoxItem" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "description" TEXT,
  "instructions" TEXT,
  "defaultEducationModuleId" TEXT,
  "imageUrl" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BoxItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoxItem_key_key" ON "BoxItem"("key");
CREATE INDEX "BoxItem_active_displayOrder_idx" ON "BoxItem"("active", "displayOrder");
CREATE INDEX "BoxItem_category_idx" ON "BoxItem"("category");
CREATE INDEX "BoxItem_defaultEducationModuleId_idx" ON "BoxItem"("defaultEducationModuleId");
