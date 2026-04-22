-- v0.5 M3: OTP backup (SMS/Email) + User.phoneE164

-- CreateEnum
CREATE TYPE "OtpKind" AS ENUM ('SMS', 'EMAIL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneE164" TEXT;

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "OtpKind" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtpChallenge_userId_usedAt_idx" ON "OtpChallenge"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_createdAt_idx" ON "OtpChallenge"("createdAt");

-- AddForeignKey
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
