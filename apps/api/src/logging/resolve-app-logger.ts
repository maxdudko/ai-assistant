import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

import type { LoggerService } from '@nestjs/common';
import * as winston from 'winston';

function formatMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  if (message instanceof Error) {
    return message.message;
  }
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

/**
 * Winston-backed logger compatible with NestJS {@link LoggerService}.
 */
class WinstonNestLogger implements LoggerService {
  constructor(private readonly logger: winston.Logger) {}

  log(message: unknown, context?: string): void {
    this.logger.info(formatMessage(message), { context: context || undefined });
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.logger.error(formatMessage(message), {
      context: context || undefined,
      ...(stack ? { stack } : {}),
    });
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(formatMessage(message), { context: context || undefined });
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(formatMessage(message), { context: context || undefined });
  }

  verbose(message: unknown, context?: string): void {
    this.logger.verbose(formatMessage(message), { context: context || undefined });
  }

  fatal(message: unknown, context?: string): void {
    this.logger.error(formatMessage(message), { context: context || undefined, fatal: true });
  }
}

function resolveLogFilePath(): string | null {
  const pmaFile = process.env.PMA_API_LOG_FILE?.trim();
  if (pmaFile) {
    return isAbsolute(pmaFile) ? pmaFile : resolve(process.cwd(), pmaFile);
  }
  const explicit = process.env.LOG_FILE?.trim();
  if (explicit) {
    return isAbsolute(explicit) ? explicit : resolve(process.cwd(), explicit);
  }
  const pmaFlag = process.env.PMA_API_LOG_TO_FILE?.trim().toLowerCase();
  if (pmaFlag === '1' || pmaFlag === 'true' || pmaFlag === 'yes') {
    const dir = process.env.PMA_API_LOG_FILE_DIR?.trim() || 'logs';
    const name = process.env.PMA_API_LOG_FILE_NAME?.trim() || 'api.log';
    return resolve(process.cwd(), dir, name);
  }
  const flag = process.env.LOG_TO_FILE?.trim().toLowerCase();
  if (flag === '1' || flag === 'true' || flag === 'yes') {
    const dir = process.env.LOG_FILE_DIR?.trim() || 'logs';
    const name = process.env.LOG_FILE_NAME?.trim() || 'api.log';
    return resolve(process.cwd(), dir, name);
  }
  return null;
}

/**
 * Returns a Nest logger that writes to console and a log file, or `undefined` to keep Nest defaults.
 *
 * Prefer **`PMA_API_LOG_FILE`** (full path to the log file) in Docker so generic names like
 * `LOG_FILE_DIR` are not set in the environment — some tooling incorrectly treats those as a `cd` target.
 *
 * Also supported:
 * - `PMA_API_LOG_TO_FILE=true` with optional `PMA_API_LOG_FILE_DIR` / `PMA_API_LOG_FILE_NAME`
 * - `LOG_FILE=...`, or `LOG_TO_FILE=true` with `LOG_FILE_DIR` / `LOG_FILE_NAME` (legacy)
 *
 * Disable in tests (`NODE_ENV=test`) or with `LOG_TO_FILE=false` / `PMA_API_LOG_TO_FILE=false`
 * when no explicit `LOG_FILE` / `PMA_API_LOG_FILE` is set.
 */
export function resolveAppLogger(): LoggerService | undefined {
  if (process.env.NODE_ENV === 'test') {
    return undefined;
  }
  const hasExplicitFile = Boolean(
    process.env.LOG_FILE?.trim() || process.env.PMA_API_LOG_FILE?.trim(),
  );
  if (!hasExplicitFile) {
    const toggle = process.env.LOG_TO_FILE?.trim().toLowerCase();
    const pmaToggle = process.env.PMA_API_LOG_TO_FILE?.trim().toLowerCase();
    if (
      toggle === '0' ||
      toggle === 'false' ||
      toggle === 'no' ||
      pmaToggle === '0' ||
      pmaToggle === 'false' ||
      pmaToggle === 'no'
    ) {
      return undefined;
    }
  }

  const filePath = resolveLogFilePath();
  if (!filePath) {
    return undefined;
  }

  const logDir = dirname(filePath);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  const level = process.env.LOG_LEVEL?.trim().toLowerCase() ?? 'info';

  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => {
      const ctx = info.context ? ` [${String(info.context)}]` : '';
      const stack = typeof info.stack === 'string' ? `\n${info.stack}` : '';
      return `${String(info.timestamp)} ${info.level}${ctx} ${String(info.message)}${stack}`;
    }),
  );

  const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  const logger = winston.createLogger({
    level,
    transports: [
      new winston.transports.Console({ format: consoleFormat }),
      new winston.transports.File({
        filename: filePath,
        format: fileFormat,
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
      }),
    ],
  });

  return new WinstonNestLogger(logger);
}
