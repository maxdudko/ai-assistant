import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

@Injectable()
export class DayInsightService {
  constructor(private readonly prisma: PrismaService) {}

  async generateForDay(dayId: string): Promise<void> {
    const day = await this.prisma.day.findUnique({
      where: { id: dayId },
      include: {
        tasks: {
          select: {
            status: true,
            priority: true,
          },
        },
        user: {
          include: {
            profile: {
              select: { displayName: true },
            },
          },
        },
      },
    });

    if (!day) {
      return;
    }

    const totalTasks = day.tasks.length;
    const completedTasks = day.tasks.filter(task => task.status === TaskStatus.DONE).length;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 1;

    const recentPattern = await this.prisma.memory.findFirst({
      where: {
        userId: day.userId,
        layer: 'PATTERN',
      },
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      select: { content: true, tags: true },
    });

    let consistency = 0.4;
    if (day.startedAt) consistency += 0.2;
    if (day.endedAt) consistency += 0.2;
    if (day.lastActivityAt) consistency += 0.2;
    consistency = clamp(consistency, 0, 1);

    const activeTasks = day.tasks.filter(task => task.status === TaskStatus.IN_PROGRESS).length;
    const overloadPenalty = totalTasks > 5 ? (totalTasks - 5) * 0.08 : 0;
    const switchingPenalty = activeTasks > 2 ? (activeTasks - 2) * 0.1 : 0;
    const patternPenalty =
      recentPattern?.tags?.includes('overcommitment') && totalTasks > 5 ? 0.1 : 0;
    const focus = clamp(1 - overloadPenalty - switchingPenalty - patternPenalty, 0, 1);

    const rawScore = completionRate * 0.5 + consistency * 0.3 + focus * 0.2;
    const score = clamp(Math.round(rawScore * 10), 1, 10);

    const displayName = day.user.profile?.displayName || 'User';
    const summary = this.buildSummary({
      displayName,
      completedTasks,
      totalTasks,
      score,
      pattern: recentPattern?.content,
    });

    await this.prisma.dayInsight.upsert({
      where: { dayId },
      create: {
        dayId: day.id,
        userId: day.userId,
        score,
        completionRate,
        consistency,
        focus,
        summary,
      },
      update: {
        score,
        completionRate,
        consistency,
        focus,
        summary,
      },
    });
  }

  private buildSummary(input: {
    displayName: string;
    completedTasks: number;
    totalTasks: number;
    score: number;
    pattern?: string;
  }): string {
    const lines = [
      `${input.displayName} completed ${input.completedTasks}/${input.totalTasks} tasks today.`,
      `Daily score: ${input.score}/10.`,
    ];

    if (input.pattern) {
      lines.push(`Pattern signal: ${input.pattern}`);
    }

    if (input.totalTasks === 0) {
      lines.push('No tasks were planned; tomorrow can start with one clear priority.');
    } else if (input.completedTasks === 0) {
      lines.push('No tasks were completed; a lighter plan may improve momentum tomorrow.');
    } else if (input.completedTasks === input.totalTasks) {
      lines.push('Strong consistency today. Keep the same focus cadence tomorrow.');
    } else {
      lines.push(
        'Progress was meaningful. Narrowing priorities can improve completion consistency.',
      );
    }

    return lines.join(' ');
  }
}
