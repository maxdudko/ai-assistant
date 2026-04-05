import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { DaysModule } from '../days/days.module';
import { MemoryModule } from '../memory/memory.module';

import { DailyFlowScheduler } from './daily-flow.scheduler';
import { SchedulerController } from './scheduler.controller';

@Module({
  imports: [PrismaModule, DaysModule, MemoryModule],
  controllers: [SchedulerController],
  providers: [DailyFlowScheduler],
})
export class SchedulerModule {}
