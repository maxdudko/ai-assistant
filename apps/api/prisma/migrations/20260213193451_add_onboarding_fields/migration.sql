-- CreateEnum
CREATE TYPE "Tone" AS ENUM ('Neutral', 'Friendly', 'Professional', 'Casual', 'Humorous', 'Empathetic');

-- CreateEnum
CREATE TYPE "Verbosity" AS ENUM ('Short', 'Medium', 'Detailed');

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "dayPlanningTime" TEXT,
ADD COLUMN     "helpStyle" TEXT,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "primaryUseCase" TEXT,
ADD COLUMN     "reflectionTime" TEXT,
ALTER COLUMN "verbosity" SET DEFAULT 'normal',
ALTER COLUMN "useEmoji" SET DEFAULT true;
