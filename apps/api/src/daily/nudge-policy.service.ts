import { Injectable } from '@nestjs/common';
import { NudgePriority, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { DayResolverService } from '../days/day-resolver.service';

import { Nudge } from './nudge.types';

type NudgePolicyOptions = {
  dayId?: string;
  client?: Prisma.TransactionClient | PrismaService;
};

type NudgePolicyEvaluation = {
  allowed: boolean;
  reason:
    | 'ALLOWED'
    | 'DAY_NOT_FOUND'
    | 'DAILY_LIMIT_REACHED'
    | 'TOO_SOON_AFTER_LAST_NUDGE'
    | 'DUPLICATE_NUDGE'
    | 'RECENT_ACTIVITY_PASSIVE_SUPPRESSION';
};

@Injectable()
export class NudgePolicyService {
  private readonly maxNudgesPerDay = 3;
  private readonly minIntervalMs = 2 * 60 * 60 * 1000;
  private readonly dedupeWindowMs = 6 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dayResolver: DayResolverService,
  ) {}

  async shouldSendNudge(
    userId: string,
    nudge: Nudge,
    options?: NudgePolicyOptions,
  ): Promise<boolean> {
    const evaluation = await this.evaluateNudge(userId, nudge, options);
    return evaluation.allowed;
  }

  async evaluateNudge(
    userId: string,
    nudge: Nudge,
    options?: NudgePolicyOptions,
  ): Promise<NudgePolicyEvaluation> {
    const client = options?.client ?? this.prisma;
    const dayId = options?.dayId ?? (await this.resolveDayId(userId, nudge.createdAt, client));
    if (!dayId) {
      return { allowed: false, reason: 'DAY_NOT_FOUND' };
    }

    const [day, profile] = await Promise.all([
      client.day.findUnique({
        where: { id: dayId },
        select: {
          nudgesSentToday: true,
          lastNudgeAt: true,
          lastActivityAt: true,
        },
      }),
      client.userProfile.findUnique({
        where: { userId },
        select: { helpStyle: true },
      }),
    ]);

    if (!day) {
      return { allowed: false, reason: 'DAY_NOT_FOUND' };
    }

    const profilePolicy = this.resolvePolicy(profile?.helpStyle ?? null);
    const dedupeWindowMs = profilePolicy.dedupeWindowMs;
    const duplicate = await client.nudgeEvent.findFirst({
      where: {
        userId,
        type: nudge.type,
        createdAt: { gte: new Date(nudge.createdAt.getTime() - dedupeWindowMs) },
      },
      select: { id: true },
    });

    if (
      profile?.helpStyle === 'passive' &&
      nudge.priority !== NudgePriority.HIGH &&
      day.lastActivityAt &&
      nudge.createdAt.getTime() - day.lastActivityAt.getTime() < 30 * 60 * 1000
    ) {
      return { allowed: false, reason: 'RECENT_ACTIVITY_PASSIVE_SUPPRESSION' };
    }

    if (day.nudgesSentToday >= profilePolicy.maxNudgesPerDay) {
      return { allowed: false, reason: 'DAILY_LIMIT_REACHED' };
    }

    if (
      nudge.priority !== NudgePriority.HIGH &&
      day.lastNudgeAt &&
      nudge.createdAt.getTime() - day.lastNudgeAt.getTime() < profilePolicy.minIntervalMs
    ) {
      return { allowed: false, reason: 'TOO_SOON_AFTER_LAST_NUDGE' };
    }

    if (duplicate) {
      return { allowed: false, reason: 'DUPLICATE_NUDGE' };
    }

    return { allowed: true, reason: 'ALLOWED' };
  }

  async recordNudge(userId: string, nudge: Nudge, options?: NudgePolicyOptions): Promise<boolean> {
    if (!options?.client) {
      return this.prisma.$transaction(tx =>
        this.recordNudge(userId, nudge, {
          ...options,
          client: tx,
        }),
      );
    }

    const client = options.client;
    const dayId = options.dayId ?? (await this.resolveDayId(userId, nudge.createdAt, client));
    if (!dayId) {
      return false;
    }

    const evaluation = await this.evaluateNudge(userId, nudge, { dayId, client });
    if (!evaluation.allowed) {
      return false;
    }

    await client.day.update({
      where: { id: dayId },
      data: {
        nudgesSentToday: { increment: 1 },
        lastNudgeAt: nudge.createdAt,
      },
    });

    await client.nudgeEvent.create({
      data: {
        userId,
        dayId,
        type: nudge.type,
        priority: nudge.priority,
        createdAt: nudge.createdAt,
      },
    });

    return true;
  }

  private async resolveDayId(
    userId: string,
    now: Date,
    client: Prisma.TransactionClient | PrismaService,
  ): Promise<string | null> {
    const day = await this.dayResolver.getDayForMomentTx(userId, now, client);
    return day.id;
  }

  private resolvePolicy(helpStyle: string | null): {
    maxNudgesPerDay: number;
    minIntervalMs: number;
    dedupeWindowMs: number;
  } {
    if (helpStyle === 'proactive') {
      return {
        maxNudgesPerDay: this.maxNudgesPerDay + 1,
        minIntervalMs: Math.floor(this.minIntervalMs * 0.75),
        dedupeWindowMs: Math.floor(this.dedupeWindowMs * 0.75),
      };
    }
    if (helpStyle === 'passive') {
      return {
        maxNudgesPerDay: Math.max(1, this.maxNudgesPerDay - 1),
        minIntervalMs: Math.floor(this.minIntervalMs * 1.5),
        dedupeWindowMs: Math.floor(this.dedupeWindowMs * 1.5),
      };
    }

    return {
      maxNudgesPerDay: this.maxNudgesPerDay,
      minIntervalMs: this.minIntervalMs,
      dedupeWindowMs: this.dedupeWindowMs,
    };
  }
}
