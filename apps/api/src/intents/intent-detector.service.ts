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
    const batchTaskTitles = this.extractBatchTaskTitles(text);

    if (batchTaskTitles.length > 0) {
      for (const title of batchTaskTitles) {
        actions.push({
          id: randomUUID(),
          type: 'TASK_CREATE',
          confidence: 0.86,
          requiresConfirmation: true,
          payload: {
            title,
          },
        });
      }
    }

    if (
      actions.length === 0 &&
      (normalized.startsWith('add ') || normalized.startsWith('create task'))
    ) {
      const payload = this.extractSingleTaskCreatePayload(text);
      if (payload?.title) {
        actions.push({
          id: randomUUID(),
          type: 'TASK_CREATE',
          confidence: 0.8,
          requiresConfirmation: true,
          payload,
        });
      }
    }

    if (actions.length === 0) {
      const payload = this.extractSingleTaskCreatePayload(text);
      if (payload?.title) {
        actions.push({
          id: randomUUID(),
          type: 'TASK_CREATE',
          confidence: 0.82,
          requiresConfirmation: true,
          payload,
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

  private extractSingleTaskCreatePayload(text: string): Record<string, unknown> | null {
    const normalizedText = text.replace(/_/g, ' ').trim();
    const createMatch = normalizedText.match(
      /\b(?:create|add)(?:\s+an?\s+action)?\s*:\s*(?:create\s+)?(?:new\s+)?task\b\s*:?\s*(.+)$/i,
    );
    const directMatch =
      createMatch ?? normalizedText.match(/\b(?:create|add)\s+(?:new\s+)?task\b\s*:?\s*(.+)$/i);

    if (!directMatch?.[1]) {
      return null;
    }

    const body = directMatch[1].trim();
    const nameField = this.extractField(body, 'name');
    const titleField = this.extractField(body, 'title');
    const priorityField = this.extractField(body, 'priority');
    const deadlineField = this.extractField(body, 'deadline');

    const titleCandidate =
      nameField ??
      titleField ??
      body
        .split(/\b(?:priority|deadline|description)\b\s*:/i)[0]
        .replace(/^(task\s*:?\s*)/i, '')
        .trim();
    const title = titleCandidate.replace(/[.?!]+$/g, '').trim();
    if (!title) {
      return null;
    }

    const payload: Record<string, unknown> = { title };
    if (priorityField) {
      payload.priority = this.normalizePriority(priorityField);
    }
    if (deadlineField) {
      payload.deadline = deadlineField;
    }
    return payload;
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

  private extractBatchTaskTitles(text: string): string[] {
    const match = text.match(/(?:^|\b)(?:just\s+)?(?:create|add)\s+(?:\d+\s+)?tasks?\s*:\s*(.+)$/i);
    if (!match?.[1]) {
      return [];
    }

    const list = match[1]
      .split(/,| and /i)
      .map(item => item.replace(/[.!?]+$/g, '').trim())
      .map(item => item.replace(/^[-*]\s*/, '').trim())
      .filter(item => item.length > 0 && item.length <= 120);

    return Array.from(new Set(list));
  }

  private extractField(body: string, field: string): string | null {
    const pattern = new RegExp(
      `\\b${field}\\s*:\\s*([^\\n]+?)(?=((?:[,;]\\s*|\\s+)\\b(?:name|title|priority|deadline|description)\\b\\s*:)|$)`,
      'i',
    );
    const match = body.match(pattern);
    if (!match?.[1]) {
      return null;
    }
    return match[1]
      .trim()
      .replace(/[.,;]+$/g, '')
      .trim();
  }

  private normalizePriority(raw: string): string {
    const value = raw.trim().toLowerCase();
    if (value === 'high' || value === '1') return 'HIGH';
    if (value === 'medium' || value === '2') return 'MEDIUM';
    if (value === 'low' || value === '3') return 'LOW';
    return raw;
  }
}
