import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConversationMode, DayState, MessageRole, TaskStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { DaysService } from '../days/days.service';
import { PatternDetectionService } from '../memory/pattern-detection.service';
import { ConversationState, ConversationType } from '../prisma/types';

const REFLECTION_QUESTIONS = [
  'What was the most meaningful thing you did today?',
  'What would you do differently if you could redo today?',
  'What small win deserves acknowledgment today?',
  'What is one thing you learned about yourself today?',
  'What drained your energy today, and what gave it back?',
  'What did you start but not finish — and is that okay?',
  'Where did you feel most focused today?',
];

@Injectable()
export class DailyFlowScheduler {
  private readonly logger = new Logger(DailyFlowScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly daysService: DaysService,
    private readonly patternDetection: PatternDetectionService,
  ) {}

  @Cron('0 7 * * *', { name: 'morning-briefing', timeZone: 'UTC' })
  async handleMorningBriefings(): Promise<void> {
    this.logger.log('Running morning briefing scheduler');
    await this.runMorningBriefings();
  }

  @Cron('0 20 * * *', { name: 'evening-reflection', timeZone: 'UTC' })
  async handleEveningReflections(): Promise<void> {
    this.logger.log('Running evening reflection scheduler');
    await this.runEveningReflections();
  }

  @Cron('30 0 * * *', { name: 'pattern-detection', timeZone: 'UTC' })
  async handlePatternDetection(): Promise<void> {
    this.logger.log('Running pattern detection scheduler');
    await this.runPatternDetection();
  }

  async runMorningBriefings(): Promise<{ delivered: number; skipped: number }> {
    const profiles = await this.prisma.userProfile.findMany({
      where: {
        onboardingCompleted: true,
        dayPlanningTime: { in: ['morning', 'anytime'] },
      },
      select: { userId: true, displayName: true },
    });

    let delivered = 0;
    let skipped = 0;

    for (const profile of profiles) {
      try {
        const sent = await this.deliverMorningBriefing(profile.userId, profile.displayName);
        if (sent) delivered++;
        else skipped++;
      } catch (err) {
        this.logger.error(`Morning briefing failed for user ${profile.userId}`, err);
        skipped++;
      }
    }

    this.logger.log(`Morning briefings: ${delivered} delivered, ${skipped} skipped`);
    return { delivered, skipped };
  }

