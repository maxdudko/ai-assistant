import { BadRequestException, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { TaskStatus, TaskPriority } from '@prisma/client';
import type { ActionCandidate } from '@ai/shared-types';

import { TasksService } from '../tasks/tasks.service';
import { DaysService } from '../days/days.service';
import { DigestService } from '../digest/digest.service';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryIngestionService } from '../memory/memory-ingestion.service';
import { MemoryLayer, MemoryType } from '../memory/dto/memory-candidate.dto';

@Injectable()
export class ActionExecutorService {
  private readonly logger = new Logger(ActionExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    @Inject(forwardRef(() => DaysService))
    private readonly daysService: DaysService,
    private readonly digestService: DigestService,
    private readonly memoryIngestion: MemoryIngestionService,
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
          this.getRequiredString(action.payload, ['task_id', 'taskId']),
          this.getTaskStatus(action.payload, TaskStatus.DONE),
        );
        break;

      case 'TASK_COMPLETE':
        await this.tasksService.updateStatus(
          userId,
          this.getRequiredString(action.payload, ['task_id', 'taskId']),
          TaskStatus.DONE,
        );
        break;

      case 'TASK_SET_PRIORITY':
        await this.tasksService.update(
          userId,
          this.getRequiredString(action.payload, ['task_id', 'taskId']),
          {
            priority: this.getRequiredTaskPriority(action.payload, ['priority']),
          },
        );
        break;

      case 'TASK_SET_DUE_DATE':
        await this.tasksService.update(
          userId,
          this.getRequiredString(action.payload, ['task_id', 'taskId']),
          {
            deadline: this.getRequiredString(action.payload, ['dueDate', 'deadline']),
          },
        );
        break;

      case 'DAY_START':
        await this.daysService.startDay(userId, this.getOptionalString(action.payload, ['date']));
        break;

      case 'DAY_END':
        await this.daysService.endDay(userId, this.getOptionalString(action.payload, ['date']));
        break;

      case 'SUGGEST_DIGEST_SUBSCRIPTION':
        await this.digestService.subscribeFromSuggestion(userId, action.payload);
        break;

      case 'SIMPLIFY_DAY':
        await this.simplifyDay(userId, action.payload);
        break;

      case 'SPLIT_TASK':
        await this.splitTask(userId, action.payload);
        break;

      case 'RESCHEDULE_TASK':
        await this.rescheduleTask(userId, action.payload);
        break;

