import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { MemoryIngestionService } from './memory-ingestion.service';
import { MemoryRetrieverService } from './memory-retriever.service';
import { PatternDetectionService } from './pattern-detection.service';

@Module({
  imports: [PrismaModule, EmbeddingsModule],
  controllers: [MemoryController],
  providers: [
    MemoryService,
    MemoryIngestionService,
    MemoryRetrieverService,
    PatternDetectionService,
  ],
  exports: [MemoryService, MemoryIngestionService, MemoryRetrieverService, PatternDetectionService],
})
export class MemoryModule {}
