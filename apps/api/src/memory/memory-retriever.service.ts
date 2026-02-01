import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings/embeddings.interface';

@Injectable()
export class MemoryRetrieverService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('EmbeddingsService')
    private readonly embeddings: EmbeddingsService,
  ) {}

  async retrieve(userId: string, query: string, limit = 3) {
    const embedding = await this.embeddings.embed(query);

    return this.prisma.$queryRawUnsafe<{ id: string; content: string; importance: number }[]>(
      `
      SELECT id, content, importance
      FROM "Memory"
      WHERE "userId" = $1
      ORDER BY embedding <-> $2
      LIMIT $3
      `, // Using the pgvector distance operator <-> for similarity search
      userId,
      embedding,
      limit,
    );
  }
}
