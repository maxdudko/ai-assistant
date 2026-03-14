-- Drop old index if it exists
DROP INDEX IF EXISTS "Memory_embedding_cosine_idx";

-- Existing 1536-dim vectors cannot be cast directly to 3072.
-- Reset embeddings so they can be re-ingested with the new dimension.
UPDATE "Memory"
SET embedding = NULL
WHERE embedding IS NOT NULL;

-- Upgrade vector dimension
ALTER TABLE "Memory"
ALTER COLUMN "embedding" TYPE vector(3072);

-- NOTE:
-- ivfflat cannot index vectors with >2000 dimensions in this pgvector build.
-- For 3072-dim embeddings, keep this unindexed for now (acceptable for MVP-sized data).
-- If needed later, migrate to a supported ANN index strategy for high-dimensional vectors.
