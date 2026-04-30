import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request, { type SuperTest, type Test as SuperTestTest } from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConversationMode } from '@prisma/client';
import { ConversationState, ConversationType } from '../src/prisma/types';

describe('Conversations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authCookies: string[];
  let userId: string;

  const testUser = {
    email: 'conversation-test@example.com',
    password: 'testpassword123',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.enableCors({
      origin: 'http://localhost:3000',
      credentials: true,
    });
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Create test user and get auth cookies
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    userId = registerResponse.body.user.id;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(testUser)
      .expect(200);

    // Store cookies for authenticated requests
    authCookies = loginResponse.headers['set-cookie'] as unknown as string[];
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await prisma.memory.deleteMany({
        where: {
          userId,
        },
      });
      await prisma.message.deleteMany({
        where: {
          conversation: {
            userId,
          },
        },
      });
      await prisma.conversation.deleteMany({
        where: {
          userId,
        },
      });
      await prisma.user.delete({
        where: {
          id: userId,
        },
      });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
    await app.close();
  });

  describe('GET /api/conversations/daily', () => {
    it('should get or create daily conversation', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/conversations/daily')
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('type', ConversationType.DAILY);
      expect(response.body).toHaveProperty('mode', ConversationMode.MANAGER);
      expect(response.body).toHaveProperty('state');
      expect(response.body).toHaveProperty('messages');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).get('/api/conversations/daily').expect(401);
    });
  });

  describe('POST /api/conversations/message', () => {
    it('should send a message and get AI response', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/conversations/message')
        .set('Cookie', authCookies)
        .send({
          message: 'Hello, how can you help me today?',
        })
        .expect(201);

      expect(response.body).toHaveProperty('conversationId');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toHaveProperty('id');
      expect(response.body.message).toHaveProperty('role', 'ASSISTANT');
      expect(response.body.message).toHaveProperty('content');
      expect(response.body.message).toHaveProperty('createdAt');
    });

    it('should send message to specific conversation', async () => {
      // First, get or create a conversation
      const convResponse = await request(app.getHttpServer())
        .get('/api/conversations/daily')
        .set('Cookie', authCookies)
        .expect(200);

      const conversationId = convResponse.body.id;

      // Send message to that conversation
      const response = await request(app.getHttpServer())
        .post('/api/conversations/message')
        .set('Cookie', authCookies)
        .send({
          message: 'What is my plan for today?',
          conversationId,
        })
        .expect(201);

      expect(response.body.conversationId).toBe(conversationId);
      expect(response.body.message).toHaveProperty('content');
    });

    it('should switch mode when sending message', async () => {
      const convResponse = await request(app.getHttpServer())
        .get('/api/conversations/daily')
        .set('Cookie', authCookies)
        .expect(200);

      const conversationId = convResponse.body.id;

      const response = await request(app.getHttpServer())
        .post('/api/conversations/message')
        .set('Cookie', authCookies)
        .send({
          message: 'Let me reflect on today',
          conversationId,
          mode: ConversationMode.REFLECTION,
        })
        .expect(201);

      expect(response.body.conversationId).toBe(conversationId);
    });

    it('should return 400 for empty message', async () => {
      await request(app.getHttpServer())
        .post('/api/conversations/message')
        .set('Cookie', authCookies)
        .send({
          message: '',
        })
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/conversations/message')
        .send({
          message: 'Hello',
        })
        .expect(401);
    });
  });

  describe('POST /api/conversations/ad-hoc', () => {
    it('should create ad-hoc conversation with default mode', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/conversations/ad-hoc')
        .set('Cookie', authCookies)
        .send({})
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('type', ConversationType.AD_HOC);
      expect(response.body).toHaveProperty('mode', ConversationMode.COMPANION);
    });

    it('should create ad-hoc conversation with specified mode', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/conversations/ad-hoc')
        .set('Cookie', authCookies)
        .send({
          mode: ConversationMode.INFO,
        })
        .expect(201);

      expect(response.body).toHaveProperty('type', ConversationType.AD_HOC);
      expect(response.body).toHaveProperty('mode', ConversationMode.INFO);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).post('/api/conversations/ad-hoc').send({}).expect(401);
    });
  });

  describe('GET /api/conversations/:id', () => {
    it('should get conversation by id', async () => {
      // Create a conversation first
      const createResponse = await request(app.getHttpServer())
        .get('/api/conversations/daily')
        .set('Cookie', authCookies)
        .expect(200);

      const conversationId = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .get(`/api/conversations/${conversationId}`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body).toHaveProperty('id', conversationId);
      expect(response.body).toHaveProperty('messages');
    });

    it('should return 404 for non-existent conversation', async () => {
      await request(app.getHttpServer())
        .get('/api/conversations/non-existent-id')
        .set('Cookie', authCookies)
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).get('/api/conversations/some-id').expect(401);
    });
  });

  describe('GET /api/conversations', () => {
    it('should get all user conversations', async () => {
      // Create some conversations first
      await request(app.getHttpServer())
        .get('/api/conversations/daily')
        .set('Cookie', authCookies)
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/conversations/ad-hoc')
        .set('Cookie', authCookies)
        .send({})
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/conversations')
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);
      response.body.items.forEach((conv: { id: string; type: string; mode: string }) => {
        expect(conv).toHaveProperty('id');
        expect(conv).toHaveProperty('type');
        expect(conv).toHaveProperty('mode');
      });
    });

    it('should exclude archived conversations by default', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/conversations')
        .set('Cookie', authCookies)
        .expect(200);

      response.body.items.forEach((conv: { state: string }) => {
        expect(conv.state).not.toBe(ConversationState.ARCHIVED);
      });
    });

    it('should include archived conversations when requested', async () => {
      // First archive a conversation
      const convResponse = await request(app.getHttpServer())
        .get('/api/conversations/daily')
        .set('Cookie', authCookies)
        .expect(200);

      const conversationId = convResponse.body.id;

      await request(app.getHttpServer())
        .patch(`/api/conversations/${conversationId}/archive`)
        .set('Cookie', authCookies)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/api/conversations?includeArchived=true')
        .set('Cookie', authCookies)
        .expect(200);

      const archived = response.body.items.find((c: { id: string }) => c.id === conversationId);
      expect(archived).toBeDefined();
      expect(archived.state).toBe(ConversationState.ARCHIVED);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).get('/api/conversations').expect(401);
    });
  });

  describe('PATCH /api/conversations/:id/mode', () => {
    it('should switch conversation mode', async () => {
      const convResponse = await request(app.getHttpServer())
        .get('/api/conversations/daily')
        .set('Cookie', authCookies)
        .expect(200);

      const conversationId = convResponse.body.id;

      const response = await request(app.getHttpServer())
        .patch(`/api/conversations/${conversationId}/mode`)
        .set('Cookie', authCookies)
        .send({
          mode: ConversationMode.REFLECTION,
        })
        .expect(200);

      expect(response.body).toHaveProperty('mode', ConversationMode.REFLECTION);
    });

    it('should return 404 for non-existent conversation', async () => {
      await request(app.getHttpServer())
        .patch('/api/conversations/non-existent-id/mode')
        .set('Cookie', authCookies)
        .send({
          mode: ConversationMode.REFLECTION,
        })
        .expect(404);
    });

    it('should return 400 for invalid mode', async () => {
      const convResponse = await request(app.getHttpServer())
        .get('/api/conversations/daily')
        .set('Cookie', authCookies)
        .expect(200);

      const conversationId = convResponse.body.id;

      await request(app.getHttpServer())
        .patch(`/api/conversations/${conversationId}/mode`)
        .set('Cookie', authCookies)
        .send({
          mode: 'INVALID_MODE',
        })
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .patch('/api/conversations/some-id/mode')
        .send({
          mode: ConversationMode.REFLECTION,
        })
        .expect(401);
    });
  });

  describe('PATCH /api/conversations/:id/archive', () => {
    it('should archive conversation', async () => {
      const convResponse = await request(app.getHttpServer())
        .get('/api/conversations/daily')
        .set('Cookie', authCookies)
        .expect(200);

      const conversationId = convResponse.body.id;

      const response = await request(app.getHttpServer())
        .patch(`/api/conversations/${conversationId}/archive`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body).toHaveProperty('state', ConversationState.ARCHIVED);
    });

    it('should return 404 for non-existent conversation', async () => {
      await request(app.getHttpServer())
        .patch('/api/conversations/non-existent-id/archive')
        .set('Cookie', authCookies)
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).patch('/api/conversations/some-id/archive').expect(401);
    });
  });

  describe('Conversation State Transitions', () => {
    it('should transition from CREATED to ACTIVE when first message is sent', async () => {
      // Fresh ad-hoc conversation stays CREATED until the first user message (daily may already be ACTIVE).
      const convResponse = await request(app.getHttpServer())
        .post('/api/conversations/ad-hoc')
        .set('Cookie', authCookies)
        .send({})
        .expect(201);

      const conversationId = convResponse.body.id;
      expect(convResponse.body.state).toBe(ConversationState.CREATED);

      await request(app.getHttpServer())
        .post('/api/conversations/message')
        .set('Cookie', authCookies)
        .send({
          message: 'First message',
          conversationId,
        })
        .expect(201);

      const updatedResponse = await request(app.getHttpServer())
        .get(`/api/conversations/${conversationId}`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(updatedResponse.body.state).toBe(ConversationState.ACTIVE);
    });
  });

  describe('Daily Conversation Logic', () => {
    it('should return same conversation for same day', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/api/conversations/daily')
        .set('Cookie', authCookies)
        .expect(200);

      const conversationId1 = response1.body.id;

      const response2 = await request(app.getHttpServer())
        .get('/api/conversations/daily')
        .set('Cookie', authCookies)
        .expect(200);

      const conversationId2 = response2.body.id;

      expect(conversationId1).toBe(conversationId2);
    });
  });
});
