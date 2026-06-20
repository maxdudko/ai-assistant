import { BadRequestException, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { TaskStatus, TaskPriority } from '@prisma/client';
import type { ActionCandidate } from '@ai/shared-types';

import { TasksService } from '../tasks/tasks.service';
import { DaysService } from '../days/days.service';
import { DigestService } from '../digest/digest.service';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryIngestionService } from '../memory/memory-ingestion.service';
import { MemoryLayer, MemoryType } from '../memory/dto/memory-candidate.dto';

export type ActionExecutionOutcome = {
  reversible: boolean;
  undoPayload: Record<string, unknown> | null;
};

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

  async execute(userId: string, action: ActionCandidate): Promise<ActionExecutionOutcome> {
    let outcome: ActionExecutionOutcome = { reversible: false, undoPayload: null };

    switch (action.type) {
      case 'TASK_CREATE':
        await this.tasksService.create(userId, {
          name: this.getRequiredString(action.payload, ['title', 'name']),
          priority: this.getOptionalTaskPriority(action.payload, ['priority']),
          deadline: this.getOptionalDeadlineIso(action.payload, [
            'dueDate',
            'deadline',
            'due_date',
          ]),
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

      case 'TASK_LINK_GOAL': {
        const taskId = this.getRequiredString(action.payload, ['task_id', 'taskId']);
        const goalId = this.getOptionalString(action.payload, ['goal_id', 'goalId']);
        const previous = await this.prisma.task.findFirst({
          where: { id: taskId, userId },
          select: { id: true, goalId: true },
        });
        if (!previous) {
          throw new BadRequestException('Task not found');
        }
        if (goalId) {
          const goal = await this.prisma.goal.findFirst({
            where: { id: goalId, userId },
            select: { id: true },
          });
          if (!goal) {
            throw new BadRequestException('Goal not found for current user');
          }
        }
        await this.tasksService.update(userId, taskId, { goalId: goalId ?? null });
        outcome = {
          reversible: true,
          undoPayload: {
            type: 'TASK_LINK_GOAL',
            taskId: previous.id,
            previousGoalId: previous.goalId ?? null,
          },
        };
        break;
      }

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
        outcome = {
          reversible: true,
          undoPayload: await this.simplifyDay(userId, action.payload),
        };
        break;

      case 'SPLIT_TASK':
        outcome = {
          reversible: true,
          undoPayload: await this.splitTask(userId, action.payload),
        };
        break;

      case 'RESCHEDULE_TASK':
        outcome = {
          reversible: true,
          undoPayload: await this.rescheduleTask(userId, action.payload),
        };
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

    return outcome;
  }

  async undo(
    userId: string,
    actionType: ActionCandidate['type'],
    undoPayload: Record<string, unknown>,
  ): Promise<void> {
    if (actionType === 'SIMPLIFY_DAY') {
      await this.undoSimplifyDay(userId, undoPayload);
      return;
    }
    if (actionType === 'SPLIT_TASK') {
      await this.undoSplitTask(userId, undoPayload);
      return;
    }
    if (actionType === 'RESCHEDULE_TASK') {
      await this.undoRescheduleTask(userId, undoPayload);
      return;
    }

    if (actionType === 'TASK_LINK_GOAL') {
      await this.undoLinkGoal(userId, undoPayload);
      return;
    }

    throw new BadRequestException(`Action type ${actionType} does not support undo`);
  }

  private async undoLinkGoal(userId: string, payload: Record<string, unknown>): Promise<void> {
    const taskId = this.getRequiredString(payload, ['taskId']);
    const previousGoalId = this.getOptionalString(payload, ['previousGoalId']);
    await this.tasksService.update(userId, taskId, { goalId: previousGoalId ?? null });
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

  private getOptionalDeadlineIso(
    payload: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    const raw = this.getOptionalString(payload, keys);
    if (!raw) {
      return undefined;
    }

    const normalized = raw.trim().toLowerCase();
    if (normalized === 'today') {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return today.toISOString();
    }
    if (normalized === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      return tomorrow.toISOString();
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    throw new BadRequestException(`Invalid deadline value: ${raw}`);
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
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return this.parseTaskPriority(value);
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        return this.parseTaskPriority(value);
      }
    }
    return undefined;
  }

  private getRequiredTaskPriority(payload: Record<string, unknown>, keys: string[]): TaskPriority {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return this.parseTaskPriority(value);
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        return this.parseTaskPriority(value);
      }
    }
    throw new BadRequestException(`Missing required field: ${keys.join(' | ')}`);
  }

  private parseTaskPriority(value: string | number): TaskPriority {
    if (typeof value === 'number') {
      if (value <= 1) return TaskPriority.HIGH;
      if (value === 2) return TaskPriority.MEDIUM;
      return TaskPriority.LOW;
    }

    const normalized = value.trim();
    if (/^\d+$/.test(normalized)) {
      return this.parseTaskPriority(Number(normalized));
    }

    const upper = normalized.toUpperCase();
    if (upper === TaskPriority.LOW) return TaskPriority.LOW;
    if (upper === TaskPriority.MEDIUM) return TaskPriority.MEDIUM;
    if (upper === TaskPriority.HIGH) return TaskPriority.HIGH;
    throw new BadRequestException(`Invalid task priority: ${value}`);
  }

  private async simplifyDay(
    userId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
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
      return {
        type: 'SIMPLIFY_DAY',
        dayId,
        movedTaskIds: [],
      };
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
    if (toMove.length === 0) {
      return {
        type: 'SIMPLIFY_DAY',
        dayId,
        movedTaskIds: [],
      };
    }

    await this.prisma.task.updateMany({
      where: {
        userId,
        id: { in: toMove },
      },
      data: {
        dayId: null,
      },
    });

    return {
      type: 'SIMPLIFY_DAY',
      dayId,
      movedTaskIds: toMove,
    };
  }

  private async splitTask(
    userId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
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

    const created = await Promise.all(
      subtasks.map(name =>
        this.prisma.task.create({
          data: {
            userId,
            dayId: parent.dayId,
            parentId: parent.id,
            name,
            status: TaskStatus.TODO,
            priority: parent.priority,
            source: 'CHAT',
          },
          select: {
            id: true,
          },
        }),
      ),
    );

    return {
      type: 'SPLIT_TASK',
      parentTaskId: parent.id,
      createdTaskIds: created.map(task => task.id),
    };
  }

  private async rescheduleTask(
    userId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
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

    return {
      type: 'RESCHEDULE_TASK',
      taskId: task.id,
      previousDeadline: task.deadline ? task.deadline.toISOString() : null,
    };
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

  private async undoSimplifyDay(userId: string, payload: Record<string, unknown>): Promise<void> {
    const dayId = this.getRequiredString(payload, ['dayId']);
    const movedTaskIds = this.getOptionalStringArray(payload, ['movedTaskIds']) ?? [];
    if (movedTaskIds.length === 0) {
      return;
    }

    await this.prisma.task.updateMany({
      where: {
        userId,
        id: { in: movedTaskIds },
      },
      data: {
        dayId,
      },
    });
  }

  private async undoSplitTask(userId: string, payload: Record<string, unknown>): Promise<void> {
    const createdTaskIds = this.getOptionalStringArray(payload, ['createdTaskIds']) ?? [];
    if (createdTaskIds.length === 0) {
      return;
    }

    await this.prisma.task.deleteMany({
      where: {
        userId,
        id: { in: createdTaskIds },
      },
    });
  }

  private async undoRescheduleTask(
    userId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const taskId = this.getRequiredString(payload, ['taskId']);
    const previousDeadlineRaw = payload.previousDeadline;
    const previousDeadline =
      typeof previousDeadlineRaw === 'string' && previousDeadlineRaw.length > 0
        ? new Date(previousDeadlineRaw)
        : null;

    await this.prisma.task.updateMany({
      where: {
        id: taskId,
        userId,
      },
      data: {
        deadline: previousDeadline,
      },
    });
  }
}
