-- CreateEnum
CREATE TYPE "MemoryLayer" AS ENUM ('EPISODIC', 'SEMANTIC', 'PATTERN');

-- AlterTable
ALTER TABLE "Memory"
ADD COLUMN "layer" "MemoryLayer",
ADD COLUMN "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastUsedAt" TIMESTAMP(3);

-- Backfill existing rows with stable layer mapping
UPDATE "Memory"
SET "layer" = CASE
  WHEN "type" = 'REFLECTION' THEN 'EPISODIC'::"MemoryLayer"
  ELSE 'SEMANTIC'::"MemoryLayer"
END
WHERE "layer" IS NULL;

-- Enforce not-null after backfill
ALTER TABLE "Memory"
ALTER COLUMN "layer" SET NOT NULL,
ALTER COLUMN "layer" SET DEFAULT 'SEMANTIC';

-- CreateIndex
CREATE INDEX "Memory_userId_layer_idx" ON "Memory"("userId", "layer");

-- CreateIndex
CREATE INDEX "Memory_userId_createdAt_idx" ON "Memory"("userId", "createdAt");
