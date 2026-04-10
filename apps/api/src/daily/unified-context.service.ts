import { Injectable, Logger } from '@nestjs/common';
import { Day, Task, TaskStatus } from '@prisma/client';

import { DayResolverService } from '../days/day-resolver.service';
import {
  MemoryRetrieverService,
  RetrievedMemory,
  RetrievedMemoryContext,
} from '../memory/memory-retriever.service';
import { PrismaService } from '../prisma/prisma.service';
import { TaskScoringService } from '../tasks/task-scoring.service';

import { DailyEvent } from './daily.types';

export type ScoredTask = {
  taskId: string;
  score: number;
  estimatedMinutes: number;
  status: TaskStatus;
};

export type UnifiedContext = {
  day: Day;
  tasks: Task[];
  scoredTasks: ScoredTask[];
  memory: {
    patterns: RetrievedMemory[];
    semantic: RetrievedMemory[];
    recent: RetrievedMemory[];
    important: RetrievedMemory[];
  };
  load: {
    totalEstimated: number;
    available: number;
    isOverloaded: boolean;
  };
};

@Injectable()
export class UnifiedContextService {
  private readonly logger = new Logger(UnifiedContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dayResolver: DayResolverService,
    private readonly memoryRetriever: MemoryRetrieverService,
    private readonly taskScoring: TaskScoringService,
  ) {}

  async getContext(params: {
    userId: string;
    event?: DailyEvent;
    query?: string;
    now?: Date;
  }): Promise<UnifiedContext> {
    const day = params.now
      ? await this.dayResolver.getDayForMoment(params.userId, params.now)
      : await this.dayResolver.getCurrentDay(params.userId);
    const memoryQuery = params.query ?? this.buildMemoryQuery(params.event);

    const [tasks, memoryContext] = await Promise.all([
      this.prisma.task.findMany({
        where: { dayId: day.id },
        orderBy: [{ createdAt: 'asc' }],
      }),
      this.memoryRetriever.getMemoryContext(params.userId, memoryQuery, {
        patternLimit: 5,
        semanticLimit: 5,
        recentLimit: 5,
        importantLimit: 5,
        limit: 7,
      }),
    ]);

    if (memoryContext.merged.length > 0) {
      void this.memoryRetriever
        .trackUsage(memoryContext.merged.map(memory => memory.id))
        .catch(error => {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Memory usage tracking skipped: ${reason}`);
        });
    }

    const memory = {
      patterns: memoryContext.patterns,
      semantic: memoryContext.semantic,
      recent: memoryContext.recent,
      important: memoryContext.important,
    };
    const morningFocusPattern = this.hasMorningFocusPattern(memory.patterns);
    const scoredTasks = tasks
      .map(task => ({
        taskId: task.id,
        score: this.taskScoring.scoreTask(task, { morningFocus: morningFocusPattern }),
        estimatedMinutes: this.taskScoring.estimateTaskMinutes(task),
        status: task.status,
      }))
      .sort((a, b) => b.score - a.score);

    const available = this.taskScoring.getAvailableMinutes();
    const totalEstimated = this.taskScoring.totalEstimatedTime(tasks);

    return {
      day,
      tasks,
      scoredTasks,
      memory,
      load: {
        totalEstimated,
        available,
        isOverloaded: this.taskScoring.isOverloaded(tasks, available),
      },
    };
  }

  private buildMemoryQuery(event?: DailyEvent): string {
    if (!event) {
      return 'daily planning and execution context';
    }
    if (event.type === 'DAY_START') {
      return 'morning planning and focus patterns';
    }
    if (event.type === 'INACTIVITY') {
      return 'inactivity blockers and motivation patterns';
    }
    if (event.type === 'TIME_TRIGGER') {
      return 'time-based planning and reflection context';
    }
    return 'active execution and momentum patterns';
  }

  private hasMorningFocusPattern(patterns: RetrievedMemoryContext['patterns']): boolean {
    return patterns.some(pattern => {
      const content = pattern.content.toLowerCase();
      return (
        pattern.tags.includes('morning-focus') ||
        pattern.tags.includes('morning-productivity') ||
        content.includes('morning focus') ||
        content.includes('before noon')
      );
    });
  }
}
