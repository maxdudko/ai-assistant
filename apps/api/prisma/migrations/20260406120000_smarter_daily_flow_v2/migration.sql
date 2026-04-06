-- CreateEnum
CREATE TYPE "DayPhase" AS ENUM ('NOT_STARTED', 'MORNING', 'PLANNING', 'EXECUTION', 'EVENING', 'CLOSED');

-- AlterTable
ALTER TABLE "Day"
ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "noProgressNudgeSentAt" TIMESTAMP(3),
ADD COLUMN     "nudgesSentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "phase" "DayPhase" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "planningSuggestionSentAt" TIMESTAMP(3),
ADD COLUMN     "stuckTaskNudgeSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserProfile"
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "DayInsight" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "completionRate" DOUBLE PRECISION NOT NULL,
    "consistency" DOUBLE PRECISION NOT NULL,
    "focus" DOUBLE PRECISION NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DayInsight_dayId_key" ON "DayInsight"("dayId");

-- CreateIndex
CREATE INDEX "Day_phase_idx" ON "Day"("userId", "phase");

-- CreateIndex
CREATE INDEX "DayInsight_userId_createdAt_idx" ON "DayInsight"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "DayInsight" ADD CONSTRAINT "DayInsight_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayInsight" ADD CONSTRAINT "DayInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
