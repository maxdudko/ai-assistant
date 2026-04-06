import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TasksModule } from '../tasks/tasks.module';

import { DailyConversationService } from './daily-conversation.service';
import { DailyEngineService } from './daily-engine.service';
import { DecisionEngineService } from './decision-engine.service';
import { DayInsightService } from './day-insight.service';
import { ExecutionMonitorService } from './execution-monitor.service';
import { NudgePolicyService } from './nudge-policy.service';

@Module({
  imports: [PrismaModule, TasksModule],
  providers: [
    DailyConversationService,
    DailyEngineService,
    DecisionEngineService,
    ExecutionMonitorService,
    DayInsightService,
    NudgePolicyService,
  ],
  exports: [
    DailyConversationService,
    DailyEngineService,
    DecisionEngineService,
    ExecutionMonitorService,
    DayInsightService,
    NudgePolicyService,
  ],
})
export class DailyModule {}
