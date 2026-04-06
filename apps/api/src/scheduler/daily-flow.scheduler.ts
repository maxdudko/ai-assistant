import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { PatternDetectionService } from '../memory/pattern-detection.service';
import { DailyEngineService } from '../daily/daily-engine.service';
import { getUserLocalDateInfo } from '../daily/daily-timezone.util';

@Injectable()
export class DailyFlowScheduler {
  private readonly logger = new Logger(DailyFlowScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patternDetection: PatternDetectionService,
    private readonly dailyEngine: DailyEngineService,
  ) {}

  @Cron('0 * * * *', { name: 'daily-time-trigger', timeZone: 'UTC' })
  async handleHourlyDailyFlow(): Promise<void> {
    this.logger.log('Running hourly Daily Flow checks');
    await this.runTimeTriggers('all');
  }

  @Cron('0 7 * * *', { name: 'morning-briefing', timeZone: 'UTC' })
  async handleMorningBriefings(): Promise<void> {
    this.logger.log('Running morning fallback trigger');
    await this.runMorningBriefings();
  }

  @Cron('0 20 * * *', { name: 'evening-reflection', timeZone: 'UTC' })
  async handleEveningReflections(): Promise<void> {
    this.logger.log('Running evening fallback trigger');
    await this.runEveningReflections();
  }

  @Cron('30 0 * * *', { name: 'pattern-detection', timeZone: 'UTC' })
  async handlePatternDetection(): Promise<void> {
    this.logger.log('Running pattern detection scheduler');
    await this.runPatternDetection();
  }

  async runMorningBriefings(): Promise<{ delivered: number; skipped: number; processed: number }> {
    return this.runTimeTriggers('morning');
  }

  async runEveningReflections(): Promise<{
    delivered: number;
    skipped: number;
    processed: number;
  }> {
    return this.runTimeTriggers('evening');
  }

  async runTimeTriggers(
    window: 'all' | 'morning' | 'evening' = 'all',
  ): Promise<{ delivered: number; skipped: number; processed: number }> {
    const profiles = await this.prisma.userProfile.findMany({
      where: {
        onboardingCompleted: true,
      },
      select: {
        userId: true,
        timezone: true,
        dayPlanningTime: true,
        reflectionTime: true,
      },
    });

    let delivered = 0;
    let skipped = 0;
    const now = new Date();

    for (const profile of profiles) {
      try {
        if (!this.matchesWindow(window, profile, now)) {
          skipped += 1;
          continue;
        }

        const primary = await this.dailyEngine.handleEvent(
          profile.userId,
          { type: 'TIME_TRIGGER' },
          now,
        );
        const inactivity =
          window === 'all'
            ? await this.dailyEngine.handleEvent(profile.userId, { type: 'INACTIVITY' }, now)
            : { actions: 0 };

        if (primary.actions + inactivity.actions > 0) {
          delivered += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        skipped += 1;
        this.logger.error(`Daily trigger failed for user ${profile.userId}`, error);
      }
    }

    this.logger.log(
      `Daily trigger window=${window}: ${delivered} delivered, ${skipped} skipped, ${profiles.length} processed`,
    );
    return { delivered, skipped, processed: profiles.length };
  }

  async runPatternDetection(): Promise<{
    processed: number;
    generated: number;
    failed: number;
    decayed: number;
  }> {
    const patternResult = await this.patternDetection.runDailyForAllUsers();
    const decayed = await this.patternDetection.decayStaleMemories();
    this.logger.log(
      `Pattern detection: ${patternResult.processed} processed, ${patternResult.generated} generated, ${patternResult.failed} failed, ${decayed} decayed`,
    );
    return {
      ...patternResult,
      decayed,
    };
  }

  private matchesWindow(
    window: 'all' | 'morning' | 'evening',
    profile: {
      timezone: string | null;
      dayPlanningTime: string | null;
      reflectionTime: string | null;
    },
    now: Date,
  ): boolean {
    if (window === 'all') {
      return true;
    }

    const local = getUserLocalDateInfo(now, profile.timezone);
    if (window === 'morning') {
      const inWindow = local.hour >= 6 && local.hour <= 11;
      return inWindow && this.matchesPreference(profile.dayPlanningTime, 'morning');
    }

    const inWindow = local.hour >= 19 && local.hour <= 23;
    return inWindow && this.matchesPreference(profile.reflectionTime, 'evening');
  }

  private matchesPreference(preference: string | null, target: 'morning' | 'evening'): boolean {
    if (!preference || preference === 'anytime') {
      return true;
    }
    return preference === target;
  }
}
