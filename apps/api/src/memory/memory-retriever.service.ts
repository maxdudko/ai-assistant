import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { EmbeddingsService } from '../embeddings/embeddings.interface';

export type RetrievedMemory = {
  id: string;
  content: string;
  importance: number;
  tags: string[];
  distance: number;
  score: number;
};

@Injectable()
export class MemoryRetrieverService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('EmbeddingsService')
    private readonly embeddings: EmbeddingsService,
  ) {}

  /**
   * Retrieve relevant user memories using vector similarity + lightweight reranking.
   */
  async retrieve(
    userId: string,
    query: string,
    options?: {
      limit?: number;
      maxDistance?: number;
      importanceWeight?: number;
      similarityWeight?: number;
    },
  ): Promise<RetrievedMemory[]> {
    const {
      limit = 3,
      maxDistance = 0.8,
      importanceWeight = 0.3,
      similarityWeight = 0.7,
    } = options ?? {};

    // 1. Embed query
    const embedding = await this.embeddings.embed(query);
    const embeddingLiteral = `[${embedding.join(',')}]`;

    // 2. Raw vector search
    const candidates = await this.prisma.$queryRawUnsafe<
      {
        id: string;
        content: string;
        importance: number;
        tags: string[];
        distance: number;
      }[]
    >(
      `
      SELECT
        id,
        content,
        importance,
        tags,
        embedding <-> $2::vector(1536) AS distance
      FROM "Memory"
      WHERE "userId" = $1
        AND embedding IS NOT NULL
      ORDER BY embedding <-> $2::vector(1536)
      LIMIT $3
      `,
      userId,
      embeddingLiteral,
      Math.max(limit * 3, 10), // fetch extra for reranking
    );

    // 3. Filter by distance (relevance gate)
    const relevant = candidates.filter(m => m.distance <= maxDistance);

    // 4. Rerank (importance + similarity)
    const reranked: RetrievedMemory[] = relevant.map(m => {
      const similarity = 1 - m.distance;
      const score = similarity * similarityWeight + (m.importance / 10) * importanceWeight;

      return {
        ...m,
        score,
      };
    });

    // 5. Sort and return top-k
    return reranked.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
