import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SearchService } from './search.service';
import { NewsApiProvider } from './providers/news-api.provider';
import { SEARCH_PROVIDER } from './providers/search-provider.interface';

@Module({
  imports: [ConfigModule],
  providers: [
    SearchService,
    {
      provide: SEARCH_PROVIDER,
      useClass: NewsApiProvider,
    },
  ],
  exports: [SearchService],
})
export class SearchModule {}
