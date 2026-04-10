import { randomUUID } from 'crypto';

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ActionCandidate } from '@ai/shared-types';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { ListPagination } from '../common/parse-list-pagination';

import { ActionExecutorService } from './action-executor.service';
import { ListPendingActionsDto } from './dto/list-pending-actions.dto';

interface ActionContext {
  conversationId?: string;
  dayId?: string | null;
  tasks?: Array<{ id: string; name: string }>;
}

type ActionPersistenceOptions = {
  client?: Prisma.TransactionClient | PrismaService;
};

@Injectable()
export class ActionsService {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: ActionExecutorService,
  ) {}

  async createCandidate(
    userId: string,
    candidate: ActionCandidate,
    context: ActionContext,
    options?: ActionPersistenceOptions,
  ): Promise<ActionCandidate> {
    const client = options?.client ?? this.prisma;
    const [normalized] = this.prepareCandidates([candidate], context);
    if (!normalized) {
      throw new BadRequestException('Action candidate could not be created');
    }
    this.validateCandidate(normalized);

    const record = await client.actionCandidate.create({
      data: {
        id: normalized.id,
        userId,
        conversationId: context.conversationId,
        type: normalized.type,
        payload: normalized.payload as any,
        confidence: normalized.confidence,
        requiresConfirmation: normalized.requiresConfirmation,
        status: 'PENDING',
      },
    });

    this.logger.log(`Created 1 action candidate for userId=${userId}`);
    return {
      id: record.id,
      type: record.type as ActionCandidate['type'],
      payload: (record.payload as Record<string, unknown>) ?? {},
      confidence: record.confidence,
      requiresConfirmation: record.requiresConfirmation,
    };
  }

  async createCandidates(
    userId: string,
    candidates: ActionCandidate[],
    context: ActionContext,
    options?: ActionPersistenceOptions,
  ): Promise<ActionCandidate[]> {
    if (candidates.length === 0) return [];
    const created = await Promise.all(
      candidates.map(candidate => this.createCandidate(userId, candidate, context, options)),
    );
    return created;
  }

  prepareCandidates(candidates: ActionCandidate[], context: ActionContext): ActionCandidate[] {
    if (candidates.length === 0) return [];
    return candidates.map(candidate => this.normalizeCandidate(candidate, context));
  }

  async confirmAction(userId: string, actionId: string) {
    const action = await this.prisma.actionCandidate.findFirst({
      where: { id: actionId, userId },
    });

    if (!action) {
      throw new NotFoundException('Action not found');
    }

    if (action.status === 'EXECUTED') {
      return { actionId, status: action.status };
    }

    await this.prisma.actionCandidate.update({
      where: { id: action.id },
      data: { status: 'CONFIRMED' },
    });

    try {
      await this.executor.execute(userId, this.toCandidate(action));

      await this.prisma.actionCandidate.update({
        where: { id: action.id },
        data: { status: 'EXECUTED' },
      });

      await this.prisma.actionExecutionLog.create({
        data: {
          actionId: action.id,
          userId,
          type: action.type,
          payload: action.payload as any,
          status: 'SUCCESS',
        },
      });

      return { actionId: action.id, status: 'EXECUTED' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.actionCandidate.update({
        where: { id: action.id },
        data: { status: 'FAILED' },
      });

      await this.prisma.actionExecutionLog.create({
        data: {
          actionId: action.id,
          userId,
          type: action.type,
          payload: action.payload as any,
          status: 'FAILED',
          error: message,
        },
      });

      throw new BadRequestException(message);
    }
  }

  async getPendingActions(
    userId: string,
    query: Pick<ListPendingActionsDto, 'conversationId' | 'dayId'>,
    pagination: ListPagination,
  ) {
    const where = {
      userId,
      status: 'PENDING' as const,
      requiresConfirmation: true,
      conversationId: query.conversationId,
      conversation: query.dayId
        ? {
            dayId: query.dayId,
          }
        : undefined,
    };

    const take = pagination.limit + 1;
    const rows = await this.prisma.actionCandidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip: pagination.offset,
      select: {
        id: true,
        type: true,
        payload: true,
        confidence: true,
        requiresConfirmation: true,
        status: true,
        createdAt: true,
        conversationId: true,
      },
    });

    const hasMore = rows.length > pagination.limit;
    const items = hasMore ? rows.slice(0, pagination.limit) : rows;

    return {
      items: items.map(item => ({
        id: item.id,
        type: item.type as ActionCandidate['type'],
        payload: (item.payload as Record<string, unknown>) ?? {},
        confidence: item.confidence,
        requiresConfirmation: item.requiresConfirmation,
        status: item.status,
        createdAt: item.createdAt,
        conversationId: item.conversationId,
      })),
      hasMore,
      nextOffset: hasMore ? pagination.offset + pagination.limit : null,
    };
  }

  private normalizeCandidate(candidate: ActionCandidate, context: ActionContext): ActionCandidate {
    const payload = { ...candidate.payload } as Record<string, unknown>;

    // Validate UUID format - if provided ID is not a valid UUID, generate a new one
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      candidate.id,
    );
    const id = isValidUUID ? candidate.id : randomUUID();

    const normalized: ActionCandidate = {
      id,
      type: candidate.type,
      payload,
      confidence: candidate.confidence ?? 0.5,
      requiresConfirmation: true,
    };

    if (!payload.conversationId && context.conversationId) {
      payload.conversationId = context.conversationId;
    }

    if (candidate.type === 'TASK_CREATE' && !payload.dayId && context.dayId) {
      payload.dayId = context.dayId;
    }

    if (
      [
        'TASK_UPDATE_STATUS',
        'TASK_SET_PRIORITY',
        'TASK_SET_DUE_DATE',
        'TASK_COMPLETE',
        'SPLIT_TASK',
        'RESCHEDULE_TASK',
      ].includes(candidate.type) &&
      !payload.taskId
    ) {
      const taskName = this.getTaskNameFromPayload(payload);
      if (taskName && context.tasks) {
        const matched = this.matchTaskByName(context.tasks, taskName);
        if (matched) {
          payload.taskId = matched.id;
        }
      }
    }

    return normalized;
  }

  private toCandidate(record: {
    id: string;
    type: string;
    payload: unknown;
    confidence: number;
    requiresConfirmation: boolean;
  }): ActionCandidate {
    return {
      id: record.id,
      type: record.type as ActionCandidate['type'],
      payload: (record.payload as Record<string, unknown>) ?? {},
      confidence: record.confidence,
      requiresConfirmation: record.requiresConfirmation,
    };
  }

  private getTaskNameFromPayload(payload: Record<string, unknown>): string | undefined {
    const keys = ['title', 'name', 'task', 'taskName'];
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return undefined;
  }

  private matchTaskByName(tasks: Array<{ id: string; name: string }>, name: string) {
    const target = this.normalize(name);
    return tasks.find(task => {
      const normalized = this.normalize(task.name);
      return normalized === target || normalized.includes(target) || target.includes(normalized);
    });
  }

  private validateCandidate(candidate: ActionCandidate): void {
    if (!candidate.type) {
      throw new BadRequestException('Action type is required');
    }
    if (
      !candidate.payload ||
      typeof candidate.payload !== 'object' ||
      Array.isArray(candidate.payload)
    ) {
      throw new BadRequestException('Action payload must be an object');
    }
    if (
      !Number.isFinite(candidate.confidence) ||
      candidate.confidence < 0 ||
      candidate.confidence > 1
    ) {
      throw new BadRequestException('Action confidence must be between 0 and 1');
    }

    const payload = candidate.payload as Record<string, unknown>;
    if (candidate.type === 'SIMPLIFY_DAY' && !this.getPayloadString(payload, ['dayId'])) {
      throw new BadRequestException('SIMPLIFY_DAY requires dayId');
    }
    if (
      (candidate.type === 'SPLIT_TASK' || candidate.type === 'RESCHEDULE_TASK') &&
      !this.getPayloadString(payload, ['taskId', 'task_id'])
    ) {
      throw new BadRequestException(`${candidate.type} requires taskId`);
    }
  }

  private getPayloadString(payload: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return null;
  }

  private normalize(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
  }
}
