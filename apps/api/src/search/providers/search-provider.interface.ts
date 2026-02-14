import type { SearchResult } from '../search.types';

export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
  getName(): string;
}

export const SEARCH_PROVIDER = Symbol('SEARCH_PROVIDER');
