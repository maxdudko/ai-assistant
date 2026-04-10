import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';
import type { ActionCandidate } from '@ai/shared-types';

interface TaskSummary {
  id: string;
  name: string;
}

@Injectable()
export class IntentDetectorService {
  detect(text: string, tasks: TaskSummary[] = []): ActionCandidate[] {
    const normalized = this.normalize(text);
    const actions: ActionCandidate[] = [];

    if (normalized.startsWith('add ') || normalized.startsWith('create task')) {
      const title = this.extractTitle(normalized);
      if (title) {
        actions.push({
          id: randomUUID(),
          type: 'TASK_CREATE',
          confidence: 0.8,
          requiresConfirmation: true,
          payload: {
            title,
          },
        });
      }
    }

    if (this.isCompletionIntent(normalized)) {
      const matchedTasks = this.matchTasks(tasks, normalized);
      if (matchedTasks.length > 0) {
        for (const matchedTask of matchedTasks) {
          actions.push({
            id: randomUUID(),
            type: 'TASK_UPDATE_STATUS',
            confidence: 0.82,
            requiresConfirmation: true,
            payload: {
              taskId: matchedTask.id,
              taskName: matchedTask.name,
              status: 'DONE',
            },
          });
        }
      } else {
        const taskName = this.extractCompletionTitle(normalized);
        if (taskName) {
          actions.push({
            id: randomUUID(),
            type: 'TASK_UPDATE_STATUS',
            confidence: 0.6,
            requiresConfirmation: true,
            payload: {
              taskName,
              status: 'DONE',
            },
          });
        }
      }
    }

    return actions;
  }

  private extractTitle(text: string): string {
    return text.replace(/add|create task/gi, '').trim();
  }

  private extractCompletionTitle(text: string): string | undefined {
    const cleaned = text
      .replace(/i\s+have\s+completed|i\s+completed|i\s+have\s+done|i\s+did/gi, '')
      .replace(/mark|set|update|change/gi, '')
      .replace(/as/gi, '')
      .replace(/done|completed|complete|finish|finished|status/gi, '')
      .replace(/[.?!]/g, '')
      .trim();
    return cleaned.length > 0 && cleaned.length <= 120 ? cleaned : undefined;
  }

  private isCompletionIntent(text: string): boolean {
    const hasTaskStateWord = /\b(done|completed|complete|finished)\b/.test(text);
    const hasMutationVerb = /\b(mark|set|update|change|complete|finish)\b/.test(text);
    return hasTaskStateWord && hasMutationVerb;
  }

  private matchTasks(tasks: TaskSummary[], text: string): TaskSummary[] {
    const deduped = new Map<string, TaskSummary>();
    const segments = text
      .split(/,| and | & |\n/)
      .map(part => part.trim())
      .filter(Boolean);

    for (const task of tasks) {
      const taskName = this.normalize(task.name);
      const exactMatch = text.includes(taskName);
      const segmentMatch = segments.some(segment => {
        if (segment.length < 3) {
          return false;
        }
        return taskName.includes(segment) || segment.includes(taskName);
      });
      if (exactMatch || segmentMatch) {
        deduped.set(task.id, task);
      }
    }

    return Array.from(deduped.values());
  }

  private normalize(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
  }
}
