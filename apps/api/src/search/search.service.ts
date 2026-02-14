import { Inject, Injectable } from '@nestjs/common';

import { SEARCH_PROVIDER, type SearchProvider } from './providers/search-provider.interface';
import type { SearchResult } from './search.types';

@Injectable()
export class SearchService {
  constructor(@Inject(SEARCH_PROVIDER) private readonly provider: SearchProvider) {}

  async search(query: string): Promise<SearchResult[]> {
    return this.provider.search(query);
  }
}
