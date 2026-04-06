import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';
import {
  ConversationMode,
  DayPhase,
  DayState,
  Prisma,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import type { ActionCandidate } from '@ai/shared-types';

import { PrismaService } from '../prisma/prisma.service';
import { TaskScoringService } from '../tasks/task-scoring.service';

import { addUtcDays, getUserLocalDateInfo } from './daily-timezone.util';
import { DailyConversationService } from './daily-conversation.service';
import { DailyEvent, DailyEventResult } from './daily.types';
import { DecisionEngineService } from './decision-engine.service';
import { DecisionContext, DecisionMessageTemplate } from './decision.types';
import { NudgePolicyService } from './nudge-policy.service';
import { NudgePriority, NudgeType } from './nudge.types';
import type { DailyAction } from './action.types';

type DailyProfile = {
  displayName: string;
  onboardingCompleted: boolean;
  dayPlanningTime: string | null;
  reflectionTime: string | null;
  timezone: string;
};

type DaySnapshot = {
  id: string;
  date: Date;
  state: DayState;
  phase: DayPhase;
  startedAt: Date | null;
  endedAt: Date | null;
  lastActivityAt: Date | null;
  morningBriefingSentAt: Date | null;
  eveningReflectionSentAt: Date | null;
  planningSuggestionSentAt: Date | null;
  noProgressNudgeSentAt: Date | null;
  stuckTaskNudgeSentAt: Date | null;
};

type DayUpdateGate = {
  morningBriefingSentAt?: null;
  eveningReflectionSentAt?: null;
  planningSuggestionSentAt?: null;
  noProgressNudgeSentAt?: null;
  stuckTaskNudgeSentAt?: null;
};

@Injectable()
export class DailyEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyConversation: DailyConversationService,
    private readonly decisionEngine: DecisionEngineService,
    private readonly nudgePolicy: NudgePolicyService,
    private readonly taskScoring: TaskScoringService,
  ) {}

  async handleEvent(
    userId: string,
    event: DailyEvent,
    now = new Date(),
  ): Promise<DailyEventResult> {
    const profile = await this.loadProfile(userId);
    const local = getUserLocalDateInfo(now, profile.timezone);
    let day = await this.getOrCreateDay(userId, local.dayStartUtc);

    if (!profile.onboardingCompleted && event.type !== 'USER_ACTIVITY') {
      return this.emptyResult();
    }

    const firstActivity = event.type === 'USER_ACTIVITY' && day.lastActivityAt == null;
    if (event.type === 'USER_ACTIVITY') {
      day = await this.markUserActivity(day.id, day, now);
    }

    const decisionEvent = this.normalizeDecisionEvent(
      event,
      firstActivity,
      day,
      profile,
      local.hour,
    );
    const [tasks, patterns] = await Promise.all([
      this.prisma.task.findMany({
        where: { dayId: day.id },
        select: {
          id: true,
          name: true,
          status: true,
          priority: true,
          difficulty: true,
          estimatedMinutes: true,
          deadline: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.memory.findMany({
        where: {
          userId,
          layer: 'PATTERN',
        },
        orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
        take: 5,
        select: {
          content: true,
          tags: true,
        },
      }),
    ]);

    const morningFocusPattern = this.hasMorningFocusPattern(patterns);
    const availableMinutes = this.taskScoring.getAvailableMinutes();
    const totalEstimatedMinutes = this.taskScoring.totalEstimatedTime(tasks);
    const isOverloaded = this.taskScoring.isOverloaded(tasks, availableMinutes);

    const context: DecisionContext = {
      userId,
      event: decisionEvent,
      day,
      tasks,
      patterns,
      now,
      localHour: local.hour,
      allowEveningReflection: this.matchesPreference(profile.reflectionTime, 'evening'),
      availableMinutes,
      totalEstimatedMinutes,
      isOverloaded,
      morningFocusPattern,
    };

    const decision = this.decisionEngine.evaluate(context);
    const result = this.emptyResult();

    let sent = false;
    if (decision.action && decision.action.type !== 'NO_OP') {
      if (decision.action.type === 'SEND_NUDGE') {
        sent = await this.executeNudgeAction(
          userId,
          day.id,
          now,
          context,
          decision.action.nudge.type,
          decision.action.action,
        );
        if (sent) {
          this.applyNudgeResult(result, decision.action.nudge.type);
        }
      } else if (decision.action.type === 'SEND_MESSAGE') {
        sent = await this.executeMessageAction(
          userId,
          day,
          profile,
          tasks,
          patterns,
          now,
          decision.action.template,
        );
        if (sent) {
          if (decision.action.template === 'MORNING_BRIEFING') result.morningSent = true;
          if (decision.action.template === 'EVENING_REFLECTION') result.eveningSent = true;
        }
      }
    }

    if (decision.nextPhase && (decision.action?.type === 'NO_OP' || sent)) {
      const transitioned = await this.applyPhaseTransition(day.id, day.phase, decision.nextPhase);
      if (transitioned) {
        day.phase = decision.nextPhase;
      }
    }

    result.actions = sent ? 1 : 0;
    return result;
  }

  private async executeNudgeAction(
    userId: string,
    dayId: string,
    now: Date,
    context: DecisionContext,
    type: NudgeType,
    action?: DailyAction,
  ): Promise<boolean> {
    const nudge = { type, priority: this.nudgePriority(type), createdAt: now };
    const allowed = await this.nudgePolicy.shouldSendNudge(userId, nudge, { dayId });
    if (!allowed) {
      return false;
    }

    if (type === NudgeType.PLAN_OVERLOAD) {
      return this.sendNudgeMessage({
        userId,
        dayId,
        now,
        nudge,
        mode: ConversationMode.MANAGER,
        content: this.buildOverloadNudgeContent(context),
        suggestedAction: action,
        where: { planningSuggestionSentAt: null },
        dayUpdate: {
          planningSuggestionSentAt: now,
          nudgesSentCount: { increment: 1 },
        },
      });
    }

    if (type === NudgeType.NO_PROGRESS) {
      return this.sendNudgeMessage({
        userId,
        dayId,
        now,
        nudge,
        mode: ConversationMode.MANAGER,
        content: [
          'Quick check-in: no tasks are completed yet today.',
          'Would it help if we pick one tiny win to unlock momentum?',
        ].join('\n'),
        suggestedAction: action,
        where: { noProgressNudgeSentAt: null },
        dayUpdate: {
          noProgressNudgeSentAt: now,
          nudgesSentCount: { increment: 1 },
        },
      });
    }

    if (type === NudgeType.STUCK_TASK) {
      const thresholdMs = 3 * 60 * 60 * 1000;
      const stuckTask = context.tasks
        .filter(task => task.status === TaskStatus.IN_PROGRESS)
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
        .find(task => now.getTime() - task.updatedAt.getTime() >= thresholdMs);

      if (!stuckTask) {
        return false;
      }

      return this.sendNudgeMessage({
        userId,
        dayId,
        now,
        nudge,
        mode: ConversationMode.MANAGER,
        content: [
          `You've been on "${stuckTask.name}" for a while.`,
          'Want to split it into a smaller next step or take a short break first?',
        ].join('\n'),
        suggestedAction: action,
        where: { stuckTaskNudgeSentAt: null },
        dayUpdate: {
          stuckTaskNudgeSentAt: now,
          nudgesSentCount: { increment: 1 },
        },
      });
    }

    return false;
  }

  private async executeMessageAction(
    userId: string,
    day: DaySnapshot,
    profile: DailyProfile,
    tasks: DecisionContext['tasks'],
    patterns: DecisionContext['patterns'],
    now: Date,
    template: DecisionMessageTemplate,
  ): Promise<boolean> {
    if (template === 'MORNING_BRIEFING') {
      const content = await this.buildMorningBriefingContent(userId, day, profile, tasks, patterns);
      return this.sendMessage({
        userId,
        dayId: day.id,
        now,
        mode: ConversationMode.MANAGER,
        content,
        where: { morningBriefingSentAt: null },
        dayUpdate: {
          morningBriefingSentAt: now,
          startedAt: day.startedAt ?? now,
          state: DayState.ACTIVE,
        },
      });
    }

    if (template === 'EVENING_REFLECTION') {
      const content = this.buildEveningReflectionContent(profile, tasks, patterns);
      return this.sendMessage({
        userId,
        dayId: day.id,
        now,
        mode: ConversationMode.REFLECTION,
        content,
        where: { eveningReflectionSentAt: null },
        dayUpdate: {
          eveningReflectionSentAt: now,
        },
      });
    }

    return false;
  }

  private async sendNudgeMessage(input: {
    userId: string;
    dayId: string;
    now: Date;
    nudge: {
      type: NudgeType;
      priority: ReturnType<DailyEngineService['nudgePriority']>;
      createdAt: Date;
    };
    mode: ConversationMode;
    content: string;
    suggestedAction?: DailyAction;
    where: DayUpdateGate;
    dayUpdate: Prisma.DayUpdateManyMutationInput;
  }): Promise<boolean> {
    const conversation = await this.dailyConversation.getOrCreate(input.userId, { now: input.now });

    try {
      return await this.prisma.$transaction(async tx => {
        const updated = await tx.day.updateMany({
          where: {
            id: input.dayId,
            ...input.where,
          },
          data: input.dayUpdate,
        });
        if (updated.count === 0) {
          throw new Error('NUDGE_ABORT');
        }

        const recorded = await this.nudgePolicy.recordNudge(input.userId, input.nudge, {
          dayId: input.dayId,
          client: tx,
        });
        if (!recorded) {
          throw new Error('NUDGE_ABORT');
        }

        const actionCandidate =
          input.suggestedAction && input.suggestedAction.requiresConfirmation
            ? await this.createActionCandidate(
                tx,
                input.userId,
                conversation.conversationId,
                input.suggestedAction,
              )
            : null;

        const contentWithActionHint = this.appendActionHint(input.content, actionCandidate);

        await tx.message.create({
          data: {
            conversationId: conversation.conversationId,
            role: 'ASSISTANT',
            mode: input.mode,
            content: contentWithActionHint,
          },
        });
        return true;
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'NUDGE_ABORT') {
        return false;
      }
      throw error;
    }
  }

  private async sendMessage(input: {
    userId: string;
    dayId: string;
    now: Date;
    mode: ConversationMode;
    content: string;
    where: DayUpdateGate;
    dayUpdate: Prisma.DayUpdateManyMutationInput;
  }): Promise<boolean> {
    const conversation = await this.dailyConversation.getOrCreate(input.userId, { now: input.now });
    const updated = await this.prisma.day.updateMany({
      where: {
        id: input.dayId,
        ...input.where,
      },
      data: input.dayUpdate,
    });
    if (updated.count === 0) {
      return false;
    }

    await this.prisma.message.create({
      data: {
        conversationId: conversation.conversationId,
        role: 'ASSISTANT',
        mode: input.mode,
        content: input.content,
      },
    });
    return true;
  }

  private async buildMorningBriefingContent(
    userId: string,
    day: DaySnapshot,
    profile: DailyProfile,
    tasks: DecisionContext['tasks'],
    patterns: DecisionContext['patterns'],
  ): Promise<string> {
    const yesterday = await this.prisma.day.findUnique({
      where: { userId_date: { userId, date: addUtcDays(day.date, -1) } },
      select: {
        tasks: {
          select: { status: true },
        },
      },
    });

    const completedYesterday =
      yesterday?.tasks.filter(task => task.status === TaskStatus.DONE).length ?? 0;
    const missedYesterday =
      (yesterday?.tasks.length ?? 0) -
      (yesterday?.tasks.filter(task => task.status === TaskStatus.DONE).length ?? 0);

    const normalizedTasks = tasks.map(task => ({
      id: task.id,
      name: task.name,
      status: task.status,
      priority: (task.priority ?? 'MEDIUM') as TaskPriority,
      difficulty: task.difficulty ?? 3,
      estimatedMinutes: task.estimatedMinutes ?? null,
      deadline: task.deadline ?? null,
    }));
    const morningFocusPattern = this.hasMorningFocusPattern(patterns);
    const topTasks = this.taskScoring.getTopTasks(normalizedTasks, {
      limit: 2,
      morningFocus: morningFocusPattern,
      includeHighImpact: true,
    });
    const totalEstimatedMinutes = this.taskScoring.totalEstimatedTime(normalizedTasks);
    const availableMinutes = this.taskScoring.getAvailableMinutes();
    const isOverloaded = totalEstimatedMinutes > availableMinutes;

    const focusLines =
      topTasks.length > 0
        ? topTasks.map(task => {
            const due = task.deadline ? ` (due ${task.deadline.toISOString().slice(0, 10)})` : '';
            const estimate = this.taskScoring.estimateTaskMinutes(task);
            return `- ${task.name}${due} ~${estimate}m`;
          })
        : ['- No pending tasks yet. Pick one meaningful priority.'];

    const topPattern = patterns[0]?.content ?? 'No strong pattern detected yet.';
    const loadLine = `- Planned load: ${this.formatMinutes(totalEstimatedMinutes)} / ${this.formatMinutes(availableMinutes)} available`;
    return [
      `Good morning, ${profile.displayName}.`,
      '',
      'Yesterday:',
      `- Completed: ${completedYesterday} task${completedYesterday === 1 ? '' : 's'}`,
      `- Missed: ${Math.max(missedYesterday, 0)} task${Math.abs(missedYesterday) === 1 ? '' : 's'}`,
      '',
      'Insight:',
      topPattern,
      '',
      'Load:',
      loadLine,
      ...(isOverloaded
        ? ['- This looks overloaded. A lighter plan can improve follow-through.', '']
        : ['']),
      'Today focus (1-2 priorities):',
      ...focusLines,
    ].join('\n');
  }

  private buildEveningReflectionContent(
    profile: DailyProfile,
    tasks: DecisionContext['tasks'],
    patterns: DecisionContext['patterns'],
  ): string {
    const done = tasks.filter(task => task.status === TaskStatus.DONE);
    const pending = tasks.filter(task => task.status !== TaskStatus.DONE);
    const completionRate = tasks.length > 0 ? done.length / tasks.length : 1;
    const pattern = patterns[0];
    const question = this.buildEveningQuestion(completionRate, pattern?.tags ?? []);

    const lines: string[] = [`Good evening, ${profile.displayName}.`, ''];
    if (done.length > 0) {
      lines.push(`You completed ${done.length} task${done.length === 1 ? '' : 's'} today.`);
    } else {
      lines.push('No tasks were completed today.');
    }
    if (pending.length > 0) {
      lines.push(`${pending.length} task${pending.length === 1 ? '' : 's'} remained in progress.`);
    }
    if (pattern?.content) {
      lines.push('', `Pattern note: ${pattern.content}`);
    }
    lines.push('', 'Question:', question);
    return lines.join('\n');
  }

  private normalizeDecisionEvent(
    event: DailyEvent,
    firstActivity: boolean,
    day: DaySnapshot,
    profile: DailyProfile,
    localHour: number,
  ): DailyEvent {
    if (firstActivity) {
      return { type: 'DAY_START' };
    }

    if (
      event.type === 'TIME_TRIGGER' &&
      day.phase === DayPhase.NOT_STARTED &&
      this.shouldRunMorningFallback(profile.dayPlanningTime, localHour)
    ) {
      return { type: 'DAY_START' };
    }

    return event;
  }

  private applyNudgeResult(result: DailyEventResult, type: NudgeType): void {
    if (type === NudgeType.PLAN_OVERLOAD) result.planningSuggestionSent = true;
    if (type === NudgeType.NO_PROGRESS) result.noProgressNudgeSent = true;
    if (type === NudgeType.STUCK_TASK) result.stuckTaskNudgeSent = true;
  }

  private buildOverloadNudgeContent(context: DecisionContext): string {
    const lines = [
      `You are currently over your available day capacity.`,
      `Planned load is ${this.formatMinutes(context.totalEstimatedMinutes)} vs about ${this.formatMinutes(context.availableMinutes)} available.`,
    ];

    if (context.morningFocusPattern) {
      lines.push(
        'You tend to focus better in the morning, so let’s protect a smaller high-impact set.',
      );
    }

    lines.push('Want me to simplify today into a focused set?');
    return lines.join('\n');
  }

  private async createActionCandidate(
    tx: Prisma.TransactionClient,
    userId: string,
    conversationId: string,
    action: DailyAction,
  ): Promise<ActionCandidate> {
    const normalized: ActionCandidate = {
      id: randomUUID(),
      type: action.type,
      payload: {
        ...action.payload,
        conversationId,
      },
      confidence: 0.85,
      requiresConfirmation: true,
    };

    await tx.actionCandidate.create({
      data: {
        id: normalized.id,
        userId,
        conversationId,
        type: normalized.type,
        payload: normalized.payload as Prisma.InputJsonObject,
        confidence: normalized.confidence,
        requiresConfirmation: normalized.requiresConfirmation,
        status: 'PENDING',
      },
    });

    return normalized;
  }

  private appendActionHint(baseContent: string, actionCandidate: ActionCandidate | null): string {
    if (!actionCandidate) {
      return baseContent;
    }

    const actionLabel = this.getActionLabel(actionCandidate.type);
    return [
      baseContent,
      '',
      `Suggested action available: ${actionLabel}.`,
      `If you want this applied, confirm action id: ${actionCandidate.id}`,
    ].join('\n');
  }

  private getActionLabel(actionType: string): string {
    if (actionType === 'SIMPLIFY_DAY') return 'simplify today to top priorities';
    if (actionType === 'SPLIT_TASK') return 'split the stuck task into subtasks';
    if (actionType === 'RESCHEDULE_TASK') return 'reschedule the task to tomorrow';
    return actionType.toLowerCase();
  }

  private nudgePriority(type: NudgeType): NudgePriority {
    if (type === NudgeType.NO_PROGRESS || type === NudgeType.STUCK_TASK) {
      return NudgePriority.HIGH;
    }
    if (type === NudgeType.PLAN_OVERLOAD) {
      return NudgePriority.MEDIUM;
    }
    return NudgePriority.LOW;
  }

  private async applyPhaseTransition(
    dayId: string,
    from: DayPhase,
    to: DayPhase,
  ): Promise<boolean> {
    if (!this.decisionEngine.isValidPhaseTransition(from, to)) {
      return false;
    }
    const updated = await this.prisma.day.updateMany({
      where: {
        id: dayId,
        phase: from,
      },
      data: { phase: to },
    });
    return updated.count > 0;
  }

  private emptyResult(): DailyEventResult {
    return {
      morningSent: false,
      planningSuggestionSent: false,
      noProgressNudgeSent: false,
      stuckTaskNudgeSent: false,
      eveningSent: false,
      actions: 0,
    };
  }

  private async markUserActivity(dayId: string, day: DaySnapshot, now: Date): Promise<DaySnapshot> {
    return this.prisma.day.update({
      where: { id: dayId },
      data: {
        state: day.state === DayState.START ? DayState.ACTIVE : day.state,
        startedAt: day.startedAt ?? now,
        lastActivityAt: now,
      },
      select: {
        id: true,
        date: true,
        state: true,
        phase: true,
        startedAt: true,
        endedAt: true,
        lastActivityAt: true,
        morningBriefingSentAt: true,
        eveningReflectionSentAt: true,
        planningSuggestionSentAt: true,
        noProgressNudgeSentAt: true,
        stuckTaskNudgeSentAt: true,
      },
    });
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

  private async getOrCreateDay(userId: string, date: Date): Promise<DaySnapshot> {
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
        endedAt: true,
        lastActivityAt: true,
        morningBriefingSentAt: true,
        eveningReflectionSentAt: true,
        planningSuggestionSentAt: true,
        noProgressNudgeSentAt: true,
        stuckTaskNudgeSentAt: true,
      },
    });
  }

  private shouldRunMorningFallback(preference: string | null, localHour: number): boolean {
    const inWindow = localHour >= 6 && localHour <= 11;
    if (!inWindow) {
      return false;
    }
    return this.matchesPreference(preference, 'morning');
  }

  private matchesPreference(preference: string | null, target: 'morning' | 'evening'): boolean {
    if (!preference || preference === 'anytime') {
      return true;
    }
    return preference === target;
  }

  private hasMorningFocusPattern(patterns: DecisionContext['patterns']): boolean {
    return patterns.some(pattern => {
      const content = pattern.content.toLowerCase();
      return (
        pattern.tags.includes('morning-focus') ||
        pattern.tags.includes('morning-productivity') ||
        content.includes('morning focus') ||
        content.includes('before noon')
      );
    });
  }

  private formatMinutes(minutes: number): string {
    const normalized = Math.max(0, Math.round(minutes));
    const hours = Math.floor(normalized / 60);
    const mins = normalized % 60;
    if (hours === 0) {
      return `${mins}m`;
    }
    if (mins === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
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
