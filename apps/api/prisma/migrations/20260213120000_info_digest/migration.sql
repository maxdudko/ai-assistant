-- CreateEnum
CREATE TYPE "DigestFrequency" AS ENUM ('DAILY');

-- CreateTable
CREATE TABLE "DigestTopic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigestTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigestSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "frequency" "DigestFrequency" NOT NULL DEFAULT 'DAILY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigestSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DigestTopic_normalizedName_key" ON "DigestTopic"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "DigestSubscription_userId_topicId_key" ON "DigestSubscription"("userId", "topicId");

-- CreateIndex
CREATE INDEX "DigestSubscription_userId_frequency_idx" ON "DigestSubscription"("userId", "frequency");

-- AddForeignKey
ALTER TABLE "DigestSubscription" ADD CONSTRAINT "DigestSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigestSubscription" ADD CONSTRAINT "DigestSubscription_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "DigestTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
