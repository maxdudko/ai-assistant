-- CreateTable
CREATE TABLE "AiLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "ConversationMode" NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiLog_userId_createdAt_idx" ON "AiLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiLog_userId_mode_idx" ON "AiLog"("userId", "mode");

-- AddForeignKey
ALTER TABLE "AiLog" ADD CONSTRAINT "AiLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
