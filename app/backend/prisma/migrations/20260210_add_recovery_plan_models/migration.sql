-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ActivationCodeStatus" AS ENUM ('UNUSED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "RecoveryPlanCategory" AS ENUM ('general_outpatient', 'cosmetic_recovery');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "consentAcceptedAt" TIMESTAMP(3),
    "procedureName" TEXT,
    "procedureCode" TEXT,
    "recoveryStartDate" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "verificationCode" TEXT,
    "verificationExpiresAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "painLevel" INTEGER NOT NULL,
    "swellingLevel" INTEGER NOT NULL,
    "notes" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicPlanConfig" (
    "clinicTag" TEXT NOT NULL,
    "defaultCategory" "RecoveryPlanCategory" NOT NULL DEFAULT 'general_outpatient',
    "overridesJson" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicPlanConfig_pkey" PRIMARY KEY ("clinicTag")
);

-- CreateTable
CREATE TABLE "ActivationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ActivationCodeStatus" NOT NULL DEFAULT 'UNUSED',
    "clinicTag" TEXT,
    "claimedByUserId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryPlanTemplate" (
    "id" TEXT NOT NULL,
    "category" "RecoveryPlanCategory" NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "planJson" JSONB NOT NULL,
    "sourcesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryPlanTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryPlanInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activationCodeId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "planJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryPlanInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LogEntry_userId_date_idx" ON "LogEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LogEntry_userId_date_key" ON "LogEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationCode_code_key" ON "ActivationCode"("code");

-- CreateIndex
CREATE INDEX "ActivationCode_status_idx" ON "ActivationCode"("status");

-- CreateIndex
CREATE INDEX "ActivationCode_clinicTag_idx" ON "ActivationCode"("clinicTag");

-- CreateIndex
CREATE INDEX "ActivationCode_claimedByUserId_idx" ON "ActivationCode"("claimedByUserId");

-- CreateIndex
CREATE INDEX "RecoveryPlanTemplate_category_idx" ON "RecoveryPlanTemplate"("category");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryPlanTemplate_category_version_key" ON "RecoveryPlanTemplate"("category", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryPlanInstance_activationCodeId_key" ON "RecoveryPlanInstance"("activationCodeId");

-- CreateIndex
CREATE INDEX "RecoveryPlanInstance_userId_idx" ON "RecoveryPlanInstance"("userId");

-- CreateIndex
CREATE INDEX "RecoveryPlanInstance_startDate_idx" ON "RecoveryPlanInstance"("startDate");

-- AddForeignKey
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_clinicTag_fkey" FOREIGN KEY ("clinicTag") REFERENCES "ClinicPlanConfig"("clinicTag") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryPlanInstance" ADD CONSTRAINT "RecoveryPlanInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryPlanInstance" ADD CONSTRAINT "RecoveryPlanInstance_activationCodeId_fkey" FOREIGN KEY ("activationCodeId") REFERENCES "ActivationCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryPlanInstance" ADD CONSTRAINT "RecoveryPlanInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RecoveryPlanTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

