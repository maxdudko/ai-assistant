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

  constructor(private readonly configService: ConfigService) {}

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

    const response = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`NewsAPI search failed: ${response.status} ${body}`);
    }

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
}
