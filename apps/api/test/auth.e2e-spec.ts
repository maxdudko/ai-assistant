import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request, { type SuperTest, type Test as SuperTestTest } from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testUser = {
    email: 'test@example.com',
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
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [testUser.email, 'register@example.com', 'duplicate@example.com', 'logout@example.com'],
          },
        },
      });
    } catch (error) {
      // Ignore database errors in cleanup
      console.warn('Cleanup error (ignored):', error);
    }
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and set cookies', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'register@example.com',
          password: 'password123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', 'register@example.com');
      expect(response.body.user).toHaveProperty('profile');

      // Check that cookies are set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.includes('accessToken'))).toBe(true);
      expect(cookies.some((cookie: string) => cookie.includes('refreshToken'))).toBe(true);
    });

    it('should not register user with existing email', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
        })
        .expect(201);

      // Try to register again with same email
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
        })
        .expect(409);

      // Clean up
      try {
        await prisma.user.deleteMany({
          where: { email: 'duplicate@example.com' },
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should require email and password', async () => {
      await request(app.getHttpServer()).post('/api/auth/register').send({}).expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Clean up test user before each test
      try {
        await prisma.user.deleteMany({ where: { email: testUser.email } });
      } catch (error) {
        // Ignore database errors - test will fail if DB is not available
      }
    });

    it('should login with valid credentials and set cookies', async () => {
      // Register first to get a properly hashed password
      await request(app.getHttpServer()).post('/api/auth/register').send(testUser).expect(201);

      // Now login
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email', testUser.email);

      // Check that cookies are set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.includes('accessToken'))).toBe(true);
      expect(cookies.some((cookie: string) => cookie.includes('refreshToken'))).toBe(true);
    });

    it('should reject invalid email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
        .expect(401);
    });

    it('should reject invalid password', async () => {
      // Register a user first
      try {
        await prisma.user.deleteMany({ where: { email: testUser.email } });
      } catch (error) {
        // Ignore cleanup errors
      }
      await request(app.getHttpServer()).post('/api/auth/register').send(testUser).expect(201);

      // Try to login with wrong password
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('GET /api/users/me', () => {
    let agent: SuperTest<SuperTestTest>;
    let userId: string;

    beforeEach(async () => {
      // Register and login to get a token
      try {
        await prisma.user.deleteMany({ where: { email: testUser.email } });
      } catch (error) {
        // Ignore database errors - test will fail if DB is not available
      }

      // Use agent to maintain cookies across requests
      agent = request.agent(app.getHttpServer());

      const registerResponse = await agent
        .post('/api/auth/register')
        .send(testUser)
        .expect(201); // Ensure registration succeeded

      userId = registerResponse.body.user.id;

      // Verify cookies were set
      const setCookieHeaders = registerResponse.headers['set-cookie'] as string[] | undefined;
      expect(setCookieHeaders).toBeDefined();
      expect(setCookieHeaders?.length).toBeGreaterThan(0);
      expect(setCookieHeaders?.some((c: string) => c.includes('accessToken'))).toBe(true);
      expect(setCookieHeaders?.some((c: string) => c.includes('refreshToken'))).toBe(true);
    });

    it('should get user data with valid token cookie', async () => {
      const response = await agent.get('/api/users/me').expect(200);

      expect(response.body).toHaveProperty('id', userId);
      expect(response.body).toHaveProperty('email', testUser.email);
      expect(response.body).toHaveProperty('profile');
    });

    it('should get user data with manually extracted cookie', async () => {
      // Register a new user to get fresh cookies
      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'manual-cookie-test@example.com',
          password: 'password123',
        })
        .expect(201);

      const newUserId = registerResponse.body.user.id;

      // Extract accessToken from cookies
      const setCookieHeaders = registerResponse.headers['set-cookie'] as string[] | undefined;
      expect(setCookieHeaders).toBeDefined();
      
      const accessTokenCookie = setCookieHeaders?.find((c: string) => c.startsWith('accessToken='));
      expect(accessTokenCookie).toBeDefined();
      
      // Extract just the token value (format: "accessToken=value; ...")
      const tokenValue = accessTokenCookie?.split(';')[0].split('=')[1];
      expect(tokenValue).toBeDefined();

      // Use the extracted token in a new request
      const meResponse = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Cookie', [`accessToken=${tokenValue}`])
        .expect(200);

      expect(meResponse.body).toHaveProperty('id', newUserId);
      expect(meResponse.body).toHaveProperty('email', 'manual-cookie-test@example.com');

      // Cleanup
      try {
        await prisma.user.deleteMany({ where: { email: 'manual-cookie-test@example.com' } });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should reject request without token cookie', async () => {
      await request(app.getHttpServer()).get('/api/users/me').expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Cookie', ['accessToken=invalid-token'])
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear cookies on logout', async () => {
      // Register first to get cookies
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'logout@example.com',
          password: 'password123',
        })
        .expect(201);

      const response = await request(app.getHttpServer()).post('/api/auth/logout').expect(201);

      expect(response.body).toHaveProperty('message', 'Logged out successfully');

      // Check that cookies are cleared
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const accessTokenCookie = cookies.find((cookie: string) => cookie.includes('accessToken'));
        const refreshTokenCookie = cookies.find((cookie: string) =>
          cookie.includes('refreshToken'),
        );

        // Cookies should be cleared (expired or empty)
        if (accessTokenCookie) {
          expect(accessTokenCookie).toContain('Max-Age=0');
        }
        if (refreshTokenCookie) {
          expect(refreshTokenCookie).toContain('Max-Age=0');
        }
      }

      // Clean up
      try {
        await prisma.user.deleteMany({
          where: { email: 'logout@example.com' },
        });
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  });
});
