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

    // Warn if using a model that likely doesn't support embeddings
    const commonChatModels = ['gemma', 'llama', 'mistral', 'phi', 'qwen'];
    const isLikelyChatModel = commonChatModels.some(
      name =>
        this.model.toLowerCase().includes(name) && !this.model.toLowerCase().includes('embed'),
    );

    if (isLikelyChatModel && !this.configService.get<string>('OLLAMA_EMBED_MODEL')) {
      this.logger.warn(
        `Using model '${this.model}' for embeddings. This model may not support embeddings. ` +
          `Consider setting OLLAMA_EMBED_MODEL to an embedding model like 'nomic-embed-text'. ` +
          `Install with: ollama pull nomic-embed-text`,
      );
    }
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
        // Try to get error details from response
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = errorData.error || JSON.stringify(errorData);
        } catch {
          errorDetails = await response.text().catch(() => 'Unable to read error response');
        }

        const errorMessage = `Ollama embeddings failed with status ${response.status}${errorDetails ? `: ${errorDetails}` : ''}`;

        // Check if it's a model compatibility issue
        if (response.status === 500 && errorDetails.toLowerCase().includes('embedding')) {
          this.logger.error(
            `${errorMessage}. The model '${this.model}' may not support embeddings. ` +
              `Please ensure you have an embedding model installed (e.g., 'nomic-embed-text'). ` +
              `Set OLLAMA_EMBED_MODEL environment variable to use a different model for embeddings.`,
          );
        } else {
          this.logger.error(errorMessage);
        }

        throw new Error(errorMessage);
      }

      const data = (await response.json()) as { embedding?: unknown };
      const embedding = Array.isArray(data.embedding) ? data.embedding : null;
      if (!embedding) {
        throw new Error('Ollama embeddings response missing embedding array');
      }

      return this.normalizeEmbedding(embedding);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Falling back to zero embeddings: ${errorMessage}. ` +
          `This will result in non-functional vector search. Please fix the embeddings service configuration.`,
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
