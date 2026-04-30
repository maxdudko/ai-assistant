import { Inject, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { EmbeddingsService } from '../embeddings/embeddings.interface';

import { MemoryCandidateDto, MemoryLayer, MemoryType } from './dto/memory-candidate.dto';

@Injectable()
export class MemoryIngestionService {
  private readonly logger = new Logger(MemoryIngestionService.name);
  private readonly mergeSimilarityThreshold = this.normalizeSimilarityThreshold(
    Number(process.env.AI_MEMORY_MERGE_THRESHOLD ?? '0.9'),
  );

  constructor(
    private readonly prisma: PrismaService,
    @Inject('EmbeddingsService')
    private readonly embeddings: EmbeddingsService,
  ) {}

  async ingest(
    userId: string,
    candidates: MemoryCandidateDto[],
    source: 'CONVERSATION' | 'REFLECTION' | 'ONBOARDING',
    context: { dayId?: string; conversationId?: string },
  ) {
    const curated = candidates.filter(
      c => c.confidence >= 0.7 && c.importance >= 5 && c.content.length > 10,
    );

    // Generate all embeddings in parallel
    const withEmbeddings = await Promise.all(
      curated.map(async c => ({ candidate: c, embedding: await this.embeddings.embed(c.content) })),
    );

    for (const { candidate: c, embedding } of withEmbeddings) {
      // Check if embedding is all zeros (indicates embedding generation failed)
      const isZeroEmbedding = embedding.every(val => val === 0);
      if (isZeroEmbedding) {
        this.logger.error(
          `Skipping memory storage for content "${c.content.substring(0, 50)}..." ` +
            `because embedding generation failed (all zeros). ` +
            `Please fix the embeddings service configuration.`,
        );
        continue;
      }

      const layer = this.resolveLayer(c);
      const similar = await this.findSimilarMemory(userId, layer, embedding);
      if (similar) {
        const mergedTags = Array.from(new Set([...(similar.tags ?? []), ...(c.tags ?? [])]));
        await this.prisma.memory.update({
          where: { id: similar.id },
          data: {
            importance: Math.max(similar.importance, c.importance),
            confidence: Math.max(similar.confidence, c.confidence),
            tags: mergedTags,
            updatedAt: new Date(),
          },
        });
        continue;
      }

      await this.prisma.$executeRaw`
        INSERT INTO "Memory" (id, "userId", type, layer, content, importance, confidence, tags, source, embedding, "usageCount", "lastUsedAt", "dayId", "conversationId", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${userId}::uuid,
          ${c.type}::"MemoryType",
          ${layer}::"MemoryLayer",
          ${c.content},
          ${c.importance},
          ${c.confidence},
          ${c.tags ?? []}::text[],
          ${source}::"MemorySource",
          ${JSON.stringify(embedding)}::vector,
          0,
          NULL,
          ${context.dayId ?? null}::uuid,
          ${context.conversationId ?? null}::uuid,
          NOW(),
          NOW()
        )
      `;
    }
  }

  private resolveLayer(candidate: Pick<MemoryCandidateDto, 'layer' | 'type'>): MemoryLayer {
    if (candidate.layer) {
      return candidate.layer;
    }
    if (candidate.type === MemoryType.REFLECTION) {
      return MemoryLayer.EPISODIC;
    }
    return MemoryLayer.SEMANTIC;
  }

  private normalizeSimilarityThreshold(value: number): number {
    if (!Number.isFinite(value)) {
      return 0.9;
    }
    return Math.min(1, Math.max(0, value));
  }

  private async findSimilarMemory(userId: string, layer: MemoryLayer, embedding: number[]) {
    const embeddingLiteral = `[${embedding.join(',')}]`;
    const [match] = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        importance: number;
        confidence: number;
        tags: string[];
        distance: number;
      }>
    >(
      `
      SELECT id, importance, confidence, tags, embedding <-> $3::vector AS distance
      FROM "Memory"
      WHERE "userId" = $1
        AND layer = $2::"MemoryLayer"
        AND embedding IS NOT NULL
      ORDER BY embedding <-> $3::vector
      LIMIT 1
      `,
      userId,
      layer,
      embeddingLiteral,
    );
    if (!match) {
      return null;
    }
    const maxDistance = 1 - this.mergeSimilarityThreshold;
    if (match.distance > maxDistance) {
      return null;
    }
    return match;
  }
}
