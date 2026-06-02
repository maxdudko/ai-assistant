import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { MemoryModule } from '../memory/memory.module';
import { DailyModule } from '../daily/daily.module';

import { DayResolverModule } from './day-resolver.module';
import { DaysController } from './days.controller';
import { DaysService } from './days.service';
import { WeeklyInsightController } from './weekly-insight.controller';

@Module({
  imports: [PrismaModule, MemoryModule, forwardRef(() => DailyModule), DayResolverModule],
  controllers: [DaysController, WeeklyInsightController],
  providers: [DaysService],
  exports: [DaysService],
})
export class DaysModule {}
