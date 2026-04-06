import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export type ExecutionSignals = {
  noProgress: boolean;
  stuckTask: { id: string; name: string } | null;
  totalTasks: number;
  completedTasks: number;
};

@Injectable()
export class ExecutionMonitorService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(dayId: string, localHour: number, now = new Date()): Promise<ExecutionSignals> {
    const tasks = await this.prisma.task.findMany({
      where: { dayId },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === TaskStatus.DONE).length;

    const noProgress = localHour >= 14 && totalTasks > 0 && completedTasks === 0;

    const stuckThresholdMs = 3 * 60 * 60 * 1000;
    const stuckCandidate = tasks
      .filter(task => task.status === TaskStatus.IN_PROGRESS)
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
      .find(task => now.getTime() - task.updatedAt.getTime() >= stuckThresholdMs);

    return {
      noProgress,
      stuckTask: stuckCandidate ? { id: stuckCandidate.id, name: stuckCandidate.name } : null,
      totalTasks,
      completedTasks,
    };
  }
}
