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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LogEntry_userId_date_idx" ON "LogEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LogEntry_userId_date_key" ON "LogEntry"("userId", "date");

-- AddForeignKey
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
