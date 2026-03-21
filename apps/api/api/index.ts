/**
 * Vercel serverless entry point for the NestJS application.
 *
 * Why `require()` instead of `import`:
 *   @vercel/node uses esbuild to compile this file.  esbuild does NOT emit
 *   `emitDecoratorMetadata`, which NestJS relies on heavily.  By loading the
 *   pre-compiled `dist/app.module` at runtime (after `nest build` has run with
 *   tsc, which DOES emit decorator metadata), we bypass esbuild's limitation.
 *
 * Cold-start caching:
 *   The Express adapter instance is cached in the module-level variable so
 *   subsequent invocations of the same warm container skip bootstrapping.
 */

import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

type ExpressHandler = (req: IncomingMessage, res: ServerResponse) => void;

let cachedHandler: ExpressHandler | null = null;

async function bootstrap(): Promise<ExpressHandler> {
  if (cachedHandler) return cachedHandler;

  const { AppModule } = require('../dist/app.module') as {
    AppModule: new () => unknown;
  };

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });

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
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  await app.init();

  cachedHandler = app.getHttpAdapter().getInstance() as ExpressHandler;

  return cachedHandler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const server = await bootstrap();
  server(req, res);
}
