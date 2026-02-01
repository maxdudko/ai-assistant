import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { EmbeddingsService } from '../embeddings/embeddings.interface';

import { MemoryCandidateDto } from './dto/memory-candidate.dto';

@Injectable()
export class MemoryIngestionService {
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

    for (const c of curated) {
      const embedding = await this.embeddings.embed(c.content);

      await this.prisma.$executeRaw`
        INSERT INTO "Memory" (id, "userId", type, content, importance, tags, source, embedding, "dayId", "conversationId", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${userId}::uuid,
          ${c.type}::"MemoryType",
          ${c.content},
          ${c.importance},
          ${c.tags ?? []}::text[],
          ${source}::"MemorySource",
          ${JSON.stringify(embedding)}::vector(1536),
          ${context.dayId ?? null}::uuid,
          ${context.conversationId ?? null}::uuid,
          NOW(),
          NOW()
        )
      `;
    }
  }
}
