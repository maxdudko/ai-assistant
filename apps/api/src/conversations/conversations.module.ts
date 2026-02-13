import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ActionsModule } from '../actions/actions.module';
import { IntentsModule } from '../intents/intents.module';
import { MemoryModule } from '../memory/memory.module';
import { DaysModule } from '../days/days.module';
import { DigestModule } from '../digest/digest.module';

import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [
    AiModule,
    PrismaModule,
    ActionsModule,
    IntentsModule,
    MemoryModule,
    DaysModule,
    DigestModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
