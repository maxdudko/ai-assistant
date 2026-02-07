import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmbeddingsService } from './embeddings.interface';

@Injectable()
export class OllamaEmbeddingsService implements EmbeddingsService {
  private readonly logger = new Logger(OllamaEmbeddingsService.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly dimension: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('OLLAMA_URL', 'http://localhost:11434');
    this.model = this.configService.get<string>(
      'OLLAMA_EMBED_MODEL',
      this.configService.get<string>('OLLAMA_MODEL', 'nomic-embed-text'),
    );
    this.dimension = Number(this.configService.get<string>('EMBEDDING_DIM', '1536'));
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embeddings failed with status ${response.status}`);
      }

      const data = (await response.json()) as { embedding?: unknown };
      const embedding = Array.isArray(data.embedding) ? data.embedding : null;
      if (!embedding) {
        throw new Error('Ollama embeddings response missing embedding array');
      }

      return this.normalizeEmbedding(embedding);
    } catch (error) {
      this.logger.warn(
        `Falling back to zero embeddings: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return Array(this.dimension).fill(0);
    }
  }

  private normalizeEmbedding(raw: unknown[]): number[] {
    const vector = raw.map(value => (typeof value === 'number' ? value : 0));
    if (vector.length === this.dimension) {
      return vector;
    }

    if (vector.length > this.dimension) {
      this.logger.warn(`Embedding length ${vector.length} > ${this.dimension}, truncating.`);
      return vector.slice(0, this.dimension);
    }

    this.logger.warn(`Embedding length ${vector.length} < ${this.dimension}, padding.`);
    return vector.concat(Array(this.dimension - vector.length).fill(0));
  }
}
