import { BadRequestException, Injectable } from '@nestjs/common';
import { TaskStatus, TaskPriority } from '@prisma/client';
import type { ActionCandidate } from '@ai/shared-types';

import { TasksService } from '../tasks/tasks.service';
import { DaysService } from '../days/days.service';

@Injectable()
export class ActionExecutorService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly daysService: DaysService,
  ) {}

  async execute(userId: string, action: ActionCandidate): Promise<void> {
    switch (action.type) {
      case 'TASK_CREATE':
        await this.tasksService.create(userId, {
          name: this.getRequiredString(action.payload, ['title', 'name']),
          priority: this.getOptionalTaskPriority(action.payload, ['priority']),
          deadline: this.getOptionalString(action.payload, ['dueDate', 'deadline']),
          dayId: this.getOptionalString(action.payload, ['dayId']),
          conversationId: this.getOptionalString(action.payload, ['conversationId']),
          source: 'CHAT',
        });
        break;

      case 'TASK_UPDATE_STATUS':
        await this.tasksService.updateStatus(
          userId,
          this.getRequiredString(action.payload, ['taskId']),
          this.getTaskStatus(action.payload),
        );
        break;

      case 'TASK_COMPLETE':
        await this.tasksService.updateStatus(
          userId,
          this.getRequiredString(action.payload, ['taskId']),
          TaskStatus.DONE,
        );
        break;

      case 'TASK_SET_PRIORITY':
        await this.tasksService.update(userId, this.getRequiredString(action.payload, ['taskId']), {
          priority: this.getRequiredTaskPriority(action.payload, ['priority']),
        });
        break;

      case 'TASK_SET_DUE_DATE':
        await this.tasksService.update(userId, this.getRequiredString(action.payload, ['taskId']), {
          deadline: this.getRequiredString(action.payload, ['dueDate', 'deadline']),
        });
        break;

      case 'DAY_START':
        await this.daysService.startDay(userId, this.getOptionalString(action.payload, ['date']));
        break;

      case 'DAY_END':
        await this.daysService.endDay(userId, this.getOptionalString(action.payload, ['date']));
        break;

      default:
        throw new BadRequestException(`Unsupported action type: ${action.type}`);
    }
  }

  private getRequiredString(payload: Record<string, unknown>, keys: string[]): string {
    console.log(payload, keys);
    // TODO: status field in payload ???
    for (const key of keys) {
      const value = payload[key];
      // if (typeof value === 'string' && value.trim().length > 0) {
      if (typeof value === 'string') {
        return value;
      }
    }
    throw new BadRequestException(`Missing required field: ${keys.join(' | ')}`);
  }

  private getOptionalString(payload: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return undefined;
  }

  private getTaskStatus(payload: Record<string, unknown>): TaskStatus {
    const status = this.getRequiredString(payload, ['status']).toUpperCase();
    if (status === TaskStatus.TODO) return TaskStatus.TODO;
    if (status === TaskStatus.IN_PROGRESS) return TaskStatus.IN_PROGRESS;
    if (status === TaskStatus.DONE) return TaskStatus.DONE;
    throw new BadRequestException(`Invalid task status: ${status}`);
  }

  private getOptionalTaskPriority(
    payload: Record<string, unknown>,
    keys: string[],
  ): TaskPriority | undefined {
    const value = this.getOptionalString(payload, keys);
    if (!value) return undefined;
    return this.parseTaskPriority(value);
  }

  private getRequiredTaskPriority(payload: Record<string, unknown>, keys: string[]): TaskPriority {
    const value = this.getRequiredString(payload, keys);
    return this.parseTaskPriority(value);
  }

  private parseTaskPriority(value: string): TaskPriority {
    const upper = value.toUpperCase();
    if (upper === TaskPriority.LOW) return TaskPriority.LOW;
    if (upper === TaskPriority.MEDIUM) return TaskPriority.MEDIUM;
    if (upper === TaskPriority.HIGH) return TaskPriority.HIGH;
    throw new BadRequestException(`Invalid task priority: ${value}`);
  }
}
