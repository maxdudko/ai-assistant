import { randomUUID } from 'crypto';

import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConversationMode, DayPhase, DayState, Prisma, TaskStatus } from '@prisma/client';
import type { ActionCandidate } from '@ai/shared-types';

import { PrismaService } from '../prisma/prisma.service';
import { TaskScoringService } from '../tasks/task-scoring.service';
import { ActionsService } from '../actions/actions.service';
import { DayResolverService } from '../days/day-resolver.service';

import { addUtcDays, getUserLocalDateInfo } from './daily-timezone.util';
import { DailyConversationService } from './daily-conversation.service';
import { DailyEvent, DailyEventResult } from './daily.types';
import { DecisionEngineService } from './decision-engine.service';
import { DecisionAction, DecisionContext, DecisionMessageTemplate } from './decision.types';
import { NudgePolicyService } from './nudge-policy.service';
import { NudgePriority, NudgeType } from './nudge.types';
import type { DailyAction } from './action.types';
import { UnifiedContextService } from './unified-context.service';

type DailyProfile = {
  displayName: string;
  onboardingCompleted: boolean;
  dayPlanningTime: string | null;
  reflectionTime: string | null;
  helpStyle: string | null;
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
  private readonly logger = new Logger(DailyEngineService.name);
  private readonly counters = {
    nudgesSent: 0,
    nudgesBlocked: 0,
    actionsCreated: 0,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyConversation: DailyConversationService,
    private readonly decisionEngine: DecisionEngineService,
    private readonly nudgePolicy: NudgePolicyService,
    private readonly taskScoring: TaskScoringService,
    @Inject(forwardRef(() => ActionsService))
    private readonly actionsService: ActionsService,
    private readonly dayResolver: DayResolverService,
    private readonly unifiedContext: UnifiedContextService,
  ) {}

  async handleEvent(
    userId: string,
    event: DailyEvent,
    now = new Date(),
  ): Promise<DailyEventResult> {
    const profile = await this.loadProfile(userId);
    const local = getUserLocalDateInfo(now, profile.timezone);
    let day: DaySnapshot = await this.dayResolver.getDayForMoment(userId, now);

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
    const unifiedContext = await this.unifiedContext.getContext({
      userId,
      event: decisionEvent,
      now,
    });
    day = unifiedContext.day;
    const tasks = unifiedContext.tasks;
    const patterns = unifiedContext.memory.patterns.map(pattern => ({
      content: pattern.content,
      tags: pattern.tags,
    }));
    const morningFocusPattern = this.hasMorningFocusPattern(patterns);
    const availableMinutes = unifiedContext.load.available;
    const totalEstimatedMinutes = unifiedContext.load.totalEstimated;
    const isOverloaded = unifiedContext.load.isOverloaded;

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

    const result = this.emptyResult();
    const sortedDecisions = this.decisionEngine.rankDecisions(context);
    this.logStructured('daily_event_received', {
      userId,
      eventType: decisionEvent.type,
      phase: day.phase,
      candidateReasons: sortedDecisions.map(decision => decision.reason ?? 'PHASE_PROGRESSION'),
    });
    let selectedDecision: (typeof sortedDecisions)[number] | null = null;
    let sent = false;

    for (const [index, decision] of sortedDecisions.entries()) {
      if (!decision.action || decision.action.type === 'NO_OP') {
        selectedDecision = decision;
        break;
      }

      if (decision.action.type === 'SEND_NUDGE') {
        const nudgeOutcome = await this.executeNudgeAction(
          userId,
          day.id,
          now,
          context,
          decision.action,
        );
        if (!nudgeOutcome.sent) {
          this.counters.nudgesBlocked += 1;
          this.logStructured('daily_decision_rejected', {
            userId,
            eventType: decisionEvent.type,
            reason: decision.reason ?? 'UNKNOWN',
            actionType: 'SEND_NUDGE',
            rejectionReason: nudgeOutcome.blockReason ?? 'UNKNOWN',
            metrics: this.counters,
          });
          continue;
        }
        this.counters.nudgesSent += 1;
        sent = true;
        selectedDecision = decision;
        this.applyNudgeResult(result, decision.action.nudge.type);
        if (index > 0) {
          this.logger.log(
            `Decision fallback applied reason=${decision.reason ?? 'UNKNOWN'} rankIndex=${index} userId=${userId}`,
          );
        }
        break;
      }

      const sentMessage = await this.executeMessageAction(
        userId,
        day,
        profile,
        tasks,
        patterns,
        unifiedContext.scoredTasks,
        unifiedContext.load,
        now,
        decision.action.template,
      );
      if (!sentMessage) {
        this.logStructured('daily_decision_rejected', {
          userId,
          eventType: decisionEvent.type,
          reason: decision.reason ?? 'UNKNOWN',
          actionType: 'SEND_MESSAGE',
          rejectionReason: 'MESSAGE_GUARD_FAILED',
          metrics: this.counters,
        });
        continue;
      }
      sent = true;
      selectedDecision = decision;
      if (decision.action.template === 'MORNING_BRIEFING') result.morningSent = true;
      if (decision.action.template === 'EVENING_REFLECTION') result.eveningSent = true;
      if (index > 0) {
        this.logger.log(
          `Decision fallback applied reason=${decision.reason ?? 'UNKNOWN'} rankIndex=${index} userId=${userId}`,
        );
      }
      break;
    }

    if (selectedDecision?.nextPhase && (selectedDecision.action?.type === 'NO_OP' || sent)) {
      const transitioned = await this.applyPhaseTransition(
        day.id,
        day.phase,
        selectedDecision.nextPhase,
      );
      if (transitioned) {
        day.phase = selectedDecision.nextPhase;
      }
    }

    result.actions = sent ? 1 : 0;
    this.logStructured('daily_event_completed', {
      userId,
      eventType: decisionEvent.type,
      selectedDecision: selectedDecision?.reason ?? null,
      selectedActionType: selectedDecision?.action?.type ?? null,
      phaseAfter: day.phase,
      actionsSent: result.actions,
      metrics: this.counters,
    });
    return result;
  }

  private async executeNudgeAction(
    userId: string,
    dayId: string,
    now: Date,
    context: DecisionContext,
    decisionAction: Extract<DecisionAction, { type: 'SEND_NUDGE' }>,
  ): Promise<{ sent: boolean; blockReason?: string }> {
    const type = decisionAction.nudge.type;
    const action = decisionAction.action;
    const targetTaskId =
      decisionAction.targetTaskId ??
      (action?.payload && typeof action.payload.taskId === 'string'
        ? action.payload.taskId
        : undefined);
    const nudge = { type, priority: this.nudgePriority(type), createdAt: now };
    const policyResult = await this.nudgePolicy.evaluateNudge(userId, nudge, { dayId });
    if (!policyResult.allowed) {
      return { sent: false, blockReason: policyResult.reason };
    }

    if (type === NudgeType.PLAN_OVERLOAD) {
      return {
        sent: await this.sendNudgeMessage({
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
        }),
      };
    }

    if (type === NudgeType.NO_PROGRESS) {
      return {
        sent: await this.sendNudgeMessage({
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
        }),
      };
    }

    if (type === NudgeType.STUCK_TASK) {
      const stuckTask = targetTaskId
        ? context.tasks.find(task => task.id === targetTaskId)
        : undefined;
      if (!stuckTask) {
        return { sent: false, blockReason: 'TARGET_TASK_NOT_FOUND' };
      }

      return {
        sent: await this.sendNudgeMessage({
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
        }),
      };
    }

    return { sent: false, blockReason: 'UNSUPPORTED_NUDGE_TYPE' };
  }

  private async executeMessageAction(
    userId: string,
    day: DaySnapshot,
    profile: DailyProfile,
    tasks: DecisionContext['tasks'],
    patterns: DecisionContext['patterns'],
    scoredTasks: Array<{
      taskId: string;
      score: number;
      estimatedMinutes: number;
      status: TaskStatus;
    }>,
    load: { totalEstimated: number; available: number; isOverloaded: boolean },
    now: Date,
    template: DecisionMessageTemplate,
  ): Promise<boolean> {
    if (template === 'MORNING_BRIEFING') {
      const content = await this.buildMorningBriefingContent(
        userId,
        day,
        profile,
        tasks,
        patterns,
        scoredTasks,
        load,
      );
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
            ? await this.actionsService.createCandidate(
                input.userId,
                {
                  id: randomUUID(),
                  type: input.suggestedAction.type,
                  payload: {
                    ...input.suggestedAction.payload,
                    conversationId: conversation.conversationId,
                  },
                  confidence: 0.85,
                  requiresConfirmation: true,
                },
                {
                  conversationId: conversation.conversationId,
                },
                { client: tx },
              )
            : null;
        if (actionCandidate) {
          this.counters.actionsCreated += 1;
        }

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
    scoredTasks: Array<{
      taskId: string;
      score: number;
      estimatedMinutes: number;
      status: TaskStatus;
    }>,
    load: { totalEstimated: number; available: number; isOverloaded: boolean },
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

    const taskById = new Map(tasks.map(task => [task.id, task]));
    const topTasks = scoredTasks
      .filter(entry => entry.status !== TaskStatus.DONE)
      .slice(0, 2)
      .map(entry => taskById.get(entry.taskId))
      .filter((task): task is NonNullable<typeof task> => Boolean(task));
    const totalEstimatedMinutes = load.totalEstimated;
    const availableMinutes = load.available;
    const isOverloaded = load.isOverloaded;

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
        helpStyle: true,
        timezone: true,
      },
    });

    return {
      displayName: profile?.displayName || 'there',
      onboardingCompleted: Boolean(profile?.onboardingCompleted),
      dayPlanningTime: profile?.dayPlanningTime ?? null,
      reflectionTime: profile?.reflectionTime ?? null,
      helpStyle: profile?.helpStyle ?? null,
      timezone: profile?.timezone ?? 'UTC',
    };
  }

  private logStructured(event: string, payload: Record<string, unknown>): void {
    this.logger.log(JSON.stringify({ event, ...payload }));
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
