-- CreateTable
CREATE TABLE "ActionCandidate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionExecutionLog" (
    "id" TEXT NOT NULL,
    "actionId" TEXT,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionCandidate_userId_createdAt_idx" ON "ActionCandidate"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionCandidate_conversationId_idx" ON "ActionCandidate"("conversationId");

-- CreateIndex
CREATE INDEX "ActionCandidate_status_idx" ON "ActionCandidate"("status");

-- CreateIndex
CREATE INDEX "ActionExecutionLog_userId_createdAt_idx" ON "ActionExecutionLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionExecutionLog_actionId_idx" ON "ActionExecutionLog"("actionId");

-- AddForeignKey
ALTER TABLE "ActionCandidate" ADD CONSTRAINT "ActionCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionCandidate" ADD CONSTRAINT "ActionCandidate_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionExecutionLog" ADD CONSTRAINT "ActionExecutionLog_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionExecutionLog" ADD CONSTRAINT "ActionExecutionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