      default:
        throw new BadRequestException(`Unsupported action type: ${action.type}`);
    }

    try {
      await this.recordActionFeedbackMemory(userId, action);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Feedback memory failed for action ${action.id}: ${reason}`);
    }
  }

  private getRequiredString(payload: Record<string, unknown>, keys: string[]): string {
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

  private getTaskStatus(payload: Record<string, unknown>, fallbackStatus?: TaskStatus): TaskStatus {
    const rawStatus = this.getOptionalString(payload, ['status', 'state']);
    if (!rawStatus) {
      if (fallbackStatus) {
        return fallbackStatus;
      }
      throw new BadRequestException('Missing required field: status');
    }

    const status = rawStatus.toUpperCase();
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

  private async simplifyDay(userId: string, payload: Record<string, unknown>): Promise<void> {
    const dayId = this.getOptionalString(payload, ['dayId']);
    if (!dayId) {
      throw new BadRequestException('Missing required field: dayId');
    }

    const keepCount = this.getOptionalNumber(payload, ['keepCount']) ?? 2;
    const keepLimit = Math.min(5, Math.max(1, Math.floor(keepCount)));

    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        dayId,
      },
      select: {
        id: true,
        priority: true,
        deadline: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (tasks.length <= keepLimit) {
      return;
    }

    const sorted = [...tasks].sort((a, b) => {
      const p = this.priorityRank(b.priority) - this.priorityRank(a.priority);
      if (p !== 0) return p;
      const aDeadline = a.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
      const bDeadline = b.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
      if (aDeadline !== bDeadline) return aDeadline - bDeadline;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const keep = new Set(sorted.slice(0, keepLimit).map(task => task.id));
    const toMove = tasks.filter(task => !keep.has(task.id)).map(task => task.id);
    if (toMove.length === 0) return;

    await this.prisma.task.updateMany({
      where: {
        userId,
        id: { in: toMove },
      },
      data: {
        dayId: null,
      },
    });
  }

  private async splitTask(userId: string, payload: Record<string, unknown>): Promise<void> {
    const taskId = this.getRequiredString(payload, ['taskId', 'task_id']);
    const parent = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        userId,
      },
      select: {
        id: true,
        dayId: true,
        priority: true,
        name: true,
      },
    });
    if (!parent) {
      throw new BadRequestException('Task not found');
    }

    const providedSubtasks = this.getOptionalStringArray(payload, ['subtasks', 'steps']);
    let subtasks = providedSubtasks;
    if (!subtasks || subtasks.length === 0) {
      const parts = this.getOptionalNumber(payload, ['parts']) ?? 3;
      const count = Math.min(4, Math.max(2, Math.floor(parts)));
      subtasks = Array.from({ length: count }, (_, index) => `${parent.name} - Part ${index + 1}`);
    }

    if (subtasks.length < 2 || subtasks.length > 4) {
      throw new BadRequestException('SPLIT_TASK requires 2-4 subtasks');
    }

    await this.prisma.task.createMany({
      data: subtasks.map(name => ({
        userId,
        dayId: parent.dayId,
        parentId: parent.id,
        name,
        status: TaskStatus.TODO,
        priority: parent.priority,
        source: 'CHAT',
      })),
    });
  }

  private async rescheduleTask(userId: string, payload: Record<string, unknown>): Promise<void> {
    const taskId = this.getRequiredString(payload, ['taskId', 'task_id']);
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        userId,
      },
      select: {
        id: true,
        deadline: true,
      },
    });
    if (!task) {
      throw new BadRequestException('Task not found');
    }

    const base = task.deadline ?? new Date();
    const nextDay = new Date(base);
    nextDay.setDate(nextDay.getDate() + 1);

    await this.tasksService.update(userId, task.id, {
      deadline: nextDay.toISOString(),
    });
  }

  private getOptionalNumber(payload: Record<string, unknown>, keys: string[]): number | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return undefined;
  }

  private getOptionalStringArray(
    payload: Record<string, unknown>,
    keys: string[],
  ): string[] | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (Array.isArray(value)) {
        const normalized = value
          .map(item => (typeof item === 'string' ? item.trim() : ''))
          .filter(item => item.length > 0);
        if (normalized.length > 0) {
          return normalized;
        }
      }
    }
    return undefined;
  }

  private priorityRank(priority: TaskPriority): number {
    if (priority === TaskPriority.HIGH) return 3;
    if (priority === TaskPriority.MEDIUM) return 2;
    return 1;
  }

  private async recordActionFeedbackMemory(userId: string, action: ActionCandidate): Promise<void> {
    const content = this.buildActionFeedbackContent(action.type);
    const payload = action.payload as Record<string, unknown>;

    await this.memoryIngestion.ingest(
      userId,
      [
        {
          content,
          type: MemoryType.FACTUAL,
          layer: MemoryLayer.PATTERN,
          importance: 6,
          confidence: 0.9,
          tags: ['action-feedback', action.type.toLowerCase()],
        },
      ],
      'CONVERSATION',
      {
        dayId: this.getOptionalString(payload, ['dayId']),
        conversationId: this.getOptionalString(payload, ['conversationId']),
      },
    );
  }

  private buildActionFeedbackContent(actionType: ActionCandidate['type']): string {
    if (actionType === 'SIMPLIFY_DAY') {
      return 'User accepted simplification of their day';
    }
    if (actionType === 'SPLIT_TASK') {
      return 'User accepted splitting a task into smaller steps';
    }
    if (actionType === 'RESCHEDULE_TASK') {
      return 'User accepted rescheduling a task';
    }
    return `User confirmed and executed action: ${actionType}`;
  }
}
