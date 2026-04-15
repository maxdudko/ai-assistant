import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OllamaEmbeddingsService, OpenAIEmbeddingsService } from './embeddings.service';

@Module({
  providers: [
    OllamaEmbeddingsService,
    OpenAIEmbeddingsService,
    {
      provide: 'EmbeddingsService',
      useFactory: (
        configService: ConfigService,
        ollamaEmbeddings: OllamaEmbeddingsService,
        openaiEmbeddings: OpenAIEmbeddingsService,
      ) => {
        const selected = configService
          .get<string>('EMBEDDINGS_PROVIDER', configService.get<string>('LLM_PROVIDER', 'ollama'))
          .toLowerCase();

        if (selected === 'openai') {
          return openaiEmbeddings;
        }

        return ollamaEmbeddings;
      },
      inject: [ConfigService, OllamaEmbeddingsService, OpenAIEmbeddingsService],
    },
  ],
  exports: ['EmbeddingsService'],
})
export class EmbeddingsModule {}
