CREATE TABLE "EducationBundle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "clinicTag" TEXT,
    "procedureName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EducationBundle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EducationBundleModule" (
    "bundleId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "recommendationLabel" TEXT,
    "recommendationOrder" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EducationBundleModule_pkey" PRIMARY KEY ("bundleId","moduleId")
);

CREATE TABLE "BoxTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "boxItemKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoxTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BoxTemplateEducationModule" (
    "boxTemplateId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "recommendationLabel" TEXT,
    "recommendationOrder" INTEGER,

    CONSTRAINT "BoxTemplateEducationModule_pkey" PRIMARY KEY ("boxTemplateId","moduleId")
);

CREATE UNIQUE INDEX "EducationBundle_slug_key" ON "EducationBundle"("slug");
CREATE UNIQUE INDEX "BoxTemplate_slug_key" ON "BoxTemplate"("slug");

CREATE INDEX "EducationBundle_active_displayOrder_idx"
ON "EducationBundle"("active", "displayOrder");

CREATE INDEX "EducationBundle_clinicTag_idx"
ON "EducationBundle"("clinicTag");

CREATE INDEX "EducationBundle_procedureName_idx"
ON "EducationBundle"("procedureName");

CREATE INDEX "EducationBundleModule_bundleId_displayOrder_idx"
ON "EducationBundleModule"("bundleId", "displayOrder");

CREATE INDEX "BoxTemplate_active_displayOrder_idx"
ON "BoxTemplate"("active", "displayOrder");

CREATE INDEX "BoxTemplateEducationModule_boxTemplateId_recommendationOrder_idx"
ON "BoxTemplateEducationModule"("boxTemplateId", "recommendationOrder");

ALTER TABLE "EducationBundleModule"
ADD CONSTRAINT "EducationBundleModule_bundleId_fkey"
FOREIGN KEY ("bundleId") REFERENCES "EducationBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoxTemplateEducationModule"
ADD CONSTRAINT "BoxTemplateEducationModule_boxTemplateId_fkey"
FOREIGN KEY ("boxTemplateId") REFERENCES "BoxTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
