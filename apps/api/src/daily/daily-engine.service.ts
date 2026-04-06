import { Injectable, Logger } from '@nestjs/common';
import { ConversationMode, DayPhase, DayState, TaskPriority, TaskStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { addUtcDays, getUserLocalDateInfo } from './daily-timezone.util';
import { DailyConversationService } from './daily-conversation.service';
import { DailyEvent, DailyEventResult } from './daily.types';
import { ExecutionMonitorService } from './execution-monitor.service';

type DailyProfile = {
  displayName: string;
  onboardingCompleted: boolean;
  dayPlanningTime: string | null;
  reflectionTime: string | null;
  timezone: string;
};

@Injectable()
export class DailyEngineService {
  private readonly logger = new Logger(DailyEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyConversation: DailyConversationService,
    private readonly executionMonitor: ExecutionMonitorService,
  ) {}

  async handleEvent(
    userId: string,
    event: DailyEvent,
    now = new Date(),
  ): Promise<DailyEventResult> {
    const profile = await this.loadProfile(userId);
    const local = getUserLocalDateInfo(now, profile.timezone);
    const day = await this.getOrCreateDay(userId, local.dayStartUtc);

    const result: DailyEventResult = {
      morningSent: false,
      planningSuggestionSent: false,
      noProgressNudgeSent: false,
      stuckTaskNudgeSent: false,
      eveningSent: false,
      actions: 0,
    };

    if (!profile.onboardingCompleted && event.type !== 'USER_ACTIVITY') {
      return result;
    }

    if (event.type === 'DAY_START') {
      result.morningSent = await this.sendAdaptiveMorningBriefing(userId, profile, day.id, now);
      if (result.morningSent) {
        result.actions += 1;
      }
      return result;
    }

    if (event.type === 'USER_ACTIVITY') {
      const wasFirstActivity = !day.lastActivityAt;
      await this.prisma.day.update({
        where: { id: day.id },
        data: {
          state: day.state === DayState.START ? DayState.ACTIVE : day.state,
          phase: day.phase === DayPhase.NOT_STARTED ? DayPhase.MORNING : day.phase,
          startedAt: day.startedAt ?? now,
          lastActivityAt: now,
        },
      });

      if (wasFirstActivity) {
        result.morningSent = await this.sendAdaptiveMorningBriefing(userId, profile, day.id, now);
        if (result.morningSent) {
          result.actions += 1;
        }
      } else if (day.phase === DayPhase.PLANNING || day.phase === DayPhase.MORNING) {
        await this.prisma.day.update({
          where: { id: day.id },
          data: { phase: DayPhase.EXECUTION },
        });
      }

      if (profile.onboardingCompleted) {
        result.planningSuggestionSent = await this.maybeSendPlanningSuggestion(
          userId,
          profile,
          day.id,
          now,
        );
        if (result.planningSuggestionSent) {
          result.actions += 1;
        }

        const monitor = await this.maybeRunExecutionMonitor(userId, day.id, local.hour, now);
        result.noProgressNudgeSent = monitor.noProgressNudgeSent;
        result.stuckTaskNudgeSent = monitor.stuckTaskNudgeSent;
        result.actions += monitor.actions;
      }

      return result;
    }

    if (event.type === 'TIME_TRIGGER') {
      if (this.shouldRunMorningFallback(profile.dayPlanningTime, local.hour)) {
        result.morningSent = await this.sendAdaptiveMorningBriefing(userId, profile, day.id, now);
      }

      if (this.shouldRunEveningReflection(profile.reflectionTime, local.hour)) {
        result.eveningSent = await this.sendDynamicEveningReflection(userId, profile, day.id, now);
      }

      result.planningSuggestionSent = await this.maybeSendPlanningSuggestion(
        userId,
        profile,
        day.id,
        now,
      );

      const monitor = await this.maybeRunExecutionMonitor(userId, day.id, local.hour, now);
      result.noProgressNudgeSent = monitor.noProgressNudgeSent;
      result.stuckTaskNudgeSent = monitor.stuckTaskNudgeSent;

      result.actions =
        Number(result.morningSent) +
        Number(result.eveningSent) +
        Number(result.planningSuggestionSent) +
        monitor.actions;
      return result;
    }

    if (event.type === 'INACTIVITY') {
      const staleForHours =
        day.lastActivityAt == null
          ? Number.POSITIVE_INFINITY
          : (now.getTime() - day.lastActivityAt.getTime()) / (60 * 60 * 1000);

      if (staleForHours >= 3) {
        const monitor = await this.maybeRunExecutionMonitor(userId, day.id, local.hour, now);
        result.noProgressNudgeSent = monitor.noProgressNudgeSent;
        result.stuckTaskNudgeSent = monitor.stuckTaskNudgeSent;
        result.actions += monitor.actions;
      }
    }

    return result;
  }

  private async loadProfile(userId: string): Promise<DailyProfile> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: {
        displayName: true,
        onboardingCompleted: true,
        dayPlanningTime: true,
        reflectionTime: true,
        timezone: true,
      },
    });

    return {
      displayName: profile?.displayName || 'there',
      onboardingCompleted: Boolean(profile?.onboardingCompleted),
      dayPlanningTime: profile?.dayPlanningTime ?? null,
      reflectionTime: profile?.reflectionTime ?? null,
      timezone: profile?.timezone ?? 'UTC',
    };
  }

  private async getOrCreateDay(userId: string, date: Date) {
    return this.prisma.day.upsert({
      where: { userId_date: { userId, date } },
      update: {},
      create: {
        userId,
        date,
        state: DayState.START,
        phase: DayPhase.NOT_STARTED,
      },
      select: {
        id: true,
        date: true,
        state: true,
        phase: true,
        startedAt: true,
        lastActivityAt: true,
      },
    });
  }

  private async sendAdaptiveMorningBriefing(
    userId: string,
    profile: DailyProfile,
    dayId: string,
    now: Date,
  ): Promise<boolean> {
    const day = await this.prisma.day.findUnique({
      where: { id: dayId },
      select: {
        id: true,
        date: true,
        morningBriefingSentAt: true,
        startedAt: true,
      },
    });

    if (!day || day.morningBriefingSentAt) {
      return false;
    }

    const [tasksToday, yesterday, pattern] = await Promise.all([
      this.prisma.task.findMany({
        where: { dayId },
        select: {
          id: true,
          name: true,
          status: true,
          priority: true,
          deadline: true,
          createdAt: true,
        },
      }),
      this.prisma.day.findUnique({
        where: { userId_date: { userId, date: addUtcDays(day.date, -1) } },
        select: {
          tasks: {
            select: {
              status: true,
            },
          },
        },
      }),
      this.prisma.memory.findFirst({
        where: { userId, layer: 'PATTERN' },
        orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
        select: { content: true },
      }),
    ]);

    const completedYesterday =
      yesterday?.tasks.filter(task => task.status === TaskStatus.DONE).length ?? 0;
    const missedYesterday =
      (yesterday?.tasks.length ?? 0) -
      (yesterday?.tasks.filter(task => task.status === TaskStatus.DONE).length ?? 0);

    const priorities = tasksToday
      .filter(task => task.status !== TaskStatus.DONE)
      .sort((a, b) => this.compareTaskPriority(a, b))
      .slice(0, 2);

    const focusLines =
      priorities.length > 0
        ? priorities.map(task => {
            const due = task.deadline ? ` (due ${task.deadline.toISOString().slice(0, 10)})` : '';
            return `- ${task.name}${due}`;
          })
        : ['- No pending tasks yet. Pick one meaningful priority.'];

    const lines: string[] = [
      `Good morning, ${profile.displayName}.`,
      '',
      'Yesterday:',
      `- Completed: ${completedYesterday} task${completedYesterday === 1 ? '' : 's'}`,
      `- Missed: ${Math.max(missedYesterday, 0)} task${Math.abs(missedYesterday) === 1 ? '' : 's'}`,
      '',
      'Insight:',
      pattern?.content ?? 'No strong pattern detected yet. Keep today intentionally simple.',
      '',
      'Today focus (1-2 priorities):',
      ...focusLines,
    ];

    const message = lines.join('\n');
    const conversation = await this.dailyConversation.getOrCreate(userId, { now });

    const sent = await this.prisma.$transaction(async tx => {
      const updated = await tx.day.updateMany({
        where: {
          id: dayId,
          morningBriefingSentAt: null,
        },
        data: {
          morningBriefingSentAt: now,
          startedAt: day.startedAt ?? now,
          state: DayState.ACTIVE,
          phase: DayPhase.PLANNING,
        },
      });

      if (updated.count === 0) {
        return false;
      }

      await tx.message.create({
        data: {
          conversationId: conversation.conversationId,
          role: 'ASSISTANT',
          mode: ConversationMode.MANAGER,
          content: message,
        },
      });

      return true;
    });

    return sent;
  }

  private async maybeSendPlanningSuggestion(
    userId: string,
    profile: DailyProfile,
    dayId: string,
    now: Date,
  ): Promise<boolean> {
    const day = await this.prisma.day.findUnique({
      where: { id: dayId },
      include: {
        tasks: {
          select: { id: true },
        },
      },
    });

    if (!day || day.planningSuggestionSentAt || day.nudgesSentCount >= 3) {
      return false;
    }

    const topPattern = await this.prisma.memory.findFirst({
      where: {
        userId,
        layer: 'PATTERN',
      },
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      select: {
        content: true,
        tags: true,
      },
    });

    const hasOvercommitmentPattern =
      topPattern?.tags?.includes('overcommitment') ||
      topPattern?.content.toLowerCase().includes('overcommit') ||
      false;

    if (day.tasks.length <= 5 || !hasOvercommitmentPattern) {
      return false;
    }

    const conversation = await this.dailyConversation.getOrCreate(userId, { now });
    const suggestion = [
      'You have a heavy plan today.',
      `You usually struggle when planning more than 5 tasks.`,
      'Want me to simplify it into a smaller focus set?',
    ].join('\n');

    return this.prisma.$transaction(async tx => {
      const updated = await tx.day.updateMany({
        where: {
          id: dayId,
          planningSuggestionSentAt: null,
          nudgesSentCount: { lt: 3 },
        },
        data: {
          planningSuggestionSentAt: now,
          nudgesSentCount: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        return false;
      }

      await tx.message.create({
        data: {
          conversationId: conversation.conversationId,
          role: 'ASSISTANT',
          mode: ConversationMode.MANAGER,
          content: suggestion,
        },
      });
      return true;
    });
  }

  private async maybeRunExecutionMonitor(
    userId: string,
    dayId: string,
    localHour: number,
    now: Date,
  ): Promise<{ noProgressNudgeSent: boolean; stuckTaskNudgeSent: boolean; actions: number }> {
    const day = await this.prisma.day.findUnique({
      where: { id: dayId },
      select: {
        id: true,
        noProgressNudgeSentAt: true,
        stuckTaskNudgeSentAt: true,
        nudgesSentCount: true,
      },
    });

    if (!day || day.nudgesSentCount >= 3) {
      return { noProgressNudgeSent: false, stuckTaskNudgeSent: false, actions: 0 };
    }

    const signals = await this.executionMonitor.evaluate(dayId, localHour, now);
    const conversation = await this.dailyConversation.getOrCreate(userId, { now });

    // Keep nudges minimal: at most one execution nudge per evaluation cycle.
    if (signals.stuckTask && !day.stuckTaskNudgeSentAt) {
      const content = [
        `You've been on "${signals.stuckTask.name}" for a while.`,
        'Want to split it into a smaller next step or take a short break first?',
      ].join('\n');

      const sent = await this.prisma.$transaction(async tx => {
        const updated = await tx.day.updateMany({
          where: {
            id: day.id,
            stuckTaskNudgeSentAt: null,
            nudgesSentCount: { lt: 3 },
          },
          data: {
            stuckTaskNudgeSentAt: now,
            nudgesSentCount: { increment: 1 },
          },
        });
        if (updated.count === 0) return false;
        await tx.message.create({
          data: {
            conversationId: conversation.conversationId,
            role: 'ASSISTANT',
            mode: ConversationMode.MANAGER,
            content,
          },
        });
        return true;
      });

      return { noProgressNudgeSent: false, stuckTaskNudgeSent: sent, actions: Number(sent) };
    }

    if (signals.noProgress && !day.noProgressNudgeSentAt) {
      const content = [
        'Quick check-in: no tasks are completed yet today.',
        'Would it help if we pick one tiny win to unlock momentum?',
      ].join('\n');

      const sent = await this.prisma.$transaction(async tx => {
        const updated = await tx.day.updateMany({
          where: {
            id: day.id,
            noProgressNudgeSentAt: null,
            nudgesSentCount: { lt: 3 },
          },
          data: {
            noProgressNudgeSentAt: now,
            nudgesSentCount: { increment: 1 },
          },
        });
        if (updated.count === 0) return false;
        await tx.message.create({
          data: {
            conversationId: conversation.conversationId,
            role: 'ASSISTANT',
            mode: ConversationMode.MANAGER,
            content,
          },
        });
        return true;
      });

      return { noProgressNudgeSent: sent, stuckTaskNudgeSent: false, actions: Number(sent) };
    }

    return { noProgressNudgeSent: false, stuckTaskNudgeSent: false, actions: 0 };
  }

  private async sendDynamicEveningReflection(
    userId: string,
    profile: DailyProfile,
    dayId: string,
    now: Date,
  ): Promise<boolean> {
    const day = await this.prisma.day.findUnique({
      where: { id: dayId },
      include: {
        tasks: {
          select: { name: true, status: true, priority: true },
        },
      },
    });

    if (!day || day.eveningReflectionSentAt) {
      return false;
    }

    const done = day.tasks.filter(task => task.status === TaskStatus.DONE);
    const pending = day.tasks.filter(task => task.status !== TaskStatus.DONE);
    const completionRate = day.tasks.length > 0 ? done.length / day.tasks.length : 1;

    const topPattern = await this.prisma.memory.findFirst({
      where: { userId, layer: 'PATTERN' },
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      select: { content: true, tags: true },
    });

    const question = this.buildEveningQuestion(completionRate, topPattern?.tags ?? []);
    const lines: string[] = [`Good evening, ${profile.displayName}.`, ''];

    if (done.length > 0) {
      lines.push(`You completed ${done.length} task${done.length === 1 ? '' : 's'} today.`);
    } else {
      lines.push('No tasks were completed today.');
    }

    if (pending.length > 0) {
      lines.push(`${pending.length} task${pending.length === 1 ? '' : 's'} remained in progress.`);
    }

    if (topPattern?.content) {
      lines.push('', `Pattern note: ${topPattern.content}`);
    }

    lines.push('', 'Question:', question);

    const conversation = await this.dailyConversation.getOrCreate(userId, { now });
    return this.prisma.$transaction(async tx => {
      const updated = await tx.day.updateMany({
        where: {
          id: dayId,
          eveningReflectionSentAt: null,
        },
        data: {
          eveningReflectionSentAt: now,
          phase: DayPhase.EVENING,
        },
      });
      if (updated.count === 0) return false;

      await tx.message.create({
        data: {
          conversationId: conversation.conversationId,
          role: 'ASSISTANT',
          mode: ConversationMode.REFLECTION,
          content: lines.join('\n'),
        },
      });
      return true;
    });
  }

  private shouldRunMorningFallback(preference: string | null, localHour: number): boolean {
    const inWindow = localHour >= 6 && localHour <= 11;
    if (!inWindow) {
      return false;
    }
    return this.matchesPreference(preference, 'morning');
  }

  private shouldRunEveningReflection(preference: string | null, localHour: number): boolean {
    const inWindow = localHour >= 19 && localHour <= 23;
    if (!inWindow) {
      return false;
    }
    return this.matchesPreference(preference, 'evening');
  }

  private matchesPreference(preference: string | null, target: 'morning' | 'evening'): boolean {
    if (!preference || preference === 'anytime') {
      return true;
    }
    return preference === target;
  }

  private compareTaskPriority(
    a: { priority: TaskPriority; deadline: Date | null; createdAt: Date },
    b: { priority: TaskPriority; deadline: Date | null; createdAt: Date },
  ): number {
    const priorityWeight = (priority: TaskPriority): number => {
      if (priority === TaskPriority.HIGH) return 3;
      if (priority === TaskPriority.MEDIUM) return 2;
      return 1;
    };

    const diff = priorityWeight(b.priority) - priorityWeight(a.priority);
    if (diff !== 0) {
      return diff;
    }

    if (a.deadline && b.deadline) {
      return a.deadline.getTime() - b.deadline.getTime();
    }
    if (a.deadline && !b.deadline) {
      return -1;
    }
    if (!a.deadline && b.deadline) {
      return 1;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  }

  private buildEveningQuestion(completionRate: number, patternTags: string[]): string {
    if (patternTags.includes('morning-productivity')) {
      return 'What changed after your strongest focus block, and how can you protect it tomorrow?';
    }
    if (completionRate >= 0.7) {
      return 'What helped you keep momentum today so you can repeat it tomorrow?';
    }
    if (completionRate <= 0.3) {
      return 'What was the main blocker that interrupted your plan today?';
    }
    return 'Where did your focus drop the most, and what would make that moment easier tomorrow?';
  }
}
