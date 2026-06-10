CREATE TABLE "RecoveryLibraryModule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "moduleType" TEXT NOT NULL,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "procedureNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "boxItemKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "redFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredBoxItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryLibraryModule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecoveryLibraryModule_active_displayOrder_idx"
ON "RecoveryLibraryModule"("active", "displayOrder");
