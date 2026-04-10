import { Injectable } from '@nestjs/common';
import { NudgePriority, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { DayResolverService } from '../days/day-resolver.service';

import { Nudge } from './nudge.types';

type NudgePolicyOptions = {
  dayId?: string;
  client?: Prisma.TransactionClient | PrismaService;
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
    const client = options?.client ?? this.prisma;
    const dayId = options?.dayId ?? (await this.resolveDayId(userId, nudge.createdAt, client));
    if (!dayId) {
      return false;
    }

    const [day, duplicate] = await Promise.all([
      client.day.findUnique({
        where: { id: dayId },
        select: {
          nudgesSentToday: true,
          lastNudgeAt: true,
        },
      }),
      client.nudgeEvent.findFirst({
        where: {
          userId,
          type: nudge.type,
          createdAt: { gte: new Date(nudge.createdAt.getTime() - this.dedupeWindowMs) },
        },
        select: { id: true },
      }),
    ]);

    if (!day) {
      return false;
    }

    if (day.nudgesSentToday >= this.maxNudgesPerDay) {
      return false;
    }

    if (
      nudge.priority !== NudgePriority.HIGH &&
      day.lastNudgeAt &&
      nudge.createdAt.getTime() - day.lastNudgeAt.getTime() < this.minIntervalMs
    ) {
      return false;
    }

    if (duplicate) {
      return false;
    }

    return true;
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

    const allowed = await this.shouldSendNudge(userId, nudge, { dayId, client });
    if (!allowed) {
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
}
