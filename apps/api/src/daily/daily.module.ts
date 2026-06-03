import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TasksModule } from '../tasks/tasks.module';
import { MemoryModule } from '../memory/memory.module';
import { DayResolverModule } from '../days/day-resolver.module';
import { ActionsModule } from '../actions/actions.module';
import { AiModule } from '../ai/ai.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

import { DailyConversationService } from './daily-conversation.service';
import { DailyEngineService } from './daily-engine.service';
import { DecisionEngineService } from './decision-engine.service';
import { DayInsightService } from './day-insight.service';
import { ExecutionMonitorService } from './execution-monitor.service';
import { NudgePolicyService } from './nudge-policy.service';
import { UnifiedContextService } from './unified-context.service';
import { WeeklyInsightService } from './weekly-insight.service';

@Module({
  imports: [
    PrismaModule,
    TasksModule,
    MemoryModule,
    DayResolverModule,
    AiModule,
    SubscriptionsModule,
    forwardRef(() => ActionsModule),
  ],
  providers: [
    DailyConversationService,
    DailyEngineService,
    DecisionEngineService,
    ExecutionMonitorService,
    DayInsightService,
    NudgePolicyService,
    UnifiedContextService,
    WeeklyInsightService,
  ],
  exports: [
    DailyConversationService,
    DailyEngineService,
    DecisionEngineService,
    ExecutionMonitorService,
    DayInsightService,
    NudgePolicyService,
    UnifiedContextService,
    WeeklyInsightService,
  ],
})
export class DailyModule {}
