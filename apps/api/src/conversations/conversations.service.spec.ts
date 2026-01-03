import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConversationMode } from '@prisma/client';

import { ConversationsService } from './conversations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ConversationState, ConversationType } from '../prisma/types';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prisma: jest.Mocked<PrismaService>;
  let ai: jest.Mocked<AiService>;

  const mockUserId = 'user-123';
  const mockConversationId = 'conv-123';
  const mockToday = new Date();
  mockToday.setHours(0, 0, 0, 0);

  const mockConversation = {
    id: mockConversationId,
    userId: mockUserId,
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
      message: {
        create: jest.fn(),
        count: jest.fn(),
      },
      memory: {
        createMany: jest.fn(),
      },
    };

    const mockAi = {
      generateResponse: jest.fn(),
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
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    prisma = module.get(PrismaService);
    ai = module.get(AiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateDailyConversation', () => {
    it('should return existing daily conversation if found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(mockConversation);
      prisma.message.count.mockResolvedValue(0);

      const result = await service.getOrCreateDailyConversation(mockUserId);

      expect(result).toBe(mockConversationId);
      expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          type: ConversationType.DAILY,
          date: {
            gte: expect.any(Date),
            lt: expect.any(Date),
          },
          state: {
            in: [ConversationState.CREATED, ConversationState.ACTIVE],
          },
        },
      });
    });

    it('should create new daily conversation if not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);
      prisma.conversation.create.mockResolvedValue(mockConversation);
      prisma.message.count.mockResolvedValue(0);

      const result = await service.getOrCreateDailyConversation(mockUserId);

      expect(result).toBe(mockConversationId);
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          type: ConversationType.DAILY,
          mode: ConversationMode.MANAGER,
          state: ConversationState.CREATED,
          date: expect.any(Date),
          messages: {
            create: {
              role: 'SYSTEM',
              content:
                'Daily conversation started. Ready to help with planning, execution, and reflection.',
            },
          },
        },
      });
    });

    it('should activate conversation if it has user messages', async () => {
      const activeConversation = { ...mockConversation, state: ConversationState.ACTIVE };
      prisma.conversation.findFirst.mockResolvedValue(mockConversation);
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
          type: ConversationType.AD_HOC,
          mode: ConversationMode.COMPANION,
          state: ConversationState.CREATED,
          date: expect.any(Date),
          messages: {
            create: {
              role: 'SYSTEM',
              content: expect.stringContaining('Ad-hoc conversation started'),
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
    const mockContext = {
      mode: ConversationMode.MANAGER,
      userProfile: null,
      messages: [mockMessage],
      memories: [],
    };

    const mockAiResponse = {
      content: 'AI response',
      memoryCandidates: [],
    };

    it('should handle message in existing conversation', async () => {
      const conversationWithUser = {
        ...mockConversation,
        messages: [mockMessage],
        user: { profile: null },
      };
      const assistantMessage = {
        ...mockMessage,
        id: 'msg-assistant',
        role: 'ASSISTANT' as const,
        content: 'AI response',
      };

      prisma.conversation.findUnique.mockResolvedValue(conversationWithUser);
      prisma.message.create
        .mockResolvedValueOnce(mockMessage) // User message
        .mockResolvedValueOnce(assistantMessage); // AI response
      prisma.conversation.update.mockResolvedValue({
        ...conversationWithUser,
        state: ConversationState.ACTIVE,
      });
      ai.generateResponse.mockResolvedValue(mockAiResponse);

      const result = await service.handleMessage(mockUserId, 'Hello', mockConversationId);

      expect(result.conversationId).toBe(mockConversationId);
      expect(result.message.content).toBe('AI response');
      expect(prisma.message.create).toHaveBeenCalledTimes(2);
      expect(ai.generateResponse).toHaveBeenCalled();
    });

    it('should create daily conversation if no conversationId provided', async () => {
      const conversationWithUser = {
        ...mockConversation,
        messages: [mockMessage],
        user: { profile: null },
      };
      const assistantMessage = {
        ...mockMessage,
        id: 'msg-assistant',
        role: 'ASSISTANT' as const,
        content: 'AI response',
      };

      prisma.conversation.findFirst.mockResolvedValue(mockConversation);
      prisma.message.count.mockResolvedValue(0);
      prisma.conversation.findUnique.mockResolvedValue(conversationWithUser);
      prisma.message.create
        .mockResolvedValueOnce(mockMessage)
        .mockResolvedValueOnce(assistantMessage);
      ai.generateResponse.mockResolvedValue(mockAiResponse);

      const result = await service.handleMessage(mockUserId, 'Hello');

      expect(result.conversationId).toBe(mockConversationId);
    });

    it('should update mode if provided and different', async () => {
      const conversationWithUser = {
        ...mockConversation,
        messages: [mockMessage],
        user: { profile: null },
      };
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

      prisma.conversation.findUnique.mockResolvedValue(conversationWithUser);
      prisma.conversation.update
        .mockResolvedValueOnce(updatedConversation) // Mode update
        .mockResolvedValueOnce({
          ...updatedConversation,
          state: ConversationState.ACTIVE,
        }); // State update
      prisma.message.create
        .mockResolvedValueOnce(mockMessage)
        .mockResolvedValueOnce(assistantMessage);
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
        include: expect.any(Object),
      });
    });

    it('should activate conversation if in CREATED state', async () => {
      const conversationWithUser = {
        ...mockConversation,
        state: ConversationState.CREATED,
        messages: [mockMessage],
        user: { profile: null },
      };
      const assistantMessage = {
        ...mockMessage,
        id: 'msg-assistant',
        role: 'ASSISTANT' as const,
        content: 'AI response',
      };

      prisma.conversation.findUnique.mockResolvedValue(conversationWithUser);
      prisma.message.create
        .mockResolvedValueOnce(mockMessage)
        .mockResolvedValueOnce(assistantMessage);
      prisma.conversation.update.mockResolvedValue({
        ...conversationWithUser,
        state: ConversationState.ACTIVE,
      });
      ai.generateResponse.mockResolvedValue(mockAiResponse);

      await service.handleMessage(mockUserId, 'Hello', mockConversationId);

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: mockConversationId },
        data: { state: ConversationState.ACTIVE },
      });
    });

    it('should create memory candidates if provided', async () => {
      const conversationWithUser = {
        ...mockConversation,
        messages: [mockMessage],
        user: { profile: null },
      };
      const assistantMessage = {
        ...mockMessage,
        id: 'msg-assistant',
        role: 'ASSISTANT' as const,
        content: 'AI response',
      };
      const aiResponseWithMemories = {
        content: 'AI response',
        memoryCandidates: [{ content: 'Important insight', importance: 8, tags: ['insight'] }],
      };

      prisma.conversation.findUnique
        .mockResolvedValueOnce(conversationWithUser) // For handleMessage
        .mockResolvedValueOnce(mockConversation); // For createMemoryCandidates
      prisma.message.create
        .mockResolvedValueOnce(mockMessage)
        .mockResolvedValueOnce(assistantMessage);
      prisma.conversation.update.mockResolvedValue({
        ...conversationWithUser,
        state: ConversationState.ACTIVE,
      });
      ai.generateResponse.mockResolvedValue(aiResponseWithMemories);

      await service.handleMessage(mockUserId, 'Hello', mockConversationId);

      expect(prisma.memory.createMany).toHaveBeenCalled();
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
    it('should return user conversations excluding archived', async () => {
      const conversations = [mockConversation];
      prisma.conversation.findMany.mockResolvedValue(conversations);

      const result = await service.getUserConversations(mockUserId, false);

      expect(result).toEqual(conversations);
      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          state: { not: ConversationState.ARCHIVED },
        },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should return all conversations including archived if requested', async () => {
      const conversations = [mockConversation];
      prisma.conversation.findMany.mockResolvedValue(conversations);

      await service.getUserConversations(mockUserId, true);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          state: undefined,
        },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
      });
    });
  });
});
