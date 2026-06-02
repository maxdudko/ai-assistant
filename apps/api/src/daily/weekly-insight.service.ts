import { Injectable, Logger } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { MemoryIngestionService } from '../memory/memory-ingestion.service';
import { MemoryLayer, MemoryType } from '../memory/dto/memory-candidate.dto';

import { sanitizeTimeZone } from './daily-timezone.util';

const ISO_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface WeeklyInsightSummary {
  id: string;
  isoYear: number;
  isoWeek: number;
  weekStart: string;
  weekEnd: string;
  score: number;
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  reschedules: number;
  topPatterns: string[];
  focusSuggestion: string | null;
  narrative: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class WeeklyInsightService {
  private readonly logger = new Logger(WeeklyInsightService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly memoryIngestion: MemoryIngestionService,
  ) {}

  /**
   * Generate (or refresh) the weekly insight for the ISO week containing `referenceDate`.
   * Skips silently when the user has no activity in the period.
   */
  async generateForUser(
    userId: string,
    options: { referenceDate?: Date; source?: 'AUTOMATIC' | 'MANUAL' } = {},
  ): Promise<WeeklyInsightSummary | null> {
    const reference = options.referenceDate ?? new Date();
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true, displayName: true },
    });
    const timezone = sanitizeTimeZone(profile?.timezone ?? 'UTC');

    const { weekStart, weekEnd, isoYear, isoWeek } = computeIsoWeekBounds(reference, timezone);

    const [days, recentReflections, rescheduleLogs, activeGoals, patternMemories] =
      await Promise.all([
        this.prisma.day.findMany({
          where: {
            userId,
            date: { gte: weekStart, lte: weekEnd },
          },
          include: {
            tasks: {
              select: {
                id: true,
                status: true,
                priority: true,
                createdAt: true,
                updatedAt: true,
                goalId: true,
              },
            },
            insight: { select: { score: true, summary: true } },
          },
          orderBy: { date: 'asc' },
        }),
        this.prisma.memory.findMany({
          where: {
            userId,
            layer: 'EPISODIC',
            createdAt: { gte: weekStart, lte: weekEnd },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { content: true },
        }),
        this.prisma.actionExecutionLog.count({
          where: {
            userId,
            type: 'RESCHEDULE_TASK',
            status: 'EXECUTED',
            createdAt: { gte: weekStart, lte: weekEnd },
          },
        }),
        this.prisma.goal.findMany({
          where: { userId, isAchieved: false },
          select: {
            id: true,
            name: true,
            tasks: { select: { status: true } },
          },
          take: 5,
        }),
        this.prisma.memory.findMany({
          where: {
            userId,
            layer: 'PATTERN',
            updatedAt: { gte: new Date(reference.getTime() - 30 * 24 * 60 * 60 * 1000) },
          },
          orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
          take: 5,
          select: { tags: true, content: true },
        }),
      ]);

    const allTasks = days.flatMap(day => day.tasks);
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(task => task.status === TaskStatus.DONE).length;

    if (totalTasks === 0 && rescheduleLogs === 0 && days.length === 0) {
      this.logger.debug(`Skipping weekly insight for user ${userId} — no activity this week.`);
      return null;
    }

    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
    const completionsByBucket = this.bucketCompletions(allTasks);
    const dailyScores = days.map(day => day.insight?.score ?? this.estimateDayScore(day.tasks));
    const score = this.computeWeekScore(dailyScores, completionRate, totalTasks);
    const observedPatterns = this.flattenPatternTags(patternMemories);

    const goalProgress = activeGoals.map(goal => {
      const total = goal.tasks.length;
      const done = goal.tasks.filter(task => task.status === TaskStatus.DONE).length;
      return {
        name: goal.name,
        progressPct: total === 0 ? 0 : Math.round((done / total) * 100),
      };
    });

    const llmInput = {
      isoWeek,
      isoYear,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      completionRate,
      totalTasks,
      completedTasks,
      reschedules: rescheduleLogs,
      activePatterns: observedPatterns,
      completionsByBucket,
      recentReflections: recentReflections.map(memory => memory.content).slice(0, 5),
      activeGoals: goalProgress,
    };

    let narrative: string;
    let focusSuggestion: string | null;
    let topPatterns: string[];

    const llmResponse = await this.ai.generateWeeklyNarrative(llmInput).catch(error => {
      this.logger.warn(
        `Weekly narrative generation failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    });

    if (llmResponse) {
      narrative = llmResponse.narrative;
      focusSuggestion = llmResponse.focusSuggestion || null;
      topPatterns =
        llmResponse.topPatterns.length > 0 ? llmResponse.topPatterns : observedPatterns.slice(0, 3);
    } else {
      const fallback = this.buildFallbackNarrative({
        completedTasks,
        totalTasks,
        completionRate,
        reschedules: rescheduleLogs,
        observedPatterns,
        displayName: profile?.displayName ?? 'You',
      });
      narrative = fallback.narrative;
      focusSuggestion = fallback.focusSuggestion;
      topPatterns = observedPatterns.slice(0, 3);
    }

    const stored = await this.prisma.weeklyInsight.upsert({
      where: {
        userId_isoYear_isoWeek: { userId, isoYear, isoWeek },
      },
      create: {
        userId,
        weekStart,
        weekEnd,
        isoYear,
        isoWeek,
        score,
        completionRate,
        totalTasks,
        completedTasks,
        reschedules: rescheduleLogs,
        topPatterns,
        focusSuggestion,
        narrative,
        source: options.source ?? 'AUTOMATIC',
      },
      update: {
        weekStart,
        weekEnd,
        score,
        completionRate,
        totalTasks,
        completedTasks,
        reschedules: rescheduleLogs,
        topPatterns,
        focusSuggestion,
        narrative,
        source: options.source ?? 'AUTOMATIC',
      },
    });

    // Persist a compact reflection memory so the insight is available to RAG.
    void this.memoryIngestion
      .ingest(
        userId,
        [
          {
            content: this.buildMemoryContent({ isoYear, isoWeek, narrative, focusSuggestion }),
            type: MemoryType.REFLECTION,
            layer: MemoryLayer.EPISODIC,
            importance: Math.max(6, Math.min(9, score)),
            confidence: 0.75,
            tags: this.buildMemoryTags(topPatterns),
          },
        ],
        'REFLECTION',
        {},
      )
      .catch(error => {
        this.logger.warn(
          `Failed to ingest weekly reflection memory for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });

    return this.toSummary(stored);
  }

  async getLatestForUser(userId: string): Promise<WeeklyInsightSummary | null> {
    const insight = await this.prisma.weeklyInsight.findFirst({
      where: { userId },
      orderBy: { weekStart: 'desc' },
    });
    return insight ? this.toSummary(insight) : null;
  }

  async listForUser(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ items: WeeklyInsightSummary[]; hasMore: boolean; nextOffset: number | null }> {
    const limit = Math.max(1, Math.min(50, options.limit ?? 12));
    const offset = Math.max(0, options.offset ?? 0);
    const rows = await this.prisma.weeklyInsight.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      skip: offset,
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(row => this.toSummary(row));
    return {
      items,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    };
  }

  async runForAllUsers(options: { referenceDate?: Date } = {}): Promise<{
    processed: number;
    generated: number;
    skipped: number;
    failed: number;
  }> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    let generated = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const result = await this.generateForUser(user.id, {
          referenceDate: options.referenceDate,
        });
        if (result) {
          generated += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        failed += 1;
        this.logger.error(
          `Weekly insight failed for user ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { processed: users.length, generated, skipped, failed };
  }

  private bucketCompletions(
    tasks: Array<{ status: TaskStatus; updatedAt: Date }>,
  ): Record<string, number> {
    const buckets = { morning: 0, afternoon: 0, evening: 0, lateNight: 0 };
    for (const task of tasks) {
      if (task.status !== TaskStatus.DONE) continue;
      const hour = task.updatedAt.getHours();
      if (hour >= 6 && hour < 12) buckets.morning += 1;
      else if (hour >= 12 && hour < 18) buckets.afternoon += 1;
      else if (hour >= 18 && hour < 22) buckets.evening += 1;
      else buckets.lateNight += 1;
    }
    return buckets;
  }

  private estimateDayScore(tasks: Array<{ status: TaskStatus }>): number {
    if (tasks.length === 0) return 4;
    const completed = tasks.filter(task => task.status === TaskStatus.DONE).length;
    const rate = completed / tasks.length;
    return Math.max(1, Math.min(10, Math.round(rate * 10)));
  }

  private computeWeekScore(
    dailyScores: number[],
    completionRate: number,
    totalTasks: number,
  ): number {
    if (dailyScores.length === 0 && totalTasks === 0) return 5;
    const avg =
      dailyScores.length > 0
        ? dailyScores.reduce((sum, score) => sum + score, 0) / dailyScores.length
        : completionRate * 10;
    return Math.max(1, Math.min(10, Math.round(avg)));
  }

  private flattenPatternTags(memories: Array<{ tags: string[] }>): string[] {
    const counts = new Map<string, number>();
    for (const memory of memories) {
      for (const tag of memory.tags ?? []) {
        if (tag === 'pattern') continue;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 5);
  }

  private buildFallbackNarrative(input: {
    completedTasks: number;
    totalTasks: number;
    completionRate: number;
    reschedules: number;
    observedPatterns: string[];
    displayName: string;
  }): { narrative: string; focusSuggestion: string } {
    const lines: string[] = [];
    lines.push(
      `${input.displayName}, this week you completed ${input.completedTasks} of ${input.totalTasks} planned tasks (${Math.round(input.completionRate * 100)}%).`,
    );
    if (input.reschedules > 0) {
      lines.push(
        `You moved ${input.reschedules} task${input.reschedules === 1 ? '' : 's'} forward — worth noticing without judgement.`,
      );
    }
    if (input.observedPatterns.length > 0) {
      lines.push(`Recurring signals: ${input.observedPatterns.slice(0, 3).join(', ')}.`);
    }
    if (input.totalTasks === 0) {
      lines.push('A quieter week. Tomorrow can start with one clear priority.');
    }

    const focusSuggestion =
      input.completionRate >= 0.7
        ? 'Keep next week roughly the same shape — the cadence is working.'
        : input.totalTasks > 0
          ? 'For next week, try planning fewer tasks and protect the first one.'
          : 'Pick one meaningful task to start the week.';

    return { narrative: lines.join(' '), focusSuggestion };
  }

  private buildMemoryContent(input: {
    isoYear: number;
    isoWeek: number;
    narrative: string;
    focusSuggestion: string | null;
  }): string {
    const compact = input.narrative.replace(/\s+/g, ' ').trim();
    const trimmed = compact.length > 320 ? `${compact.slice(0, 317)}...` : compact;
    const focus = input.focusSuggestion ? ` Focus: ${input.focusSuggestion}` : '';
    return `Weekly reflection (W${input.isoWeek}/${input.isoYear}): ${trimmed}${focus}`.slice(
      0,
      500,
    );
  }

  private buildMemoryTags(patterns: string[]): string[] {
    const tags = ['reflection', 'weekly'];
    for (const pattern of patterns) {
      if (/^[a-z0-9-]{2,24}$/.test(pattern)) {
        tags.push(pattern);
      }
    }
    return Array.from(new Set(tags)).slice(0, 8);
  }

  private toSummary(row: {
    id: string;
    isoYear: number;
    isoWeek: number;
    weekStart: Date;
    weekEnd: Date;
    score: number;
    completionRate: number;
    totalTasks: number;
    completedTasks: number;
    reschedules: number;
    topPatterns: string[];
    focusSuggestion: string | null;
    narrative: string;
    source: string;
    createdAt: Date;
    updatedAt: Date;
  }): WeeklyInsightSummary {
    return {
      id: row.id,
      isoYear: row.isoYear,
      isoWeek: row.isoWeek,
      weekStart: row.weekStart.toISOString(),
      weekEnd: row.weekEnd.toISOString(),
      score: row.score,
      completionRate: row.completionRate,
      totalTasks: row.totalTasks,
      completedTasks: row.completedTasks,
      reschedules: row.reschedules,
      topPatterns: row.topPatterns ?? [],
      focusSuggestion: row.focusSuggestion,
      narrative: row.narrative,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

/**
 * Compute ISO week bounds for the week containing `reference`, in the given timezone.
 * weekStart  = Monday 00:00 (UTC instant matching local Monday 00:00)
 * weekEnd    = Sunday 23:59:59.999 (UTC instant matching local Sunday 23:59:59.999)
 *
 * The return values are stored UTC instants — Postgres comparisons remain stable
 * because all task timestamps are stored as UTC.
 */
export function computeIsoWeekBounds(
  reference: Date,
  _timezone: string,
): { weekStart: Date; weekEnd: Date; isoYear: number; isoWeek: number } {
  // Use UTC-anchored ISO week math; downstream queries compare against UTC dates,
  // which is acceptable for an IM-grade weekly summary. Per-timezone precision can
  // be added later by shifting the reference instant.
  const referenceUtc = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()),
  );
  // ISO weeks: Monday is day 1, Sunday is day 7.
  const dayOfWeek = (referenceUtc.getUTCDay() + 6) % 7; // 0..6, Monday=0
  const weekStart = new Date(referenceUtc.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + ISO_WEEK_MS - 1);

  // ISO 8601 week-numbering year/week (Thursday rule).
  const thursday = new Date(weekStart.getTime() + 3 * 24 * 60 * 60 * 1000);
  const isoYear = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const yearStartDow = (yearStart.getUTCDay() + 6) % 7;
  const yearStartIsoMonday = new Date(yearStart.getTime() - yearStartDow * 24 * 60 * 60 * 1000);
  const isoWeek =
    Math.floor((thursday.getTime() - yearStartIsoMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

  return { weekStart, weekEnd, isoYear, isoWeek };
}
