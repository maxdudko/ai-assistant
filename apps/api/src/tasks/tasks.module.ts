import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { DayResolverModule } from '../days/day-resolver.module';

import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskScoringService } from './task-scoring.service';

@Module({
  imports: [PrismaModule, DayResolverModule],
  controllers: [TasksController],
  providers: [TasksService, TaskScoringService],
  exports: [TasksService, TaskScoringService],
})
export class TasksModule {}
