import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { DayPhase, DayState, TaskPriority, TaskStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PatternDetectionService } from '../memory/pattern-detection.service';
import { DayInsightService } from '../daily/day-insight.service';
import { DailyEngineService } from '../daily/daily-engine.service';

import { DayResolverService } from './day-resolver.service';

@Injectable()
export class DaysService {
  private readonly logger = new Logger(DaysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patternDetection: PatternDetectionService,
    private readonly dayInsight: DayInsightService,
    @Inject(forwardRef(() => DailyEngineService))
    private readonly dailyEngine: DailyEngineService,
    private readonly dayResolver: DayResolverService,
  ) {}

  /**
   * Get today's day, create if it doesn't exist
   */
  async getToday(userId: string) {
    const day = await this.dayResolver.getCurrentDay(userId);
    return this.prisma.day.findUniqueOrThrow({
      where: { id: day.id },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
        },
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 1, // Get first message for preview
            },
            _count: {
              select: { messages: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Start the day - change to ACTIVE state and set startedAt
   */
  async start(userId: string, date?: Date) {
    const day = await this.dayResolver.getDayForMoment(userId, date ?? new Date());

    const updated = await this.prisma.day.update({
      where: { id: day.id },
      data: {
        state: DayState.ACTIVE,
        phase: day.phase === DayPhase.NOT_STARTED ? DayPhase.MORNING : day.phase,
        startedAt: day.startedAt || new Date(),
      },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
        },
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
            _count: {
              select: { messages: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    void this.dailyEngine.handleEvent(userId, { type: 'DAY_START' }).catch(error => {
      this.logger.warn(
        `Daily engine skipped after manual day start: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    return updated;
  }

  /**
   * End the day - change to END state and set endedAt
   */
  async end(userId: string, date?: Date) {
    const day = await this.dayResolver.getDayForMoment(userId, date ?? new Date());

    const endedDay = await this.prisma.day.update({
      where: { id: day.id },
      data: {
        state: DayState.END,
        phase: DayPhase.CLOSED,
        endedAt: new Date(),
      },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
        },
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
            _count: {
              select: { messages: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    void this.patternDetection.detectForUser(userId).catch(error => {
      this.logger.warn(
        `Pattern detection skipped after day end: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    void this.dayInsight.generateForDay(endedDay.id).catch(error => {
      this.logger.warn(
        `Day insight generation skipped after day end: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    return endedDay;
  }

  /**
   * Get day summary with conversations and completion status
   */
  async getSummary(userId: string) {
    const currentDay = await this.dayResolver.getCurrentDay(userId);
    const day = await this.prisma.day.findUnique({
      where: { id: currentDay.id },
      include: {
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
            _count: {
              select: { messages: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        tasks: {
          include: {
            goal: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!day) {
      // If day doesn't exist, return empty summary
      return {
        day: null,
        conversations: [],
        taskSummary: {
          total: 0,
          todo: 0,
          inProgress: 0,
          done: 0,
          completionRate: 0,
        },
      };
    }

    // Calculate task completion status
    const totalTasks = day.tasks.length;
    const todoTasks = day.tasks.filter(t => t.status === 'TODO').length;
    const inProgressTasks = day.tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const doneTasks = day.tasks.filter(t => t.status === 'DONE').length;
    const completionRate = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

    return {
      day: {
        id: day.id,
        date: day.date,
        state: day.state,
        phase: day.phase,
        startedAt: day.startedAt,
        endedAt: day.endedAt,
        lastActivityAt: day.lastActivityAt,
        createdAt: day.createdAt,
      },
      conversations: day.conversations.map(conv => ({
        id: conv.id,
        mode: conv.mode,
        state: conv.state,
        type: conv.type,
        messageCount: conv._count.messages,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      })),
      taskSummary: {
        total: totalTasks,
        todo: todoTasks,
        inProgress: inProgressTasks,
        done: doneTasks,
        completionRate: Math.round(completionRate * 100) / 100, // Round to 2 decimal places
      },
      tasks: day.tasks.map(task => ({
        id: task.id,
        name: task.name,
        status: task.status,
        priority: task.priority,
        goal: task.goal,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })),
    };
  }

  /**
   * Build a lightweight morning briefing:
   * - today's tasks
   * - top 1-2 priorities for the day
   */
  async getMorningBriefing(userId: string) {
    const day = await this.getToday(userId);
    const tasks = day.tasks ?? [];

    const priorities = tasks
      .filter(task => task.status !== TaskStatus.DONE)
      .sort((a, b) => this.compareTasksForPriority(a, b))
      .slice(0, 2)
      .map(task => ({
        id: task.id,
        name: task.name,
        priority: task.priority,
        deadline: task.deadline,
        reason: this.getPriorityReason(task.priority, task.deadline),
      }));

    return {
      day: {
        id: day.id,
        date: day.date,
        state: day.state,
        phase: day.phase,
      },
      tasks: tasks.map(task => ({
        id: task.id,
        name: task.name,
        status: task.status,
        priority: task.priority,
        deadline: task.deadline,
      })),
      priorities,
    };
  }

  async startDay(userId: string, date?: string) {
    const parsed = date ? new Date(date) : undefined;
    return this.start(userId, parsed);
  }

  async endDay(userId: string, date?: string) {
    const parsed = date ? new Date(date) : undefined;
    return this.end(userId, parsed);
  }

  private compareTasksForPriority(
    a: { priority: TaskPriority; deadline: Date | null; createdAt: Date },
    b: { priority: TaskPriority; deadline: Date | null; createdAt: Date },
  ): number {
    const priorityDiff = this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    if (a.deadline && b.deadline) {
      return a.deadline.getTime() - b.deadline.getTime();
    }

    if (a.deadline && !b.deadline) {
      return -1;
    }

    if (!a.deadline && b.deadline) {
      return 1;
    }

    return a.createdAt.getTime() - b.createdAt.getTime();
  }

  private getPriorityWeight(priority: TaskPriority): number {
    switch (priority) {
      case TaskPriority.HIGH:
        return 3;
      case TaskPriority.MEDIUM:
        return 2;
      case TaskPriority.LOW:
      default:
        return 1;
    }
  }

  private getPriorityReason(priority: TaskPriority, deadline: Date | null): string {
    if (priority === TaskPriority.HIGH) {
      return 'High priority task';
    }

    if (deadline) {
      return 'Upcoming deadline';
    }

    return 'Important next step for today';
  }
}
