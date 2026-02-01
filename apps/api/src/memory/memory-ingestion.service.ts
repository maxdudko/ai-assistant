import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.interface';

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

      await this.prisma.memory.create({
        data: {
          userId,
          type: c.type,
          content: c.content,
          importance: c.importance,
          tags: c.tags ?? [],
          source,
          embedding,
          dayId: context.dayId,
          conversationId: context.conversationId,
        },
      });
    }
  }
}
