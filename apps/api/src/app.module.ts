import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
})
export class AppModule {}
