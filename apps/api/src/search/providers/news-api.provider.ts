import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { SearchResult } from '../search.types';

import type { SearchProvider } from './search-provider.interface';

interface NewsApiArticle {
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
}

interface NewsApiResponse {
  status: string;
  articles?: NewsApiArticle[];
}

@Injectable()
export class NewsApiProvider implements SearchProvider {
  private readonly logger = new Logger(NewsApiProvider.name);
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;

  constructor(private readonly configService: ConfigService) {
    this.requestTimeoutMs = Number(this.configService.get<string>('NEWS_API_TIMEOUT_MS', '5000'));
    this.maxRetries = Number(this.configService.get<string>('NEWS_API_RETRIES', '1'));
  }

  getName(): string {
    return 'newsapi';
  }

  async search(query: string): Promise<SearchResult[]> {
    const apiKey = this.configService.get<string>('NEWS_API_KEY');
    if (!apiKey) {
      // TODO(info-digest): wire real NewsAPI credentials in environment configuration.
      this.logger.warn('NEWS_API_KEY is not configured. Returning empty search results.');
      return [];
    }

    const params = new URLSearchParams({
      q: query,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: '8',
      apiKey,
    });

    const response = await this.fetchWithRetry(
      `https://newsapi.org/v2/everything?${params.toString()}`,
      this.maxRetries,
    );

    const data = (await response.json()) as NewsApiResponse;
    if (data.status !== 'ok' || !Array.isArray(data.articles)) {
      return [];
    }

    return data.articles
      .filter(article => article.title && article.url)
      .map(article => ({
        title: article.title ?? '',
        snippet: article.description ?? '',
        url: article.url ?? '',
        publishedAt: article.publishedAt ?? null,
      }));
  }

  private async fetchWithRetry(url: string, retries: number): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (response.ok) {
          return response;
        }

        const body = await response.text();
        throw new Error(`NewsAPI search failed: ${response.status} ${body}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        lastError = new Error(message);
        if (attempt < retries) {
          this.logger.warn(`NewsAPI request attempt ${attempt + 1} failed, retrying: ${message}`);
          await this.sleep(200 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error('NewsAPI search failed');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
