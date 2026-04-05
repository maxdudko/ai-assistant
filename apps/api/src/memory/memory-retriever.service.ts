import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { EmbeddingsService } from '../embeddings/embeddings.interface';

export type RetrievedMemory = {
  id: string;
  content: string;
  importance: number;
  tags: string[];
  confidence: number;
  layer: 'EPISODIC' | 'SEMANTIC' | 'PATTERN';
  usageCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  distance?: number;
  score?: number;
  contextBucket: 'PATTERN' | 'SEMANTIC' | 'RECENT' | 'IMPORTANT';
};

export type RetrievedMemoryContext = {
  patterns: RetrievedMemory[];
  semantic: RetrievedMemory[];
  recent: RetrievedMemory[];
  important: RetrievedMemory[];
  merged: RetrievedMemory[];
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
        confidence: number;
        layer: 'EPISODIC' | 'SEMANTIC' | 'PATTERN';
        usageCount: number;
        lastUsedAt: Date | null;
        createdAt: Date;
        distance: number;
      }[]
    >(
      `
      SELECT
        id,
        content,
        importance,
        tags,
        confidence,
        layer,
        "usageCount",
        "lastUsedAt",
        "createdAt",
        embedding <-> $2::vector AS distance
      FROM "Memory"
      WHERE "userId" = $1
        AND embedding IS NOT NULL
      ORDER BY embedding <-> $2::vector
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
        id: m.id,
        content: m.content,
        importance: m.importance,
        tags: m.tags,
        confidence: m.confidence,
        layer: m.layer,
        usageCount: m.usageCount,
        lastUsedAt: m.lastUsedAt,
        createdAt: m.createdAt,
        distance: m.distance,
        score,
        contextBucket: 'SEMANTIC',
      };
    });

    // 5. Sort and return top-k
    return reranked.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit);
  }

  async getMemoryContext(
    userId: string,
    query: string,
    options?: {
      limit?: number;
      patternLimit?: number;
      semanticLimit?: number;
      recentLimit?: number;
      importantLimit?: number;
      maxDistance?: number;
      importanceWeight?: number;
      similarityWeight?: number;
    },
  ): Promise<RetrievedMemoryContext> {
    const maxPromptMemories = options?.limit ? Math.min(7, Math.max(5, options.limit)) : 6;
    const patternLimit = options?.patternLimit ?? 3;
    const semanticLimit = options?.semanticLimit ?? 3;
    const recentLimit = options?.recentLimit ?? 3;
    const importantLimit = options?.importantLimit ?? 3;

    const [patterns, semantic, recent, important] = await Promise.all([
      this.getTopPatterns(userId, patternLimit),
      this.retrieve(userId, query, {
        limit: semanticLimit,
        maxDistance: options?.maxDistance,
        importanceWeight: options?.importanceWeight,
        similarityWeight: options?.similarityWeight,
      }),
      this.getRecentMemories(userId, recentLimit),
      this.getImportantMemories(userId, importantLimit),
    ]);

    const merged = this.dedupeById([...patterns, ...semantic, ...recent, ...important]).slice(
      0,
      Math.max(patterns.length, maxPromptMemories),
    );

    return {
      patterns,
      semantic,
      recent,
      important,
      merged,
    };
  }

  async trackUsage(memoryIds: string[]): Promise<void> {
    const ids = Array.from(new Set(memoryIds.filter(Boolean)));
    if (ids.length === 0) {
      return;
    }

    await this.prisma.memory.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  private async getRecentMemories(userId: string, limit: number): Promise<RetrievedMemory[]> {
    const rows = await this.prisma.memory.findMany({
      where: {
        userId,
        layer: { not: 'PATTERN' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        importance: true,
        tags: true,
        confidence: true,
        layer: true,
        usageCount: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    return rows.map(row => this.mapRecord(row, 'RECENT'));
  }

  private async getImportantMemories(userId: string, limit: number): Promise<RetrievedMemory[]> {
    const rows = await this.prisma.memory.findMany({
      where: {
        userId,
        layer: { not: 'PATTERN' },
      },
      orderBy: [{ importance: 'desc' }, { confidence: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        content: true,
        importance: true,
        tags: true,
        confidence: true,
        layer: true,
        usageCount: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    return rows.map(row => this.mapRecord(row, 'IMPORTANT'));
  }

  private async getTopPatterns(userId: string, limit: number): Promise<RetrievedMemory[]> {
    const rows = await this.prisma.memory.findMany({
      where: {
        userId,
        layer: 'PATTERN',
      },
      orderBy: [{ importance: 'desc' }, { confidence: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        content: true,
        importance: true,
        tags: true,
        confidence: true,
        layer: true,
        usageCount: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    return rows.map(row => this.mapRecord(row, 'PATTERN'));
  }

  private mapRecord(
    row: {
      id: string;
      content: string;
      importance: number;
      tags: string[];
      confidence: number;
      layer: 'EPISODIC' | 'SEMANTIC' | 'PATTERN';
      usageCount: number;
      lastUsedAt: Date | null;
      createdAt: Date;
    },
    contextBucket: RetrievedMemory['contextBucket'],
  ): RetrievedMemory {
    return {
      id: row.id,
      content: row.content,
      importance: row.importance,
      tags: row.tags,
      confidence: row.confidence,
      layer: row.layer,
      usageCount: row.usageCount,
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
      contextBucket,
    };
  }

  private dedupeById(memories: RetrievedMemory[]): RetrievedMemory[] {
    const seen = new Set<string>();
    const deduped: RetrievedMemory[] = [];
    for (const memory of memories) {
      if (seen.has(memory.id)) {
        continue;
      }
      seen.add(memory.id);
      deduped.push(memory);
    }
    return deduped;
  }
}
