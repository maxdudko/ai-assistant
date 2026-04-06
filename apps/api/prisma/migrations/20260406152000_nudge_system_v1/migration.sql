-- CreateEnum
CREATE TYPE "NudgeType" AS ENUM (
  'MORNING_START',
  'PLAN_OVERLOAD',
  'NO_PROGRESS',
  'STUCK_TASK',
  'EVENING_REFLECTION'
);

-- CreateEnum
CREATE TYPE "NudgePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Day"
ADD COLUMN     "lastNudgeAt" TIMESTAMP(3),
ADD COLUMN     "nudgesSentToday" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "NudgeEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "type" "NudgeType" NOT NULL,
    "priority" "NudgePriority" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NudgeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NudgeEvent_userId_createdAt_idx" ON "NudgeEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NudgeEvent_userId_type_createdAt_idx" ON "NudgeEvent"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "NudgeEvent_dayId_type_createdAt_idx" ON "NudgeEvent"("dayId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "NudgeEvent" ADD CONSTRAINT "NudgeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NudgeEvent" ADD CONSTRAINT "NudgeEvent_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE CASCADE ON UPDATE CASCADE;
