import { Injectable } from '@nestjs/common';
import { TaskPriority, TaskStatus } from '@prisma/client';

const DEFAULT_AVAILABLE_MINUTES = 8 * 60;

type IntelligenceTask = {
  id: string;
  name: string;
  status: TaskStatus;
  priority: TaskPriority;
  difficulty?: number | null;
  estimatedMinutes?: number | null;
  deadline?: Date | null;
};

type TopTaskOptions = {
  limit?: number;
  morningFocus?: boolean;
  includeHighImpact?: boolean;
};

@Injectable()
export class TaskScoringService {
  scoreTask(task: IntelligenceTask, options?: { morningFocus?: boolean; now?: Date }): number {
    const priority = this.priorityWeight(task.priority);
    const urgency = this.urgencyScore(task.deadline ?? null, options?.now ?? new Date());
    const difficulty = this.normalizeDifficulty(task.difficulty);
    const inverseDifficulty = 1 / difficulty;

    let score = priority * 0.5 + urgency * 0.3 + inverseDifficulty * 0.2;
    if (options?.morningFocus && this.estimateTaskMinutes(task) >= 60) {
      score += 0.15;
    }

    return score;
  }

  estimateTaskMinutes(task: Pick<IntelligenceTask, 'difficulty' | 'estimatedMinutes'>): number {
    if (typeof task.estimatedMinutes === 'number' && task.estimatedMinutes > 0) {
      return Math.round(task.estimatedMinutes);
    }

    const difficulty = this.normalizeDifficulty(task.difficulty);
    if (difficulty <= 1) return 20;
    if (difficulty === 2) return 35;
    if (difficulty === 3) return 50;
    if (difficulty === 4) return 75;
    return 105;
  }

  totalEstimatedTime(tasks: IntelligenceTask[]): number {
    return tasks
      .filter(task => task.status !== TaskStatus.DONE)
      .reduce((total, task) => total + this.estimateTaskMinutes(task), 0);
  }

  getAvailableMinutes(): number {
    return DEFAULT_AVAILABLE_MINUTES;
  }

  isOverloaded(tasks: IntelligenceTask[], availableMinutes = DEFAULT_AVAILABLE_MINUTES): boolean {
    return this.totalEstimatedTime(tasks) > availableMinutes;
  }

  getTopTasks(tasks: IntelligenceTask[], options?: TopTaskOptions): IntelligenceTask[] {
    const limit = Math.max(1, options?.limit ?? 2);
    const includeHighImpact = options?.includeHighImpact ?? true;
    const pending = tasks.filter(task => task.status !== TaskStatus.DONE);
    if (pending.length === 0) {
      return [];
    }

    const scored = pending.map(task => ({
      task,
      score: this.scoreTask(task, { morningFocus: options?.morningFocus }),
      minutes: this.estimateTaskMinutes(task),
    }));

    const highImpact = scored
      .filter(entry => entry.task.priority === TaskPriority.HIGH)
      .sort((a, b) => b.score - a.score || a.minutes - b.minutes)[0];

    const quickWinSorted = [...scored].sort((a, b) => {
      if (options?.morningFocus) {
        const aHeavy = a.minutes >= 60 || this.normalizeDifficulty(a.task.difficulty) >= 4 ? 1 : 0;
        const bHeavy = b.minutes >= 60 || this.normalizeDifficulty(b.task.difficulty) >= 4 ? 1 : 0;
        if (aHeavy !== bHeavy) {
          return bHeavy - aHeavy;
        }
      }

      const aQuick = a.minutes <= 30 ? 1 : 0;
      const bQuick = b.minutes <= 30 ? 1 : 0;
      if (aQuick !== bQuick) {
        return bQuick - aQuick;
      }
      if (Math.abs(a.score - b.score) > 0.0001) {
        return b.score - a.score;
      }
      return a.minutes - b.minutes;
    });

    const selected: Array<(typeof scored)[number]> = [];
    if (includeHighImpact && highImpact) {
      selected.push(highImpact);
    }

    for (const entry of quickWinSorted) {
      if (selected.some(existing => existing.task.id === entry.task.id)) {
        continue;
      }
      selected.push(entry);
      if (selected.length >= limit) {
        break;
      }
    }

    return selected.slice(0, limit).map(entry => entry.task);
  }

  private normalizeDifficulty(value?: number | null): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 3;
    }
    return Math.min(5, Math.max(1, Math.round(value)));
  }

  private urgencyScore(deadline: Date | null, now: Date): number {
    if (!deadline) {
      return 0.4;
    }

    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs <= 0) return 1;
    const diffHours = diffMs / (60 * 60 * 1000);
    if (diffHours <= 24) return 0.95;
    if (diffHours <= 72) return 0.75;
    if (diffHours <= 168) return 0.6;
    return 0.45;
  }

  private priorityWeight(priority: TaskPriority): number {
    if (priority === TaskPriority.HIGH) return 3;
    if (priority === TaskPriority.MEDIUM) return 2;
    return 1;
  }
}
