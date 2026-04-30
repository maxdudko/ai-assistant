import { Injectable, Logger } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { MemoryIngestionService } from './memory-ingestion.service';
import { MemoryCandidateDto, MemoryLayer, MemoryType } from './dto/memory-candidate.dto';

type DayWithTasks = {
  id: string;
  date: Date;
  tasks: Array<{
    status: TaskStatus;
    updatedAt: Date;
  }>;
};

@Injectable()
export class PatternDetectionService {
  private readonly logger = new Logger(PatternDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memoryIngestion: MemoryIngestionService,
  ) {}

  async detectForUser(userId: string): Promise<number> {
    const [days, recentPatternMemories] = await Promise.all([
      this.prisma.day.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 14,
        include: {
          tasks: {
            select: {
              status: true,
              updatedAt: true,
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
    ]);

    const candidates: MemoryCandidateDto[] = [];

    if (
      this.isOvercommitmentPattern(days) &&
      !this.hasRecentPatternTag(recentPatternMemories, 'overcommitment')
    ) {
      candidates.push({
        content:
          'You often plan more than you can complete. Reducing daily commitments may improve completion consistency.',
        type: MemoryType.FACTUAL,
        layer: MemoryLayer.PATTERN,
        importance: 9,
        confidence: 0.86,
        tags: ['pattern', 'overcommitment', 'planning'],
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
        tags: ['pattern', 'morning-productivity', 'energy'],
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

  private hasRecentPatternTag(
    memories: Array<{ tags: string[]; createdAt: Date }>,
    tag: string,
  ): boolean {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return memories.some(memory => memory.createdAt >= cutoff && memory.tags.includes(tag));
  }
}
