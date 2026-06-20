import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { SearchModule } from '../search/search.module';

import { DigestController } from './digest.controller';
import { DigestService } from './digest.service';

@Module({
  imports: [PrismaModule, AiModule, SearchModule],
  controllers: [DigestController],
  providers: [DigestService],
  exports: [DigestService],
})
export class DigestModule {}
