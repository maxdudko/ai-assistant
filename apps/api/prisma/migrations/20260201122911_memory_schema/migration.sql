-- EnableExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('FACTUAL', 'REFLECTION');

-- CreateEnum
CREATE TYPE "MemorySource" AS ENUM ('CONVERSATION', 'REFLECTION', 'ONBOARDING');

-- DropForeignKey
ALTER TABLE "Memory" DROP CONSTRAINT "Memory_conversationId_fkey";

-- DropIndex
DROP INDEX "Memory_conversationId_idx";

-- DropIndex
DROP INDEX "Memory_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "Memory" ADD COLUMN     "dayId" TEXT,
ADD COLUMN     "embedding" vector(1536),
ADD COLUMN     "source" "MemorySource" NOT NULL DEFAULT 'CONVERSATION',
ADD COLUMN     "type" "MemoryType" NOT NULL DEFAULT 'FACTUAL',
ALTER COLUMN "conversationId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Memory_userId_type_idx" ON "Memory"("userId", "type");

-- CreateIndex
CREATE INDEX "Memory_userId_importance_idx" ON "Memory"("userId", "importance");

-- CreateIndex
CREATE INDEX "Memory_embedding_cosine_idx" ON "Memory" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
