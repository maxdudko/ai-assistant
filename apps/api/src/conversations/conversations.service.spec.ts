import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConversationMode } from '@prisma/client';

import { ConversationsService } from './conversations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ConversationState, ConversationType } from '../prisma/types';
import { ActionsService } from '../actions/actions.service';
import { IntentDetectorService } from '../intents/intent-detector.service';
import { MemoryIngestionService } from '../memory/memory-ingestion.service';
import { MemoryRetrieverService } from '../memory/memory-retriever.service';
import { DaysService } from '../days/days.service';
import { DigestService } from '../digest/digest.service';
import { LogsService } from '../logs/logs.service';
import { DailyConversationService } from '../daily/daily-conversation.service';
import { DailyEngineService } from '../daily/daily-engine.service';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prisma: jest.Mocked<PrismaService>;
  let ai: jest.Mocked<AiService>;
  let actions: jest.Mocked<ActionsService>;
  let intentDetector: jest.Mocked<IntentDetectorService>;
  let memoryIngestion: { ingest: jest.Mock };
  let dailyConversation: { getOrCreate: jest.Mock };

  const mockUserId = 'user-123';
  const mockConversationId = 'conv-123';
  const mockDayId = 'day-test-1';
  const mockToday = new Date();
  mockToday.setHours(0, 0, 0, 0);

  const mockConversation = {
    id: mockConversationId,
    userId: mockUserId,
    dayId: mockDayId,
    mode: ConversationMode.MANAGER,
    state: ConversationState.CREATED,
    type: ConversationType.DAILY,
    date: mockToday,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMessage = {
    id: 'msg-123',
    conversationId: mockConversationId,
    role: 'USER' as const,
    content: 'Hello',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      conversation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      day: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      message: {
        create: jest.fn(),
        count: jest.fn(),
      },
      memory: {
        createMany: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
      },
    };

    const mockAi = {
      generateResponse: jest.fn(),
    };

    const mockActions = {
      createCandidates: jest.fn(),
      prepareCandidates: jest.fn().mockReturnValue([]),
    };

    const mockIntentDetector = {
      detect: jest.fn(),
    };

    const mockMemoryIngestion = {
      ingest: jest.fn().mockResolvedValue(undefined),
    };

    const mockMemoryRetriever = {
      retrieve: jest.fn().mockResolvedValue([]),
      getMemoryContext: jest.fn().mockResolvedValue({
        patterns: [],
        semantic: [],
        recent: [],
        important: [],
        merged: [],
      }),
      trackUsage: jest.fn().mockResolvedValue(undefined),
    };

    const mockDaysService = {
      endDay: jest.fn().mockResolvedValue(undefined),
    };

    const mockDigestService = {
      generateDigest: jest.fn().mockResolvedValue({
        content: '',
        actionCandidates: [],
      }),
    };

    const mockLogsService = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    const mockDailyConversation = {
      getOrCreate: jest.fn().mockResolvedValue({
        conversationId: mockConversationId,
        dayId: mockDayId,
        date: mockToday,
        timezone: 'UTC',
      }),
    };

    const mockDailyEngine = {
      handleEvent: jest.fn().mockResolvedValue({
        morningSent: false,
        planningSuggestionSent: false,
        noProgressNudgeSent: false,
        stuckTaskNudgeSent: false,
        eveningSent: false,
        actions: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: AiService,
          useValue: mockAi,
        },
        {
          provide: ActionsService,
          useValue: mockActions,
        },
        {
          provide: IntentDetectorService,
          useValue: mockIntentDetector,
        },
        {
          provide: MemoryIngestionService,
          useValue: mockMemoryIngestion,
        },
        {
          provide: MemoryRetrieverService,
          useValue: mockMemoryRetriever,
        },
        {
          provide: DaysService,
          useValue: mockDaysService,
        },
        {
          provide: DigestService,
          useValue: mockDigestService,
        },
        {
          provide: LogsService,
          useValue: mockLogsService,
        },
        {
          provide: DailyConversationService,
          useValue: mockDailyConversation,
        },
        {
          provide: DailyEngineService,
          useValue: mockDailyEngine,
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    prisma = module.get(PrismaService);
    ai = module.get(AiService);
    actions = module.get(ActionsService);
    intentDetector = module.get(IntentDetectorService);
    memoryIngestion = module.get(MemoryIngestionService);
    dailyConversation = module.get(DailyConversationService);

    prisma.conversation.findUnique.mockResolvedValue({
      id: mockConversationId,
      state: ConversationState.CREATED,
    });

    prisma.day.findUnique.mockImplementation(
      (args: {
        where: { id?: string; userId_date?: { userId: string; date: Date } };
        include?: { conversations?: unknown };
      }) => {
        if (args?.include && 'conversations' in args.include) {
          return Promise.resolve({
            id: mockDayId,
            conversations: [],
          });
        }
        return Promise.resolve({ id: mockDayId });
      },
    );
    prisma.day.create.mockResolvedValue({ id: mockDayId });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateDailyConversation', () => {
    it('should resolve a daily conversation through the unified service', async () => {
      prisma.message.count.mockResolvedValue(0);

      const result = await service.getOrCreateDailyConversation(mockUserId);

      expect(result).toBe(mockConversationId);
      expect(dailyConversation.getOrCreate).toHaveBeenCalledWith(mockUserId);
      expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: mockConversationId },
        select: { id: true, state: true },
      });
    });

    it('should throw if unified service returns missing conversation id', async () => {
      dailyConversation.getOrCreate.mockResolvedValueOnce({
        conversationId: 'missing-conversation',
        dayId: mockDayId,
        date: mockToday,
        timezone: 'UTC',
      });
      prisma.conversation.findUnique.mockResolvedValueOnce(null);
      prisma.message.count.mockResolvedValue(0);

      await expect(service.getOrCreateDailyConversation(mockUserId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('should activate conversation if it has user messages', async () => {
      const activeConversation = { ...mockConversation, state: ConversationState.ACTIVE };
      prisma.conversation.findUnique.mockResolvedValue({
        id: mockConversationId,
        state: ConversationState.CREATED,
      });
      prisma.message.count.mockResolvedValue(1);
      prisma.conversation.update.mockResolvedValue(activeConversation);

      await service.getOrCreateDailyConversation(mockUserId);

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: mockConversationId },
        data: { state: ConversationState.ACTIVE },
      });
    });
  });

  describe('createAdHocConversation', () => {
    it('should create ad-hoc conversation with default COMPANION mode', async () => {
      const adHocConversation = {
        ...mockConversation,
        type: ConversationType.AD_HOC,
        mode: ConversationMode.COMPANION,
      };
      prisma.conversation.create.mockResolvedValue(adHocConversation);

      const result = await service.createAdHocConversation(mockUserId);

      expect(result).toBe(mockConversationId);
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          dayId: mockDayId,
          type: ConversationType.AD_HOC,
          mode: ConversationMode.COMPANION,
          state: ConversationState.CREATED,
          date: expect.any(Date),
          messages: {
            create: {
              role: 'SYSTEM',
              content: expect.stringContaining('Ad-hoc conversation started'),
              mode: ConversationMode.COMPANION,
            },
          },
        },
      });
    });

    it('should create ad-hoc conversation with specified mode', async () => {
      const adHocConversation = {
        ...mockConversation,
        type: ConversationType.AD_HOC,
        mode: ConversationMode.REFLECTION,
      };
      prisma.conversation.create.mockResolvedValue(adHocConversation);

      await service.createAdHocConversation(mockUserId, ConversationMode.REFLECTION);

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          mode: ConversationMode.REFLECTION,
        }),
      });
    });
  });

  describe('getActiveConversation', () => {
    it('should return conversation by id if provided', async () => {
      const conversationWithMessages = {
        ...mockConversation,
        messages: [mockMessage],
        user: { profile: null },
        day: null,
      };
      prisma.conversation.findFirst.mockResolvedValue(conversationWithMessages);

      const result = await service.getActiveConversation(mockUserId, mockConversationId);

      expect(result).toEqual(conversationWithMessages);
      expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockConversationId,
          userId: mockUserId,
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
    });

    it('should throw NotFoundException if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(service.getActiveConversation(mockUserId, mockConversationId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should get daily conversation if no id provided', async () => {
      const conversationWithMessages = {
        ...mockConversation,
        messages: [mockMessage],
        user: { profile: null },
      };
      prisma.conversation.findFirst.mockResolvedValue(mockConversation);
      prisma.message.count.mockResolvedValue(0);
      prisma.conversation.findUnique.mockResolvedValue(conversationWithMessages);

      const result = await service.getActiveConversation(mockUserId);

      expect(result).toEqual(conversationWithMessages);
    });
  });

  describe('handleMessage', () => {
    const mockAiResponse = {
      content: 'AI response',
      memoryCandidates: [] as {
        content: string;
        type: 'FACTUAL' | 'REFLECTION';
        layer: 'SEMANTIC' | 'EPISODIC' | 'PATTERN';
        importance: number;
        tags?: string[];
        confidence: number;
      }[],
    };

    const loadedForMessage = (overrides: Record<string, unknown> = {}) => ({
      ...mockConversation,
      day: {
        date: mockToday,
        state: 'START',
        tasks: [],
      },
      messages: [mockMessage],
      user: { profile: null },
      ...overrides,
    });

    it('should handle message in existing conversation', async () => {
      const conversationWithUser = loadedForMessage();
      const assistantMessage = {
        ...mockMessage,
        id: 'msg-assistant',
        role: 'ASSISTANT' as const,
        content: 'AI response',
      };

      prisma.conversation.findFirst.mockResolvedValue(conversationWithUser);
      prisma.message.create
        .mockResolvedValueOnce(mockMessage) // User message
        .mockResolvedValueOnce(assistantMessage); // AI response
      prisma.conversation.update.mockResolvedValue({
        ...conversationWithUser,
        state: ConversationState.ACTIVE,
      });
      prisma.task.findMany.mockResolvedValue([]);
      actions.createCandidates.mockResolvedValue([]);
      intentDetector.detect.mockReturnValue([]);
      ai.generateResponse.mockResolvedValue(mockAiResponse);

      const result = await service.handleMessage(mockUserId, 'Hello', mockConversationId);

      expect(result.conversationId).toBe(mockConversationId);
      expect(result.message.content).toBe('AI response');
      expect(prisma.message.create).toHaveBeenCalledTimes(2);
      expect(ai.generateResponse).toHaveBeenCalled();
    });

    it('should create daily conversation if no conversationId provided', async () => {
      const conversationWithUser = loadedForMessage();
      const assistantMessage = {
        ...mockMessage,
        id: 'msg-assistant',
        role: 'ASSISTANT' as const,
        content: 'AI response',
      };

      prisma.conversation.findFirst
        .mockResolvedValueOnce(mockConversation)
        .mockResolvedValueOnce(conversationWithUser);
      prisma.message.count.mockResolvedValue(0);
      prisma.message.create
        .mockResolvedValueOnce(mockMessage)
        .mockResolvedValueOnce(assistantMessage);
      prisma.task.findMany.mockResolvedValue([]);
      actions.createCandidates.mockResolvedValue([]);
      intentDetector.detect.mockReturnValue([]);
      ai.generateResponse.mockResolvedValue(mockAiResponse);

      const result = await service.handleMessage(mockUserId, 'Hello');

      expect(result.conversationId).toBe(mockConversationId);
    });

    it('should update mode if provided and different', async () => {
      const conversationWithUser = loadedForMessage();
      const updatedConversation = {
        ...conversationWithUser,
        mode: ConversationMode.REFLECTION,
      };
      const assistantMessage = {
        ...mockMessage,
        id: 'msg-assistant',
        role: 'ASSISTANT' as const,
        content: 'AI response',
      };

      prisma.conversation.findFirst.mockResolvedValue(conversationWithUser);
      prisma.conversation.update
        .mockResolvedValueOnce(updatedConversation) // Mode update
        .mockResolvedValueOnce({
          ...updatedConversation,
          state: ConversationState.ACTIVE,
        }); // State update
      prisma.message.create
        .mockResolvedValueOnce(mockMessage)
        .mockResolvedValueOnce(assistantMessage);
      prisma.task.findMany.mockResolvedValue([]);
      actions.createCandidates.mockResolvedValue([]);
      intentDetector.detect.mockReturnValue([]);
      ai.generateResponse.mockResolvedValue(mockAiResponse);

      await service.handleMessage(
        mockUserId,
        'Hello',
        mockConversationId,
        ConversationMode.REFLECTION,
      );

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: mockConversationId },
        data: { mode: ConversationMode.REFLECTION },
      });
    });

    it('should activate conversation if in CREATED state', async () => {
      const conversationWithUser = loadedForMessage({ state: ConversationState.CREATED });
      const assistantMessage = {
        ...mockMessage,
        id: 'msg-assistant',
        role: 'ASSISTANT' as const,
        content: 'AI response',
      };

      prisma.conversation.findFirst.mockResolvedValue(conversationWithUser);
      prisma.message.create
        .mockResolvedValueOnce(mockMessage)
        .mockResolvedValueOnce(assistantMessage);
      prisma.conversation.update.mockResolvedValue({
        ...conversationWithUser,
        state: ConversationState.ACTIVE,
      });
      prisma.task.findMany.mockResolvedValue([]);
      actions.createCandidates.mockResolvedValue([]);
      intentDetector.detect.mockReturnValue([]);
      ai.generateResponse.mockResolvedValue(mockAiResponse);

      await service.handleMessage(mockUserId, 'Hello', mockConversationId);

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: mockConversationId },
        data: { state: ConversationState.ACTIVE },
      });
    });

    it('should create memory candidates if provided', async () => {
      const conversationWithUser = loadedForMessage();
      const assistantMessage = {
        ...mockMessage,
        id: 'msg-assistant',
        role: 'ASSISTANT' as const,
        content: 'AI response',
      };
      const aiResponseWithMemories = {
        content: 'AI response',
        memoryCandidates: [
          {
            content: 'Important insight about the user',
            type: 'FACTUAL' as const,
            layer: 'SEMANTIC' as const,
            importance: 8,
            tags: ['insight'],
            confidence: 0.9,
          },
        ],
      };

      prisma.conversation.findFirst.mockResolvedValue(conversationWithUser);
      prisma.message.create
        .mockResolvedValueOnce(mockMessage)
        .mockResolvedValueOnce(assistantMessage);
      prisma.conversation.update.mockResolvedValue({
        ...conversationWithUser,
        state: ConversationState.ACTIVE,
      });
      prisma.task.findMany.mockResolvedValue([]);
      actions.createCandidates.mockResolvedValue([]);
      intentDetector.detect.mockReturnValue([]);
      ai.generateResponse.mockResolvedValue(aiResponseWithMemories);

      await service.handleMessage(mockUserId, 'Hello', mockConversationId);
      await new Promise<void>(resolve => setImmediate(resolve));

      expect(memoryIngestion.ingest).toHaveBeenCalledWith(
        mockUserId,
        expect.arrayContaining([
          expect.objectContaining({
            content: 'Important insight about the user',
            importance: 8,
            type: expect.any(String),
            confidence: 0.9,
          }),
        ]),
        'CONVERSATION',
        expect.objectContaining({ conversationId: mockConversationId, dayId: mockDayId }),
      );
    });
  });

  describe('switchMode', () => {
    it('should switch conversation mode', async () => {
      const updatedConversation = {
        ...mockConversation,
        mode: ConversationMode.REFLECTION,
      };

      prisma.conversation.findFirst.mockResolvedValue(mockConversation);
      prisma.conversation.update.mockResolvedValue(updatedConversation);

      const result = await service.switchMode(
        mockUserId,
        mockConversationId,
        ConversationMode.REFLECTION,
      );

      expect(result.mode).toBe(ConversationMode.REFLECTION);
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: mockConversationId },
        data: { mode: ConversationMode.REFLECTION },
      });
    });

    it('should throw NotFoundException if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(
        service.switchMode(mockUserId, mockConversationId, ConversationMode.REFLECTION),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('archiveConversation', () => {
    it('should archive conversation', async () => {
      const archivedConversation = {
        ...mockConversation,
        state: ConversationState.ARCHIVED,
      };

      prisma.conversation.findFirst.mockResolvedValue(mockConversation);
      prisma.conversation.update.mockResolvedValue(archivedConversation);

      const result = await service.archiveConversation(mockUserId, mockConversationId);

      expect(result.state).toBe(ConversationState.ARCHIVED);
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: mockConversationId },
        data: { state: ConversationState.ARCHIVED },
      });
    });

    it('should throw NotFoundException if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(service.archiveConversation(mockUserId, mockConversationId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserConversations', () => {
    const page = { limit: 50, offset: 0 };

    it('should return user conversations excluding archived', async () => {
      const conversations = [mockConversation];
      prisma.conversation.findMany.mockResolvedValue(conversations);

      const result = await service.getUserConversations(mockUserId, false, page);

      expect(result).toEqual({
        items: conversations,
        hasMore: false,
        nextOffset: null,
      });
      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          state: { not: ConversationState.ARCHIVED },
        },
        include: expect.objectContaining({
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
        }),
        orderBy: { updatedAt: 'desc' },
        take: 51,
        skip: 0,
      });
    });

    it('should return all conversations including archived if requested', async () => {
      const conversations = [mockConversation];
      prisma.conversation.findMany.mockResolvedValue(conversations);

      await service.getUserConversations(mockUserId, true, page);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          state: undefined,
        },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        take: 51,
        skip: 0,
      });
    });
  });
});