  async runEveningReflections(): Promise<{ delivered: number; skipped: number }> {
    const profiles = await this.prisma.userProfile.findMany({
      where: {
        onboardingCompleted: true,
        reflectionTime: { in: ['evening', 'anytime'] },
      },
      select: { userId: true, displayName: true },
    });

    let delivered = 0;
    let skipped = 0;

    for (const profile of profiles) {
      try {
        const sent = await this.deliverEveningReflection(profile.userId, profile.displayName);
        if (sent) delivered++;
        else skipped++;
      } catch (err) {
        this.logger.error(`Evening reflection failed for user ${profile.userId}`, err);
        skipped++;
      }
    }

    this.logger.log(`Evening reflections: ${delivered} delivered, ${skipped} skipped`);
    return { delivered, skipped };
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

  private async deliverMorningBriefing(userId: string, displayName: string): Promise<boolean> {
    const today = this.normalizeToday();

    const day = await this.prisma.day.findUnique({
      where: { userId_date: { userId, date: today } },
      select: { morningBriefingSentAt: true },
    });

    if (day?.morningBriefingSentAt) {
      return false;
    }

    const briefing = await this.daysService.getMorningBriefing(userId);
    const content = this.formatMorningBriefing(displayName, briefing);

    const conversationId = await this.getOrCreateDailyConversation(userId);

    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          role: MessageRole.ASSISTANT,
          content,
          mode: ConversationMode.MANAGER,
        },
      }),
      this.prisma.day.upsert({
        where: { userId_date: { userId, date: today } },
        update: { morningBriefingSentAt: new Date() },
        create: {
          userId,
          date: today,
          state: DayState.START,
          morningBriefingSentAt: new Date(),
        },
      }),
    ]);

    return true;
  }

  private async deliverEveningReflection(userId: string, displayName: string): Promise<boolean> {
    const today = this.normalizeToday();

    const day = await this.prisma.day.findUnique({
      where: { userId_date: { userId, date: today } },
      include: {
        tasks: { select: { id: true, name: true, status: true, priority: true } },
      },
    });

    if (day?.eveningReflectionSentAt) {
      return false;
    }

    const tasks = day?.tasks ?? [];
    const content = this.formatEveningReflection(displayName, tasks);

    const conversationId = await this.getOrCreateDailyConversation(userId);

    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          role: MessageRole.ASSISTANT,
          content,
          mode: ConversationMode.REFLECTION,
        },
      }),
      this.prisma.day.upsert({
        where: { userId_date: { userId, date: today } },
        update: { eveningReflectionSentAt: new Date() },
        create: {
          userId,
          date: today,
          state: DayState.START,
          eveningReflectionSentAt: new Date(),
        },
      }),
    ]);

    return true;
  }

  private formatMorningBriefing(
    displayName: string,
    briefing: Awaited<ReturnType<DaysService['getMorningBriefing']>>,
  ): string {
    const name = displayName || 'there';
    const allTasks = briefing.tasks ?? [];
    const pending = allTasks.filter(t => t.status !== TaskStatus.DONE);
    const priorities = briefing.priorities ?? [];

    const lines: string[] = [`Good morning, ${name}!`];

    if (pending.length === 0) {
      lines.push(`Your day is clear — no tasks pending. What would you like to focus on today?`);
    } else {
      lines.push(
        `You have **${pending.length} task${pending.length !== 1 ? 's' : ''}** pending today.`,
      );

      if (priorities.length > 0) {
        lines.push('');
        lines.push('**Top priorities:**');
        for (const t of priorities) {
          let item = `• ${t.name}`;
          if (t.priority === 'HIGH') item += ' 🔴';
          if (t.deadline) {
            item += ` _(due ${new Date(t.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})_`;
          }
          lines.push(item);
        }
      }

      lines.push('');
      lines.push('What would you like to tackle first?');
    }

    return lines.join('\n');
  }

  private formatEveningReflection(
    displayName: string,
    tasks: Array<{ name: string; status: TaskStatus; priority: string }>,
  ): string {
    const name = displayName || 'there';
    const done = tasks.filter(t => t.status === TaskStatus.DONE);
    const pending = tasks.filter(t => t.status !== TaskStatus.DONE);

    const dayOfWeek = new Date().getDay();
    const question = REFLECTION_QUESTIONS[dayOfWeek % REFLECTION_QUESTIONS.length];

    const lines: string[] = [`Good evening, ${name}.`, ''];

    if (done.length > 0) {
      lines.push('**Completed today:**');
      for (const t of done) lines.push(`✅ ${t.name}`);
      lines.push('');
    }

    if (pending.length > 0) {
      lines.push('**Still in progress:**');
      for (const t of pending) lines.push(`⏳ ${t.name}`);
      lines.push('');
    }

    if (done.length === 0 && pending.length === 0) {
      lines.push(`No tasks tracked today — sometimes that's exactly what's needed.`, '');
    }

    lines.push(`_${question}_`);

    return lines.join('\n');
  }

  private async getOrCreateDailyConversation(userId: string): Promise<string> {
    const today = this.normalizeToday();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const existing = await this.prisma.conversation.findFirst({
      where: {
        userId,
        type: ConversationType.DAILY,
        date: { gte: today, lt: tomorrow },
        state: { in: [ConversationState.CREATED, ConversationState.ACTIVE] },
      },
      select: { id: true },
    });

    if (existing) return existing.id;

    let day = await this.prisma.day.findUnique({
      where: { userId_date: { userId, date: today } },
      select: { id: true },
    });

    if (!day) {
      day = await this.prisma.day.create({
        data: { userId, date: today, state: DayState.START },
        select: { id: true },
      });
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        userId,
        dayId: day.id,
        type: ConversationType.DAILY,
        mode: ConversationMode.MANAGER,
        state: ConversationState.CREATED,
        date: today,
      },
      select: { id: true },
    });

    return conversation.id;
  }

  private normalizeToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
}
