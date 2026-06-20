import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { PatternDetectionService } from '../memory/pattern-detection.service';
import { DailyEngineService } from '../daily/daily-engine.service';
import { WeeklyInsightService } from '../daily/weekly-insight.service';
import { getUserLocalDateInfo } from '../daily/daily-timezone.util';

import { DailySchedulerEventResolver } from './daily-scheduler-event-resolver';

@Injectable()
export class DailyFlowScheduler {
  private readonly logger = new Logger(DailyFlowScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patternDetection: PatternDetectionService,
    private readonly dailyEngine: DailyEngineService,
    private readonly weeklyInsight: WeeklyInsightService,
    private readonly eventResolver: DailySchedulerEventResolver,
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

  // Sunday 22:00 UTC: generate the weekly insight for the just-completed ISO week.
  @Cron('0 22 * * 0', { name: 'weekly-summary', timeZone: 'UTC' })
  async handleWeeklySummary(): Promise<void> {
    this.logger.log('Running weekly summary scheduler');
    await this.runWeeklySummary();
  }

  async runWeeklySummary(referenceDate?: Date): Promise<{
    processed: number;
    generated: number;
    skipped: number;
    failed: number;
  }> {
    return this.weeklyInsight.runForAllUsers({ referenceDate });
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
        helpStyle: true,
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

        const event = this.eventResolver.resolve({
          now,
          lastActivityAt: await this.getLastActivityForToday(
            profile.userId,
            now,
            profile.timezone ?? 'UTC',
          ),
          dayPlanningTime: profile.dayPlanningTime,
          reflectionTime: profile.reflectionTime,
          helpStyle: profile.helpStyle,
        });

        const result = await this.dailyEngine.handleEvent(profile.userId, event, now);

        if (result.actions > 0) {
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

  private async getLastActivityForToday(
    userId: string,
    now: Date,
    timezone: string,
  ): Promise<Date | null> {
    const local = getUserLocalDateInfo(now, timezone);
    const day = await this.prisma.day.findUnique({
      where: {
        userId_date: {
          userId,
          date: local.dayStartUtc,
        },
      },
      select: {
        lastActivityAt: true,
      },
    });
    return day?.lastActivityAt ?? null;
  }

  private matchesPreference(preference: string | null, target: 'morning' | 'evening'): boolean {
    if (!preference || preference === 'anytime') {
      return true;
    }
    return preference === target;
  }
}
