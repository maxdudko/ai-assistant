import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { MemoryModule } from '../memory/memory.module';
import { DailyModule } from '../daily/daily.module';

import { DailyFlowScheduler } from './daily-flow.scheduler';
import { SchedulerController } from './scheduler.controller';

@Module({
  imports: [PrismaModule, MemoryModule, DailyModule],
  controllers: [SchedulerController],
  providers: [DailyFlowScheduler],
})
export class SchedulerModule {}
