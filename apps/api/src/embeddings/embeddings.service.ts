import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmbeddingsService } from './embeddings.interface';

@Injectable()
export class OllamaEmbeddingsService implements EmbeddingsService {
  private readonly logger = new Logger(OllamaEmbeddingsService.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly dimension: number;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('OLLAMA_URL', 'http://localhost:11434');
    this.model = this.configService.get<string>(
      'OLLAMA_EMBED_MODEL',
      this.configService.get<string>('OLLAMA_MODEL', 'nomic-embed-text'),
    );
    this.dimension = Number(this.configService.get<string>('EMBEDDING_DIM', '3072'));
    this.requestTimeoutMs = Number(
      this.configService.get<string>('OLLAMA_EMBED_TIMEOUT_MS', '5000'),
    );
    this.maxRetries = Number(this.configService.get<string>('OLLAMA_EMBED_RETRIES', '1'));

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
      const response = await this.fetchEmbeddingWithRetry(text, this.maxRetries);

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

  private async fetchEmbeddingWithRetry(text: string, retries: number): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      try {
        const response = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.model,
            prompt: text,
          }),
        });
        if (response.ok) {
          return response;
        }
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        lastError = new Error(message);
        if (attempt < retries) {
          this.logger.warn(`Embedding request attempt ${attempt + 1} failed, retrying: ${message}`);
          await this.sleep(200 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error('Embedding request failed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

@Injectable()
export class OpenAIEmbeddingsService implements EmbeddingsService {
  private readonly logger = new Logger(OpenAIEmbeddingsService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly dimension: number;
  private readonly requestTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    this.baseUrl = this.configService.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1');
    this.model = this.configService.get<string>('OPENAI_EMBED_MODEL', 'text-embedding-3-large');
    this.dimension = Number(this.configService.get<string>('EMBEDDING_DIM', '3072'));
    this.requestTimeoutMs = Number(
      this.configService.get<string>('OPENAI_EMBED_TIMEOUT_MS', '5000'),
    );
  }

  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) {
      this.logger.error(
        'OPENAI_API_KEY is missing while OpenAI embeddings are enabled. Returning zero vector.',
      );
      return Array(this.dimension).fill(0);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.model,
            input: text,
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        throw new Error(`OpenAI embeddings failed with status ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as {
        data?: Array<{ embedding?: unknown }>;
      };
      const embedding = Array.isArray(data.data) ? data.data[0]?.embedding : null;
      if (!Array.isArray(embedding)) {
        throw new Error('OpenAI embeddings response missing embedding array');
      }

      return this.normalizeEmbedding(embedding);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Falling back to zero embeddings: ${errorMessage}. ` +
          `This will result in non-functional vector search. Please fix OpenAI embeddings configuration.`,
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
