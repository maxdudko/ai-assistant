import { Module } from '@nestjs/common';

import { OllamaEmbeddingsService } from './embeddings.service';

@Module({
  providers: [
    {
      provide: 'EmbeddingsService',
      useClass: OllamaEmbeddingsService,
    },
  ],
  exports: ['EmbeddingsService'],
})
export class EmbeddingsModule {}
