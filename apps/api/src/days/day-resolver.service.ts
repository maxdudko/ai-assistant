import { Injectable } from '@nestjs/common';
import { Day, DayPhase, DayState, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { getUserLocalDateInfo } from '../daily/daily-timezone.util';

@Injectable()
export class DayResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentDay(userId: string): Promise<Day> {
    return this.getDayForMoment(userId, new Date());
  }

  async getDayForMoment(userId: string, now: Date): Promise<Day> {
    return this.getDayForMomentTx(userId, now, this.prisma);
  }

  async getDayForMomentTx(
    userId: string,
    now: Date,
    client: Prisma.TransactionClient | PrismaService,
  ): Promise<Day> {
    const timezone = await this.getUserTimezone(userId, client);
    const local = getUserLocalDateInfo(now, timezone);

    return client.day.upsert({
      where: {
        userId_date: {
          userId,
          date: local.dayStartUtc,
        },
      },
      update: {},
      create: {
        userId,
        date: local.dayStartUtc,
        state: DayState.START,
        phase: DayPhase.NOT_STARTED,
      },
    });
  }

  private async getUserTimezone(
    userId: string,
    client: Prisma.TransactionClient | PrismaService,
  ): Promise<string | null> {
    const profile = await client.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return profile?.timezone ?? null;
  }
}
