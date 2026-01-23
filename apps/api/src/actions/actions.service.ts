import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import type { ActionCandidate } from '@ai/shared-types';

import { PrismaService } from '../prisma/prisma.service';

import { ActionExecutorService } from './action-executor.service';

interface ActionContext {
  conversationId?: string;
  dayId?: string | null;
  tasks?: Array<{ id: string; name: string }>;
}

@Injectable()
export class ActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: ActionExecutorService,
  ) {}

  async createCandidates(
    userId: string,
    candidates: ActionCandidate[],
    context: ActionContext,
  ): Promise<ActionCandidate[]> {
    if (candidates.length === 0) return [];

    const normalized = candidates.map(candidate => this.normalizeCandidate(candidate, context));

    const created = await Promise.all(
      normalized.map(candidate =>
        this.prisma.actionCandidate.create({
          data: {
            id: candidate.id,
            userId,
            conversationId: context.conversationId,
            type: candidate.type,
            payload: candidate.payload as any,
            confidence: candidate.confidence,
            requiresConfirmation: candidate.requiresConfirmation,
            status: 'PENDING',
          },
        }),
      ),
    );

    return created.map(record => ({
      id: record.id,
      type: record.type as ActionCandidate['type'],
      payload: (record.payload as Record<string, unknown>) ?? {},
      confidence: record.confidence,
      requiresConfirmation: record.requiresConfirmation,
    }));
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
      ['TASK_UPDATE_STATUS', 'TASK_SET_PRIORITY', 'TASK_SET_DUE_DATE', 'TASK_COMPLETE'].includes(
        candidate.type,
      ) &&
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

  private normalize(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
  }
}
