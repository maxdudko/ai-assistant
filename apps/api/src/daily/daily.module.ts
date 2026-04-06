import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { DailyConversationService } from './daily-conversation.service';
import { DailyEngineService } from './daily-engine.service';
import { DayInsightService } from './day-insight.service';
import { ExecutionMonitorService } from './execution-monitor.service';
import { NudgePolicyService } from './nudge-policy.service';

@Module({
  imports: [PrismaModule],
  providers: [
    DailyConversationService,
    DailyEngineService,
    ExecutionMonitorService,
    DayInsightService,
    NudgePolicyService,
  ],
  exports: [
    DailyConversationService,
    DailyEngineService,
    ExecutionMonitorService,
    DayInsightService,
    NudgePolicyService,
  ],
})
export class DailyModule {}
