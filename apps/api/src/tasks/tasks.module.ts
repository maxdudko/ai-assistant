import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskScoringService } from './task-scoring.service';

@Module({
  imports: [PrismaModule],
  controllers: [TasksController],
  providers: [TasksService, TaskScoringService],
  exports: [TasksService, TaskScoringService],
})
export class TasksModule {}
