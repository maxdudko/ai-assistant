-- AlterTable
ALTER TABLE "Task"
ADD COLUMN     "difficulty" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "estimatedMinutes" INTEGER;
