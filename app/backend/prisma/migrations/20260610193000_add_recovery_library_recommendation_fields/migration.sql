ALTER TABLE "RecoveryLibraryModule"
ADD COLUMN "recommended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "recommendationLabel" TEXT,
ADD COLUMN "recommendationOrder" INTEGER;
