import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { MemoryModule } from '../memory/memory.module';
import { DailyModule } from '../daily/daily.module';

import { DaysController } from './days.controller';
import { DaysService } from './days.service';

@Module({
  imports: [PrismaModule, MemoryModule, DailyModule],
  controllers: [DaysController],
  providers: [DaysService],
  exports: [DaysService],
})
export class DaysModule {}
