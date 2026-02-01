-- DropIndex
DROP INDEX "Memory_embedding_cosine_idx";

-- AlterTable
ALTER TABLE "Memory" ALTER COLUMN "type" DROP DEFAULT;
