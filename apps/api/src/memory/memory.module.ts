import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

import { MemoryIngestionService } from './memory-ingestion.service';
import { MemoryRetrieverService } from './memory-retriever.service';

@Module({
  imports: [PrismaModule, EmbeddingsModule],
  providers: [MemoryIngestionService, MemoryRetrieverService],
  exports: [MemoryIngestionService, MemoryRetrieverService],
})
export class MemoryModule {}
