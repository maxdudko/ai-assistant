import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TasksModule } from '../tasks/tasks.module';
import { DaysModule } from '../days/days.module';
import { DigestModule } from '../digest/digest.module';
import { MemoryModule } from '../memory/memory.module';

import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';
import { ActionExecutorService } from './action-executor.service';

@Module({
  imports: [PrismaModule, TasksModule, forwardRef(() => DaysModule), DigestModule, MemoryModule],
  controllers: [ActionsController],
  providers: [ActionsService, ActionExecutorService],
  exports: [ActionsService],
})
export class ActionsModule {}
