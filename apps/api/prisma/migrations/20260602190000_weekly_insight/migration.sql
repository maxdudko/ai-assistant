-- CreateTable
CREATE TABLE "WeeklyInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "isoYear" INTEGER NOT NULL,
    "isoWeek" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "completionRate" DOUBLE PRECISION NOT NULL,
    "totalTasks" INTEGER NOT NULL DEFAULT 0,
    "completedTasks" INTEGER NOT NULL DEFAULT 0,
    "reschedules" INTEGER NOT NULL DEFAULT 0,
    "topPatterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "focusSuggestion" TEXT,
    "narrative" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'AUTOMATIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyInsight_userId_isoYear_isoWeek_key" ON "WeeklyInsight"("userId", "isoYear", "isoWeek");

-- CreateIndex
CREATE INDEX "WeeklyInsight_userId_weekStart_idx" ON "WeeklyInsight"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "WeeklyInsight" ADD CONSTRAINT "WeeklyInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
