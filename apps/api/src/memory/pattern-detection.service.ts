import { Injectable, Logger } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { MemoryIngestionService } from './memory-ingestion.service';
import { MemoryCandidateDto, MemoryLayer, MemoryType } from './dto/memory-candidate.dto';

type DayWithTasks = {
  id: string;
  date: Date;
  tasks: Array<{
    id: string;
    status: TaskStatus;
    updatedAt: Date;
    createdAt: Date;
  }>;
};

type RescheduleAggregate = {
  totalReschedules: number;
  tasksRescheduledMultipleTimes: number;
};

type CompletionTimeBucket = {
  hour: number;
  count: number;
};

@Injectable()
export class PatternDetectionService {
  private readonly logger = new Logger(PatternDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memoryIngestion: MemoryIngestionService,
  ) {}

  async detectForUser(userId: string): Promise<number> {
    const [days, recentPatternMemories, rescheduleAggregate] = await Promise.all([
      this.prisma.day.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 14,
        include: {
          tasks: {
            select: {
              id: true,
              status: true,
              updatedAt: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.memory.findMany({
        where: {
          userId,
          layer: 'PATTERN',
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          tags: true,
          createdAt: true,
        },
      }),
      this.aggregateRecentReschedules(userId),
    ]);

    const candidates: MemoryCandidateDto[] = [];

    if (
      this.isOvercommitmentPattern(days) &&
      !this.hasRecentPatternTag(recentPatternMemories, 'overload')
    ) {
      candidates.push({
        content:
          'You often plan more than you can complete. Reducing daily commitments may improve completion consistency.',
        type: MemoryType.FACTUAL,
        layer: MemoryLayer.PATTERN,
        importance: 9,
        confidence: 0.86,
        tags: ['pattern', 'overload', 'overcommitment', 'planning'],
      });
    }

    if (
      this.isMorningProductivityPattern(days) &&
      !this.hasRecentPatternTag(recentPatternMemories, 'morning-productivity')
    ) {
      candidates.push({
        content:
          'You complete most tasks before noon. Scheduling high-focus work in the morning is likely to be effective.',
        type: MemoryType.FACTUAL,
        layer: MemoryLayer.PATTERN,
        importance: 8,
        confidence: 0.82,
        tags: ['pattern', 'morning-productivity', 'energy', 'productivity-peak'],
      });
    }

    const peak = this.detectProductivityPeak(days);
    if (
      peak &&
      peak.label !== 'morning-productivity' &&
      !this.hasRecentPatternTag(recentPatternMemories, peak.label)
    ) {
      candidates.push({
        content: peak.content,
        type: MemoryType.FACTUAL,
        layer: MemoryLayer.PATTERN,
        importance: 8,
        confidence: 0.8,
        tags: ['pattern', peak.label, 'productivity-peak', 'energy'],
      });
    }

    if (
      this.isProcrastinationPattern(days, rescheduleAggregate) &&
      !this.hasRecentPatternTag(recentPatternMemories, 'procrastination')
    ) {
      candidates.push({
        content: this.buildProcrastinationContent(rescheduleAggregate),
        type: MemoryType.FACTUAL,
        layer: MemoryLayer.PATTERN,
        importance: 9,
        confidence: 0.78,
        tags: ['pattern', 'procrastination', 'planning'],
      });
    }

    if (candidates.length === 0) {
      return 0;
    }

    await this.memoryIngestion.ingest(userId, candidates, 'REFLECTION', {
      dayId: days[0]?.id,
    });
    return candidates.length;
  }

  async runDailyForAllUsers(): Promise<{ processed: number; generated: number; failed: number }> {
    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    let generated = 0;
    let failed = 0;

    for (const user of users) {
      try {
        generated += await this.detectForUser(user.id);
      } catch (error) {
        failed += 1;
        this.logger.error(`Pattern detection failed for user ${user.id}`, error);
      }
    }

    return {
      processed: users.length,
      generated,
      failed,
    };
  }

  async decayStaleMemories(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const result = await this.prisma.memory.updateMany({
      where: {
        importance: { gt: 1 },
        OR: [
          { lastUsedAt: { lt: cutoff } },
          {
            AND: [{ lastUsedAt: null }, { createdAt: { lt: cutoff } }],
          },
        ],
      },
      data: {
        importance: { decrement: 1 },
      },
    });

    return result.count;
  }

  private isOvercommitmentPattern(days: DayWithTasks[]): boolean {
    const recentDays = days.slice(0, 3);
    if (recentDays.length < 3) {
      return false;
    }

    return recentDays.every(day => {
      const totalTasks = day.tasks.length;
      if (totalTasks <= 5) {
        return false;
      }
      const completed = day.tasks.filter(task => task.status === TaskStatus.DONE).length;
      const completionRate = completed / totalTasks;
      return completionRate < 0.5;
    });
  }

  private isMorningProductivityPattern(days: DayWithTasks[]): boolean {
    const completedTasks = days.flatMap(day =>
      day.tasks.filter(task => task.status === TaskStatus.DONE),
    );

    if (completedTasks.length < 5) {
      return false;
    }

    const completedBeforeNoon = completedTasks.filter(
      task => task.updatedAt.getHours() < 12,
    ).length;
    const ratio = completedBeforeNoon / completedTasks.length;
    return ratio >= 0.7;
  }

  /**
   * Detect a non-morning productivity peak (afternoon, evening, or late night).
   * Returns null when completions are evenly spread or follow the morning pattern,
   * which is already handled by isMorningProductivityPattern.
   */
  private detectProductivityPeak(days: DayWithTasks[]): { label: string; content: string } | null {
    const completedTasks = days.flatMap(day =>
      day.tasks.filter(task => task.status === TaskStatus.DONE),
    );
    if (completedTasks.length < 5) {
      return null;
    }

    const buckets: CompletionTimeBucket[] = [
      { hour: 6, count: 0 }, // morning      6-12
      { hour: 12, count: 0 }, // afternoon  12-18
      { hour: 18, count: 0 }, // evening    18-22
      { hour: 22, count: 0 }, // late-night 22-6
    ];
    for (const task of completedTasks) {
      const hour = task.updatedAt.getHours();
      if (hour >= 6 && hour < 12) buckets[0].count += 1;
      else if (hour >= 12 && hour < 18) buckets[1].count += 1;
      else if (hour >= 18 && hour < 22) buckets[2].count += 1;
      else buckets[3].count += 1;
    }

    const total = completedTasks.length;
    const dominant = buckets.reduce((max, bucket) => (bucket.count > max.count ? bucket : max));
    const ratio = dominant.count / total;
    if (ratio < 0.55) {
      return null;
    }

    if (dominant.hour === 6) {
      // Morning peak is reported by the dedicated detector; skip here to avoid duplicates.
      return { label: 'morning-productivity', content: '' };
    }
    if (dominant.hour === 12) {
      return {
        label: 'afternoon-productivity',
        content:
          'You finish most tasks in the afternoon. Protecting that window for focused work is likely to compound results.',
      };
    }
    if (dominant.hour === 18) {
      return {
        label: 'evening-productivity',
        content:
          'You complete most tasks in the evening. Aligning planning with that window can improve consistency.',
      };
    }
    return {
      label: 'late-night-productivity',
      content:
        'Most of your completions happen late at night. This may indicate good focus then, but also a signal worth watching for sleep impact.',
    };
  }

  private isProcrastinationPattern(days: DayWithTasks[], aggregate: RescheduleAggregate): boolean {
    if (aggregate.totalReschedules >= 4 || aggregate.tasksRescheduledMultipleTimes >= 2) {
      return true;
    }

    const allTasks = days.flatMap(day => day.tasks);
    if (allTasks.length === 0) {
      return false;
    }

    const stalled = allTasks.filter(task => {
      if (task.status === TaskStatus.DONE) {
        return false;
      }
      const ageMs = Date.now() - task.createdAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      return ageDays >= 3;
    });

    return stalled.length >= 3 && stalled.length / allTasks.length >= 0.4;
  }

  private buildProcrastinationContent(aggregate: RescheduleAggregate): string {
    if (aggregate.totalReschedules >= 4) {
      return 'Several tasks have been rescheduled multiple times recently. Splitting them into smaller next steps may help break the loop.';
    }
    return 'A number of tasks have been open for several days without progress. Trying a smaller, more concrete first step often unblocks them.';
  }

  private async aggregateRecentReschedules(userId: string): Promise<RescheduleAggregate> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    const logs = await this.prisma.actionExecutionLog.findMany({
      where: {
        userId,
        type: 'RESCHEDULE_TASK',
        status: 'EXECUTED',
        createdAt: { gte: cutoff },
      },
      select: {
        payload: true,
      },
    });

    const perTask = new Map<string, number>();
    for (const log of logs) {
      const taskId = this.extractTaskIdFromPayload(log.payload);
      if (!taskId) continue;
      perTask.set(taskId, (perTask.get(taskId) ?? 0) + 1);
    }

    const tasksRescheduledMultipleTimes = Array.from(perTask.values()).filter(
      count => count >= 2,
    ).length;

    return {
      totalReschedules: logs.length,
      tasksRescheduledMultipleTimes,
    };
  }

  private extractTaskIdFromPayload(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const record = payload as Record<string, unknown>;
    const taskId = record.taskId ?? record.task_id;
    return typeof taskId === 'string' ? taskId : null;
  }

  private hasRecentPatternTag(
    memories: Array<{ tags: string[]; createdAt: Date }>,
    tag: string,
  ): boolean {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return memories.some(memory => memory.createdAt >= cutoff && memory.tags.includes(tag));
  }
}
