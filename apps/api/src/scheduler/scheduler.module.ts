import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { DaysModule } from '../days/days.module';

import { DailyFlowScheduler } from './daily-flow.scheduler';
import { SchedulerController } from './scheduler.controller';

@Module({
  imports: [PrismaModule, DaysModule],
  controllers: [SchedulerController],
  providers: [DailyFlowScheduler],
})
export class SchedulerModule {}
