import { Injectable } from '@nestjs/common';
import {
  ConversationMode,
  ConversationState,
  ConversationType,
  MessageRole,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { getUserLocalDateInfo } from './daily-timezone.util';

type GetOrCreateDailyConversationOptions = {
  now?: Date;
};

@Injectable()
export class DailyConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(
    userId: string,
    options?: GetOrCreateDailyConversationOptions,
  ): Promise<{ conversationId: string; dayId: string; date: Date; timezone: string }> {
    const now = options?.now ?? new Date();
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const local = getUserLocalDateInfo(now, profile?.timezone);

    const day = await this.getOrCreateDay(userId, local.dayStartUtc);
    const conversation = await this.getOrCreateDailyConversation(userId, day.id, local.dayStartUtc);
    await this.ensureSystemMessage(conversation.id);

    return {
      conversationId: conversation.id,
      dayId: day.id,
      date: local.dayStartUtc,
      timezone: local.timeZone,
    };
  }

  private async getOrCreateDay(userId: string, date: Date): Promise<{ id: string }> {
    let day = await this.prisma.day.findUnique({
      where: { userId_date: { userId, date } },
      select: { id: true },
    });

    if (!day) {
      try {
        day = await this.prisma.day.create({
          data: { userId, date, state: 'START', phase: 'NOT_STARTED' },
          select: { id: true },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          day = await this.prisma.day.findUnique({
            where: { userId_date: { userId, date } },
            select: { id: true },
          });
        }
        if (!day) {
          throw error;
        }
      }
    }

    return day;
  }

  private async getOrCreateDailyConversation(
    userId: string,
    dayId: string,
    date: Date,
  ): Promise<{ id: string; state: ConversationState }> {
    let conversation = await this.prisma.conversation.findUnique({
      where: {
        userId_type_date: {
          userId,
          type: ConversationType.DAILY,
          date,
        },
      },
      select: { id: true, state: true },
    });

    if (conversation?.state === ConversationState.ARCHIVED) {
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { state: ConversationState.CREATED },
        select: { id: true, state: true },
      });
    }

    if (!conversation) {
      try {
        conversation = await this.prisma.conversation.create({
          data: {
            userId,
            dayId,
            type: ConversationType.DAILY,
            mode: ConversationMode.MANAGER,
            state: ConversationState.CREATED,
            date,
          },
          select: { id: true, state: true },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const existing = await this.prisma.conversation.findUnique({
            where: {
              userId_type_date: {
                userId,
                type: ConversationType.DAILY,
                date,
              },
            },
            select: { id: true, state: true },
          });

          if (existing?.state === ConversationState.ARCHIVED) {
            conversation = await this.prisma.conversation.update({
              where: { id: existing.id },
              data: { state: ConversationState.CREATED },
              select: { id: true, state: true },
            });
          } else {
            conversation = existing;
          }
        }
        if (!conversation) {
          throw error;
        }
      }
    }

    return conversation;
  }

  private async ensureSystemMessage(conversationId: string): Promise<void> {
    const existing = await this.prisma.message.findFirst({
      where: {
        conversationId,
        role: MessageRole.SYSTEM,
      },
      select: { id: true },
    });

    if (existing) {
      return;
    }

    await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.SYSTEM,
        content:
          'Daily conversation started. Ready to help with planning, execution, and reflection.',
        mode: ConversationMode.MANAGER,
      },
    });
  }
}
