import { Injectable } from '@nestjs/common';

import { EmbeddingsService } from './embeddings.interface';

@Injectable()
export class OllamaEmbeddingsService implements EmbeddingsService {
  async embed(text: string): Promise<number[]> {
    // v0 stub (replace with real provider)
    return Array(1536).fill(0);
  }
}
