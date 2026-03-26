-- AlterTable
ALTER TABLE "ActivationBatch" ADD COLUMN     "boxType" TEXT,
ADD COLUMN     "includedItemsJson" JSONB;

-- AlterTable
ALTER TABLE "ActivationCode" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "approvedConfigSnapshot" JSONB;

-- CreateIndex
CREATE INDEX "ActivationCode_approvedByUserId_idx" ON "ActivationCode"("approvedByUserId");

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
