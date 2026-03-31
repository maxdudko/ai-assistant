import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConversationMode, TaskStatus } from '@prisma/client';
import {
  buildSystemPrompt,
  messagesToLlmFormat,
  type ConversationContext,
  ConversationMode as CoreConversationMode,
  MessageRole as CoreMessageRole,
} from '@ai/ai-core';

import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ConversationState, ConversationType } from '../prisma/types';
import { ActionsService } from '../actions/actions.service';
import { IntentDetectorService } from '../intents/intent-detector.service';
import { MemoryIngestionService } from '../memory/memory-ingestion.service';
import { MemoryRetrieverService, type RetrievedMemory } from '../memory/memory-retriever.service';
import { DaysService } from '../days/days.service';
import { MemoryCandidateDto, MemoryType } from '../memory/dto/memory-candidate.dto';
import { DigestService } from '../digest/digest.service';
import { LogsService } from '../logs/logs.service';
import type { ListPagination } from '../common/parse-list-pagination';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);
  private readonly verbosePromptLogging = process.env.AI_VERBOSE_PROMPT_LOGS === 'true';
  private readonly contextMessageLimit = Number(process.env.AI_CONTEXT_MESSAGE_LIMIT ?? '40');
  private readonly memoryRetrieveTimeoutMs = Number(
    process.env.AI_MEMORY_RETRIEVE_TIMEOUT_MS ?? '1200',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly actionsService: ActionsService,
    private readonly intentDetector: IntentDetectorService,
    private readonly memoryIngestion: MemoryIngestionService,
    private readonly memoryRetriever: MemoryRetrieverService,
    private readonly daysService: DaysService,
    private readonly digestService: DigestService,
    private readonly logsService: LogsService,
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
              mode: ConversationMode.MANAGER,
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
            mode,
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
    onToken?: (token: string) => Promise<void> | void,
  ) {
    const requestStartedAt = Date.now();
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

    const infoTriggered = this.shouldUseInfoMode(message, mode, conversation.mode);
    if (infoTriggered && conversation.mode !== ConversationMode.INFO) {
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { mode: ConversationMode.INFO },
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

    const reflectionTriggered = !infoTriggered && this.isReflectionTrigger(message);
    if (reflectionTriggered && conversation.mode !== ConversationMode.REFLECTION) {
      conversation = await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { mode: ConversationMode.REFLECTION },
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
        mode: conversation.mode,
      },
    });

    // Activate conversation if needed
    if (conversation.state === ConversationState.CREATED) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { state: ConversationState.ACTIVE },
      });
    }

    if (infoTriggered) {
      const infoFlowStartedAt = Date.now();
      const digest = await this.digestService.generateDigest(userId, message);

      if (onToken) {
        for (const char of digest.content) {
          await onToken(char);
        }
      }

      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: digest.content,
          mode: conversation.mode,
        },
      });

      const actionContext = {
        conversationId: conversation.id,
        dayId: conversation.dayId,
      };
      const actionPreparedStartedAt = Date.now();
      const storedActions =
        digest.actionCandidates.length > 0
          ? this.actionsService.prepareCandidates(digest.actionCandidates, actionContext)
          : [];
      const actionPreparedMs = Date.now() - actionPreparedStartedAt;

      const promptText = `INFO mode digest request: ${message}`;
      this.runInBackground(
        [
          storedActions.length > 0
            ? {
                name: 'persist-info-actions',
                run: async () => {
                  await this.actionsService.createCandidates(userId, storedActions, actionContext);
                },
              }
            : null,
          {
            name: 'log-info-ai-interaction',
            run: async () => {
              await this.logsService.create(
                userId,
                conversation.mode,
                promptText,
                digest.content,
                digest.actionCandidates || [],
              );
            },
          },
        ].filter((task): task is { name: string; run: () => Promise<void> } => task !== null),
      );

      this.logger.log(
        [
          'timing',
          'flow=info',
          `totalMs=${Date.now() - requestStartedAt}`,
          `infoFlowMs=${Date.now() - infoFlowStartedAt}`,
          `actionPrepareMs=${actionPreparedMs}`,
          `actions=${storedActions.length}`,
          `responseChars=${digest.content.length}`,
        ].join(' '),
      );

      return {
        conversationId: conversation.id,
        message: {
          id: assistantMessage.id,
          role: 'ASSISTANT' as const,
          content: assistantMessage.content,
          mode: assistantMessage.mode,
          createdAt: assistantMessage.createdAt.toISOString(),
        },
        actions: storedActions,
      };
    }

    // Build context and generate AI response
    const contextStartedAt = Date.now();
    const context = await this.buildContext(
      conversation.id,
      userId,
      message,
      conversation.mode === ConversationMode.REFLECTION || reflectionTriggered,
    );
    const contextMs = Date.now() - contextStartedAt;
    const aiStartedAt = Date.now();
    const aiResponse = onToken
      ? await this.ai.generateResponseStream(message, context, onToken)
      : await this.ai.generateResponse(message, context);
    const aiMs = Date.now() - aiStartedAt;

    const promptLog = this.buildPromptLog(context, message);
    this.logger.log(
      [
        `mode=${conversation.mode}`,
        `messages=${promptLog.messages.length}`,
        `memories=${context.memories?.length ?? 0}`,
        `actions=${aiResponse.actionCandidates?.length ?? 0}`,
        `memoryCandidates=${aiResponse.memoryCandidates?.length ?? 0}`,
        `responseChars=${aiResponse.content?.length ?? 0}`,
      ].join(' '),
    );
    if (this.verbosePromptLogging) {
      this.logger.debug('systemPrompt: ' + promptLog.systemPrompt);
      this.logger.debug('messages: ' + JSON.stringify(promptLog.messages));
      this.logger.debug('memories: ' + JSON.stringify(context.memories));
      this.logger.debug('response: ' + JSON.stringify(aiResponse.content));
      this.logger.debug('actions: ' + JSON.stringify(aiResponse.actionCandidates ?? []));
      this.logger.debug('memoryCandidates: ' + JSON.stringify(aiResponse.memoryCandidates ?? []));
      this.logger.debug('summary: ' + JSON.stringify(aiResponse.summary ?? []));
    }

    // Build full prompt string for logging
    const fullPrompt = this.buildFullPromptString(promptLog.systemPrompt, promptLog.messages);

    // Save AI response
    const assistantWriteStartedAt = Date.now();
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: aiResponse.content,
        mode: conversation.mode,
      },
    });
    const assistantWriteMs = Date.now() - assistantWriteStartedAt;

    const actionPreparedStartedAt = Date.now();
    let storedActions = [] as Awaited<ReturnType<ActionsService['createCandidates']>>;
    let actionPersistenceTask: { name: string; run: () => Promise<void> } | null = null;
    if (conversation.mode !== ConversationMode.REFLECTION) {
      // Post-processing: action candidates
      let actionCandidates = aiResponse.actionCandidates ?? [];
      const tasksContext = [...(context.tasksToday ?? []), ...(context.backlogTasks ?? [])].map(
        task => ({
          id: task.id,
          name: task.name,
        }),
      );
      if (actionCandidates.length === 0) {
        actionCandidates = this.intentDetector.detect(message, tasksContext);
      }

      const actionContext = {
        conversationId: conversation.id,
        dayId: conversation.dayId,
        tasks: tasksContext,
      };
      storedActions =
        actionCandidates.length > 0
          ? this.actionsService.prepareCandidates(actionCandidates, actionContext)
          : [];
      if (storedActions.length > 0) {
        actionPersistenceTask = {
          name: 'persist-actions',
          run: async () => {
            await this.actionsService.createCandidates(userId, storedActions, actionContext);
          },
        };
      }
    }
    const actionPrepareMs = Date.now() - actionPreparedStartedAt;

    const backgroundTasks: Array<{ name: string; run: () => Promise<void> }> = [];
    if (actionPersistenceTask) {
      backgroundTasks.push(actionPersistenceTask);
    }
    if (aiResponse.memoryCandidates && aiResponse.memoryCandidates.length > 0) {
      const mappedCandidates = this.mapMemoryCandidates(aiResponse.memoryCandidates);
      if (conversation.mode === ConversationMode.REFLECTION) {
        const curated = this.validateReflectionCandidates(mappedCandidates).slice(0, 3);
        if (curated.length > 0) {
          backgroundTasks.push({
            name: 'memory-ingestion-reflection',
            run: async () => {
              await this.memoryIngestion.ingest(userId, curated, 'REFLECTION', {
                dayId: conversation.dayId ?? undefined,
              });
            },
          });
        }
      } else {
        backgroundTasks.push({
          name: 'memory-ingestion-conversation',
          run: async () => {
            await this.memoryIngestion.ingest(userId, mappedCandidates, 'CONVERSATION', {
              conversationId: conversation.id,
              dayId: conversation.dayId ?? undefined,
            });
          },
        });
      }
    }

    if (reflectionTriggered) {
      backgroundTasks.push({
        name: 'end-day',
        run: async () => {
          await this.daysService.endDay(userId);
        },
      });
    }

    backgroundTasks.push({
      name: 'log-ai-interaction',
      run: async () => {
        await this.logsService.create(
          userId,
          conversation.mode,
          fullPrompt,
          aiResponse.content,
          aiResponse.actionCandidates || [],
        );
      },
    });
    this.runInBackground(backgroundTasks);
    this.logger.log(
      [
        'timing',
        'flow=chat',
        `totalMs=${Date.now() - requestStartedAt}`,
        `contextMs=${contextMs}`,
        `aiMs=${aiMs}`,
        `assistantWriteMs=${assistantWriteMs}`,
        `actionPrepareMs=${actionPrepareMs}`,
        `actions=${storedActions.length}`,
        `backgroundTasks=${backgroundTasks.length}`,
        `responseChars=${aiResponse.content.length}`,
      ].join(' '),
    );

    return {
      conversationId: conversation.id,
      message: {
        id: assistantMessage.id,
        role: 'ASSISTANT' as const,
        content: assistantMessage.content,
        mode: assistantMessage.mode,
        createdAt: assistantMessage.createdAt.toISOString(),
      },
      actions: storedActions,
      summary:
        conversation.mode === ConversationMode.REFLECTION
          ? this.validateSummary(aiResponse.summary)
          : undefined,
    };
  }

  /**
   * Build context for AI response
   */
  private async buildContext(
    conversationId: string,
    userId: string,
    query?: string,
    includeReflectionContext = false,
  ) {
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

    const keyMessages =
      includeReflectionContext && conversation.dayId
        ? await this.buildReflectionKeyMessages(conversation.dayId)
        : undefined;

    const retrievedMemories = query
      ? await this.retrieveMemoriesWithTimeout(userId, query, this.memoryRetrieveTimeoutMs)
      : [];
    const contextMessages = conversation.messages.slice(-this.contextMessageLimit);

    return {
      mode: conversation.mode,
      userProfile: conversation.user?.profile || null,
      messages: contextMessages,
      memories: retrievedMemories.map(memory => ({
        content: memory.content,
        importance: memory.importance,
        tags: memory.tags ?? [],
      })),
      day: conversation.day
        ? {
            date: conversation.day.date.toISOString().split('T')[0],
            state: conversation.day.state,
          }
        : undefined,
      tasksToday,
      keyMessages,
      backlogTasks: backlogTasks.map(task => ({
        id: task.id,
        name: task.name,
        status: task.status,
        priority: task.priority,
        deadline: task.deadline ? task.deadline.toISOString() : null,
      })),
    };
  }

  private async retrieveMemoriesWithTimeout(
    userId: string,
    query: string,
    timeoutMs: number,
  ): Promise<RetrievedMemory[]> {
    const startedAt = Date.now();
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      const timeoutPromise = new Promise<RetrievedMemory[]>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`memory retrieval timeout after ${timeoutMs}ms`));
        }, timeoutMs);
        timeoutHandle.unref?.();
      });
      return await Promise.race([this.memoryRetriever.retrieve(userId, query), timeoutPromise]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Memory retrieval skipped: ${message} (elapsedMs=${Date.now() - startedAt}, timeoutMs=${timeoutMs})`,
      );
      return [];
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private isReflectionTrigger(message: string): boolean {
    const normalized = message.trim().toLowerCase();
    const triggers = [
      "let's summarize the day",
      'lets summarize the day',
      'summarize the day',
      'summary of the day',
      "let's reflect",
      'lets reflect',
      'reflect on the day',
      'daily reflection',
      'reflect today',
    ];
    return triggers.some(trigger => normalized.includes(trigger));
  }

  private shouldUseInfoMode(
    message: string,
    requestedMode?: ConversationMode,
    currentMode?: ConversationMode,
  ): boolean {
    if (requestedMode === ConversationMode.INFO || currentMode === ConversationMode.INFO) {
      return true;
    }

    const normalized = message.trim().toLowerCase();
    const patterns = [
      /\bupdates?\s+on\b/,
      /\blatest\b/,
      /\bnews\b/,
      /\bheadline(s)?\b/,
      /\bwhat happened\b/,
      /\bdigest\b/,
      /\bbrief(ing)?\b/,
    ];

    return patterns.some(pattern => pattern.test(normalized));
  }

  private async buildReflectionKeyMessages(dayId: string): Promise<string[]> {
    const day = await this.prisma.day.findUnique({
      where: { id: dayId },
      include: {
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!day) {
      return [];
    }

    const messages = day.conversations
      .flatMap(conversation => conversation.messages)
      .filter(message => message.role !== 'SYSTEM')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-10);

    return messages.map(message => {
      const prefix = message.role === 'USER' ? 'User' : 'Assistant';
      return `${prefix}: ${message.content}`;
    });
  }

  private validateSummary(summary?: string): string | undefined {
    if (!summary) {
      return undefined;
    }
    const trimmed = summary.trim();
    return trimmed.length > 20 ? trimmed : undefined;
  }

  private runInBackground(tasks: Array<{ name: string; run: () => Promise<void> }>): void {
    if (tasks.length === 0) {
      return;
    }

    void Promise.allSettled(tasks.map(task => task.run())).then(results => {
      for (const [index, result] of results.entries()) {
        if (result.status === 'rejected') {
          const reason =
            result.reason instanceof Error ? result.reason : new Error(String(result.reason));
          this.logger.error(`Background task failed: ${tasks[index].name}`, reason);
        }
      }
    });
  }

  private mapMemoryCandidates(
    candidates: Array<{
      content: string;
      type?: string;
      importance: number;
      tags?: string[];
      confidence: number;
    }>,
  ): MemoryCandidateDto[] {
    const mapped: MemoryCandidateDto[] = [];
    for (const candidate of candidates) {
      const typeRaw = typeof candidate.type === 'string' ? candidate.type.toUpperCase() : '';
      const type =
        typeRaw === 'FACTUAL'
          ? MemoryType.FACTUAL
          : typeRaw === 'REFLECTION'
            ? MemoryType.REFLECTION
            : undefined;

      if (!type) {
        continue;
      }

      mapped.push({
        content: candidate.content,
        type,
        importance: candidate.importance,
        ...(candidate.tags ? { tags: candidate.tags } : {}),
        confidence: candidate.confidence,
      });
    }

    return mapped;
  }

  private validateReflectionCandidates(candidates: MemoryCandidateDto[]) {
    return candidates.filter(candidate => candidate.confidence >= 0.7 && candidate.importance >= 5);
  }

  private buildPromptLog(
    context: Awaited<ReturnType<ConversationsService['buildContext']>>,
    message: string,
  ) {
    const coreContext: ConversationContext = {
      mode: context.mode as unknown as CoreConversationMode,
      userProfile: context.userProfile
        ? {
            displayName: context.userProfile.displayName,
            tone: context.userProfile.tone,
            verbosity: context.userProfile.verbosity,
            useEmoji: context.userProfile.useEmoji,
          }
        : undefined,
      messages: context.messages.map(msg => ({
        role: msg.role as unknown as CoreMessageRole,
        content: msg.content,
      })),
      memories: context.memories.map(memory => ({
        content: memory.content,
        importance: memory.importance,
        tags: memory.tags,
      })),
      day: context.day,
      tasksToday: context.tasksToday,
      backlogTasks: context.backlogTasks,
      keyMessages: context.keyMessages,
    };

    const systemPrompt = buildSystemPrompt(coreContext);
    const llmMessages = messagesToLlmFormat(coreContext.messages);
    llmMessages.push({ role: 'USER', content: message });

    return {
      systemPrompt,
      messages: llmMessages,
    };
  }

  /**
   * Build a full prompt string from system prompt and messages for logging
   */
  private buildFullPromptString(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
  ): string {
    let prompt = '';
    if (systemPrompt) {
      prompt += `System: ${systemPrompt}\n\n`;
    }
    messages.forEach(msg => {
      prompt += `${msg.role}: ${msg.content}\n`;
    });
    return prompt.trim();
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
  async getUserConversations(
    userId: string,
    includeArchived = false,
    pagination: ListPagination,
  ) {
    const { limit, offset } = pagination;
    const take = limit + 1;

    const rows = await this.prisma.conversation.findMany({
      where: {
        userId,
        state: includeArchived ? undefined : { not: ConversationState.ARCHIVED },
      },
      include: {
        day: {
          select: {
            id: true,
            userId: true,
            date: true,
            state: true,
            startedAt: true,
            endedAt: true,
            createdAt: true,
            morningBriefingSentAt: true,
            eveningReflectionSentAt: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            role: true,
            content: true,
            mode: true,
            createdAt: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
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
}
