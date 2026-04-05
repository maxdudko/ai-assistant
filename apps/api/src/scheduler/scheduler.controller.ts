import { Controller, HttpCode, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { DailyFlowScheduler } from './daily-flow.scheduler';

/**
 * HTTP endpoints for externally-triggered scheduled jobs.
 *
 * In production (Vercel), cron jobs cannot use long-running NestJS @Cron()
 * decorators. Instead, Vercel Cron Jobs make HTTP POST requests to these
 * endpoints on schedule. Requests are authenticated via the CRON_SECRET
 * header to prevent unauthorized triggers.
 *
 * For local development, the @Cron() decorators in DailyFlowScheduler fire
 * automatically — these endpoints are only needed in production.
 */
@Controller('scheduler')
export class SchedulerController {
  private readonly logger = new Logger(SchedulerController.name);

  constructor(private readonly scheduler: DailyFlowScheduler) {}

  @Post('morning-briefing')
  @HttpCode(200)
  async triggerMorningBriefing(@Req() req: Request) {
    this.validateCronSecret(req);
    this.logger.log('Morning briefing triggered via HTTP');
    return this.scheduler.runMorningBriefings();
  }

  @Post('evening-reflection')
  @HttpCode(200)
  async triggerEveningReflection(@Req() req: Request) {
    this.validateCronSecret(req);
    this.logger.log('Evening reflection triggered via HTTP');
    return this.scheduler.runEveningReflections();
  }

  @Post('pattern-detection')
  @HttpCode(200)
  async triggerPatternDetection(@Req() req: Request) {
    this.validateCronSecret(req);
    this.logger.log('Pattern detection triggered via HTTP');
    return this.scheduler.runPatternDetection();
  }

  private validateCronSecret(req: Request): void {
    const secret = process.env.CRON_SECRET;
    if (!secret) return; // Skip validation if not configured (local dev)

    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${secret}`) {
      throw new UnauthorizedException('Invalid cron secret');
    }
  }
}
