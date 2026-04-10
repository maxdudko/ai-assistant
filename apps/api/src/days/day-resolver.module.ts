import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { DayResolverService } from './day-resolver.service';

@Module({
  imports: [PrismaModule],
  providers: [DayResolverService],
  exports: [DayResolverService],
})
export class DayResolverModule {}
