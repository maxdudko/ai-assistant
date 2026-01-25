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
    const normalized = text.toLowerCase();
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

    if (normalized.includes('done') || normalized.includes('completed')) {
      const matchedTask = this.matchTask(tasks, normalized);
      const taskName = matchedTask?.name || this.extractCompletionTitle(normalized);
      actions.push({
        id: randomUUID(),
        type: 'TASK_UPDATE_STATUS',
        confidence: matchedTask ? 0.75 : 0.6,
        requiresConfirmation: true,
        payload: {
          taskId: matchedTask?.id,
          taskName,
          status: 'DONE',
        },
      });
    }

    return actions;
  }

  private extractTitle(text: string): string {
    return text.replace(/add|create task/gi, '').trim();
  }

  private extractCompletionTitle(text: string): string | undefined {
    const cleaned = text
      .replace(/i\s+have\s+completed|i\s+completed|i\s+have\s+done|i\s+did/gi, '')
      .replace(/done|completed|finish|finished/gi, '')
      .replace(/[.?!]/g, '')
      .trim();
    return cleaned.length > 0 ? cleaned : undefined;
  }

  private matchTask(tasks: TaskSummary[], text: string): TaskSummary | undefined {
    return tasks.find(task => text.includes(task.name.toLowerCase()));
  }
}
