-- CreateEnum
CREATE TYPE "ConversationState" AS ENUM ('CREATED', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DAILY', 'AD_HOC');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "state" "ConversationState" NOT NULL DEFAULT 'CREATED';
ALTER TABLE "Conversation" ADD COLUMN "type" "ConversationType" NOT NULL DEFAULT 'DAILY';
ALTER TABLE "Conversation" ADD COLUMN "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 5,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_userId_type_date_key" ON "Conversation"("userId", "type", "date");

-- CreateIndex
CREATE INDEX "Conversation_userId_state_type_idx" ON "Conversation"("userId", "state", "type");

-- CreateIndex
CREATE INDEX "Memory_userId_createdAt_idx" ON "Memory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Memory_conversationId_idx" ON "Memory"("conversationId");

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

