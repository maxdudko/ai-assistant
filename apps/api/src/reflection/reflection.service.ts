import { Injectable } from '@nestjs/common';

import { MemoryIngestionService } from '../memory/memory-ingestion.service';

@Injectable()
export class ReflectionService {
  constructor(private readonly memoryIngestion: MemoryIngestionService) {}

  async reflectDay(
    userId: string,
    dayId: string,
    aiResult: {
      summary: string;
      memoryCandidates: any[];
    },
  ) {
    await this.memoryIngestion.ingest(userId, aiResult.memoryCandidates, 'REFLECTION', { dayId });

    return aiResult.summary;
  }
}
