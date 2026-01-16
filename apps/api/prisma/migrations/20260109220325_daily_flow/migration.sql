-- CreateEnum
CREATE TYPE "DayState" AS ENUM ('START', 'ACTIVE', 'END');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "dayId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "dayId" TEXT;

-- CreateTable
CREATE TABLE "Day" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "state" "DayState" NOT NULL DEFAULT 'START',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Day_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Day_userId_date_idx" ON "Day"("userId", "date");

-- CreateIndex
CREATE INDEX "Day_userId_state_idx" ON "Day"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Day_userId_date_key" ON "Day"("userId", "date");

-- CreateIndex
CREATE INDEX "Conversation_dayId_idx" ON "Conversation"("dayId");

-- CreateIndex
CREATE INDEX "Task_dayId_idx" ON "Task"("dayId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Day" ADD CONSTRAINT "Day_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
