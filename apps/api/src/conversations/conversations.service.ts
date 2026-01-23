import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationMode, TaskStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ConversationState, ConversationType } from '../prisma/types';
import { ActionsService } from '../actions/actions.service';
import { IntentDetectorService } from '../intents/intent-detector.service';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly actionsService: ActionsService,
    private readonly intentDetector: IntentDetectorService,
  ) {}

  /**
   * Get or create today's day for a user
   */
  private async getOrCreateTodayDay(userId: string): Promise<string> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let day = await this.prisma.day.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    if (!day) {
      day = await this.prisma.day.create({
        data: {
          userId,
          date: today,
          state: 'START',
        },
      });
    }

    return day.id;
  }

  /**
   * Get or create the active daily conversation for a user
   */
  async getOrCreateDailyConversation(userId: string): Promise<string> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Try to find existing active daily conversation for today
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        userId,
        type: ConversationType.DAILY,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
        state: {
          in: [ConversationState.CREATED, ConversationState.ACTIVE],
        },
      },
    });

    if (!conversation) {
      // Get or create today's day
      const dayId = await this.getOrCreateTodayDay(userId);

      // Create new daily conversation
      conversation = await this.prisma.conversation.create({
        data: {
          userId,
          dayId,
          type: ConversationType.DAILY,
          mode: ConversationMode.MANAGER,
          state: ConversationState.CREATED,
          date: today,
          messages: {
            create: {
              role: 'SYSTEM',
              content:
                'Daily conversation started. Ready to help with planning, execution, and reflection.',
            },
          },
        },
      });
    }

    // Ensure conversation is ACTIVE if it has user messages
    const messageCount = await this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        role: 'USER',
      },
    });

    if (messageCount > 0 && conversation.state === ConversationState.CREATED) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { state: ConversationState.ACTIVE },
      });
      conversation.state = ConversationState.ACTIVE;
    }

    return conversation.id;
  }

  /**
   * Create a new ad-hoc conversation
   */
  async createAdHocConversation(
    userId: string,
    mode: ConversationMode = ConversationMode.COMPANION,
  ): Promise<string> {
    // Get or create today's day
    const dayId = await this.getOrCreateTodayDay(userId);

    const conversation = await this.prisma.conversation.create({
      data: {
        userId,
        dayId,
        type: ConversationType.AD_HOC,
        mode,
        state: ConversationState.CREATED,
        date: new Date(),
        messages: {
          create: {
            role: 'SYSTEM',
            content: `Ad-hoc conversation started in ${mode} mode.`,
          },
        },
      },
    });

    return conversation.id;
  }

  /**
   * Get active conversation for a user (daily or ad-hoc)
   */
  async getActiveConversation(userId: string, conversationId?: string) {
    if (conversationId) {
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId,
          state: {
            in: [ConversationState.CREATED, ConversationState.ACTIVE],
          },
        },
        include: {
          day: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          user: {
            include: {
              profile: true,
            },
          },
        },
      });

      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      return conversation;
    }

    // Get daily conversation by default
    const id = await this.getOrCreateDailyConversation(userId);
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        user: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  /**
   * Handle a user message with full lifecycle
   */
  async handleMessage(
    userId: string,
    message: string,
    conversationId?: string,
    mode?: ConversationMode,
  ) {
    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await this.getActiveConversation(userId, conversationId);
    } else {
      const id = await this.getOrCreateDailyConversation(userId);
      conversation = await this.prisma.conversation.findUnique({
        where: { id },
        include: {
          day: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          user: {
            include: {
              profile: true,
            },
          },
        },
      });
    }

    // Update mode if provided
    if (mode && mode !== conversation.mode) {
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { mode },
        include: {
          day: true,
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          user: {
            include: {
              profile: true,
            },
          },
        },
      });
    }

    // Save user message
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: message,
      },
    });

    // Activate conversation if needed
    if (conversation.state === ConversationState.CREATED) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { state: ConversationState.ACTIVE },
      });
    }

    // Build context and generate AI response
    const context = await this.buildContext(conversation.id, userId);
    const aiResponse = await this.ai.generateResponse(message, context);

    // Save AI response
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: aiResponse.content,
      },
    });

    // Post-processing: action candidates
    let actionCandidates = aiResponse.actionCandidates ?? [];
    if (actionCandidates.length === 0) {
      const taskHints = [
        ...(context.tasksToday ?? []),
        ...(context.backlogTasks ?? []),
      ].map(task => ({ id: task.id, name: task.name }));
      actionCandidates = this.intentDetector.detect(message, taskHints);
    }

    const storedActions =
      actionCandidates.length > 0
        ? await this.actionsService.createCandidates(userId, actionCandidates, {
            conversationId: conversation.id,
            dayId: conversation.dayId,
            tasks: [
              ...(context.tasksToday ?? []),
              ...(context.backlogTasks ?? []),
            ].map(task => ({ id: task.id, name: task.name })),
          })
        : [];

    // Post-processing: extract actions and memory candidates
    if (aiResponse.memoryCandidates && aiResponse.memoryCandidates.length > 0) {
      await this.createMemoryCandidates(conversation.id, userId, aiResponse.memoryCandidates);
    }

    return {
      conversationId: conversation.id,
      message: {
        id: assistantMessage.id,
        role: 'ASSISTANT' as const,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt.toISOString(),
      },
      actions: storedActions,
    };
  }

  /**
   * Build context for AI response
   */
  private async buildContext(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        day: {
          include: {
            tasks: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        user: {
          include: {
            profile: true,
          },
        },
        memories: {
          orderBy: { importance: 'desc' },
          take: 10, // Get most important recent memories
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const tasksToday = (conversation.day?.tasks ?? []).map(task => ({
      id: task.id,
      name: task.name,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline ? task.deadline.toISOString() : null,
    }));

    const backlogTasks = await this.prisma.task.findMany({
      where: {
        userId,
        status: { not: TaskStatus.DONE },
        dayId: conversation.dayId ? { not: conversation.dayId } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      mode: conversation.mode,
      userProfile: conversation.user?.profile || null,
      messages: conversation.messages,
      memories: conversation.memories || [],
      day: conversation.day
        ? {
            date: conversation.day.date.toISOString().split('T')[0],
            state: conversation.day.state,
          }
        : undefined,
      tasksToday,
      backlogTasks: backlogTasks.map(task => ({
        id: task.id,
        name: task.name,
        status: task.status,
        priority: task.priority,
        deadline: task.deadline ? task.deadline.toISOString() : null,
      })),
    };
  }

  /**
   * Create memory candidates from AI response
   */
  private async createMemoryCandidates(
    conversationId: string,
    userId: string,
    candidates: Array<{ content: string; importance: number; tags?: string[] }>,
  ) {
    // Only save memories in REFLECTION mode or if explicitly marked as important
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (
      conversation?.mode !== ConversationMode.REFLECTION &&
      conversation?.mode !== ConversationMode.COMPANION
    ) {
      // Only save high-importance memories in other modes
      candidates = candidates.filter(c => c.importance >= 8);
    }

    if (candidates.length === 0) return;

    await this.prisma.memory.createMany({
      data: candidates.map(c => ({
        conversationId,
        userId,
        content: c.content,
        importance: c.importance,
        tags: c.tags || [],
      })),
    });
  }

  /**
   * Switch conversation mode
   */
  async switchMode(userId: string, conversationId: string, mode: ConversationMode) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
        state: {
          in: [ConversationState.CREATED, ConversationState.ACTIVE],
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { mode },
    });
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { state: ConversationState.ARCHIVED },
    });
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(userId: string, includeArchived = false) {
    return this.prisma.conversation.findMany({
      where: {
        userId,
        state: includeArchived ? undefined : { not: ConversationState.ARCHIVED },
      },
      include: {
        day: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Get last message for preview
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
