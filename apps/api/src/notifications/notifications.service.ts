import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { ListPagination } from '../common/parse-list-pagination';

import type { DispatchNotificationInput } from './notification.types';
import { PushService } from './push.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async getPreferences(userId: string) {
    return this.ensurePreferences(userId);
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    await this.ensurePreferences(userId);
    return this.prisma.notificationPreference.update({
      where: { userId },
      data: dto,
    });
  }

  async subscribePush(
    userId: string,
    input: { endpoint: string; p256dh: string; auth: string; userAgent?: string },
  ) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
      },
      update: {
        userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
        lastUsedAt: new Date(),
      },
    });
  }

  async unsubscribePush(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { removed: true };
  }

  async list(userId: string, pagination: ListPagination) {
    const { limit, offset } = pagination;
    const take = limit + 1;

    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      skip: offset,
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true, readAt: true },
    });
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    if (!existing.readAt) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
    }

    return { read: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: true };
  }

  async dispatch(input: DispatchNotificationInput): Promise<void> {
    try {
      const preferences = await this.ensurePreferences(input.userId);
      if (!this.isTypeEnabled(preferences, input.type)) {
        return;
      }

      const notification = await this.createNotificationRecord(input);
      if (!notification || !preferences.pushEnabled) {
        return;
      }

      const pushResult = await this.push.sendToUser(input.userId, {
        title: input.title,
        body: this.truncate(input.body, 180),
        deepLink: input.deepLink,
        notificationId: notification.id,
      });

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          pushedAt: pushResult.sent > 0 ? new Date() : null,
          pushError: pushResult.failed > 0 && pushResult.sent === 0 ? 'PUSH_DELIVERY_FAILED' : null,
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Notification dispatch skipped: ${reason}`);
    }
  }

  dispatchInBackground(input: DispatchNotificationInput): void {
    void this.dispatch(input);
  }

  buildDailyNotification(
    type: NotificationType,
    content: string,
    context: {
      userId: string;
      dayId: string;
      conversationId: string;
      messageId?: string;
      nudgeType?: string;
    },
  ): DispatchNotificationInput {
    const firstLine = content.split('\n').find(line => line.trim().length > 0) ?? 'Mira update';
    const title = this.titleForType(type, firstLine);
    const dedupeKey = this.dedupeKeyForType(type, context.dayId, context.nudgeType);

    return {
      userId: context.userId,
      type,
      title,
      body: this.truncate(content, 500),
      deepLink: '/me/chat',
      conversationId: context.conversationId,
      messageId: context.messageId,
      dayId: context.dayId,
      dedupeKey,
    };
  }

  private async ensurePreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  private async createNotificationRecord(input: DispatchNotificationInput) {
    try {
      return await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          deepLink: input.deepLink,
          conversationId: input.conversationId,
          messageId: input.messageId,
          dayId: input.dayId,
          dedupeKey: input.dedupeKey,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        input.dedupeKey
      ) {
        return null;
      }
      throw error;
    }
  }

  private isTypeEnabled(
    preferences: {
      morningBriefingEnabled: boolean;
      eveningReflectionEnabled: boolean;
      nudgesEnabled: boolean;
      weeklyInsightEnabled: boolean;
    },
    type: NotificationType,
  ): boolean {
    if (type === NotificationType.MORNING_BRIEFING) {
      return preferences.morningBriefingEnabled;
    }
    if (type === NotificationType.EVENING_REFLECTION) {
      return preferences.eveningReflectionEnabled;
    }
    if (type === NotificationType.NUDGE) {
      return preferences.nudgesEnabled;
    }
    if (type === NotificationType.WEEKLY_INSIGHT) {
      return preferences.weeklyInsightEnabled;
    }
    return true;
  }

  private titleForType(type: NotificationType, firstLine: string): string {
    if (type === NotificationType.MORNING_BRIEFING) {
      return firstLine.startsWith('Good morning') ? firstLine : 'Good morning';
    }
    if (type === NotificationType.EVENING_REFLECTION) {
      return firstLine.startsWith('Good evening') ? firstLine : 'Evening reflection';
    }
    if (type === NotificationType.NUDGE) {
      return 'Check-in from Mira';
    }
    if (type === NotificationType.WEEKLY_INSIGHT) {
      return 'Weekly insight is ready';
    }
    return 'Mira update';
  }

  private dedupeKeyForType(type: NotificationType, dayId: string, nudgeType?: string): string {
    if (type === NotificationType.NUDGE && nudgeType) {
      return `${dayId}:nudge:${nudgeType}`;
    }
    return `${dayId}:${type.toLowerCase()}`;
  }

  private truncate(value: string, maxLength: number): string {
    const normalized = value.trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, maxLength - 1)}…`;
  }
}
