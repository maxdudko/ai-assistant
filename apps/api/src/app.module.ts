import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { AiModule } from './ai/ai.module';
import { TasksModule } from './tasks/tasks.module';
import { GoalsModule } from './goals/goals.module';
import { DaysModule } from './days/days.module';
import { ActionsModule } from './actions/actions.module';
import { IntentsModule } from './intents/intents.module';
import { SearchModule } from './search/search.module';
import { DigestModule } from './digest/digest.module';
import { MemoryModule } from './memory/memory.module';
import { LogsModule } from './logs/logs.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { DailyModule } from './daily/daily.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    ConversationsModule,
    AiModule,
    TasksModule,
    GoalsModule,
    DaysModule,
    ActionsModule,
    IntentsModule,
    SearchModule,
    DigestModule,
    MemoryModule,
    LogsModule,
    DailyModule,
    SchedulerModule,
    SubscriptionsModule,
    AdminModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
