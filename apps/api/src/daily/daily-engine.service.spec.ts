import { DayPhase, DayState, TaskPriority, TaskStatus } from '@prisma/client';

import { TaskScoringService } from '../tasks/task-scoring.service';

import { DailyEngineService } from './daily-engine.service';
import { NudgeType } from './nudge.types';

describe('DailyEngineService', () => {
  const now = new Date('2026-04-10T12:00:00.000Z');

  const buildDay = () => ({
    id: 'day-1',
    userId: 'user-1',
    date: new Date('2026-04-10T00:00:00.000Z'),
    state: DayState.ACTIVE,
    phase: DayPhase.EXECUTION,
    startedAt: null,
    endedAt: null,
    createdAt: new Date('2026-04-10T00:00:00.000Z'),
    lastActivityAt: null,
    morningBriefingSentAt: null,
    eveningReflectionSentAt: null,
    planningSuggestionSentAt: null,
    noProgressNudgeSentAt: null,
    stuckTaskNudgeSentAt: null,
    nudgesSentCount: 0,
    nudgesSentToday: 0,
    lastNudgeAt: null,
  });

  const buildUnifiedContext = () => ({
    day: buildDay(),
    tasks: [
      {
        id: 'task-1',
        userId: 'user-1',
        dayId: 'day-1',
        name: 'Ship fallback',
        description: null,
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        difficulty: 3,
        estimatedMinutes: 60,
        deadline: null,
        source: 'MANUAL',
        conversationId: null,
        parentId: null,
        goalId: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    scoredTasks: [],
    memory: {
      patterns: [],
      semantic: [],
      recent: [],
      important: [],
    },
    load: {
      totalEstimated: 60,
      available: 480,
      isOverloaded: false,
    },
  });

  const createService = () => {
    const prisma = {
      userProfile: {
        findUnique: jest.fn().mockResolvedValue({
          displayName: 'User',
          onboardingCompleted: true,
          dayPlanningTime: 'anytime',
          reflectionTime: 'anytime',
          timezone: 'UTC',
        }),
      },
      day: {
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ tasks: [] }),
      },
      message: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;
    const dailyConversation = {
      getOrCreate: jest.fn().mockResolvedValue({ conversationId: 'conv-1' }),
    } as any;
    const decisionEngine = {
      rankDecisions: jest.fn(),
      isValidPhaseTransition: jest.fn().mockReturnValue(true),
    } as any;
    const nudgePolicy = {
      shouldSendNudge: jest.fn(),
      evaluateNudge: jest.fn().mockResolvedValue({ allowed: true, reason: 'ALLOWED' }),
      recordNudge: jest.fn().mockResolvedValue(true),
    } as any;
    const actionsService = {
      createCandidate: jest.fn().mockResolvedValue({
        id: 'action-1',
        type: 'SIMPLIFY_DAY',
        payload: { dayId: 'day-1', conversationId: 'conv-1' },
        confidence: 0.8,
        requiresConfirmation: true,
      }),
    } as any;
    const dayResolver = {
      getDayForMoment: jest.fn().mockResolvedValue(buildDay()),
    } as any;
    const unifiedContext = {
      getContext: jest.fn().mockResolvedValue(buildUnifiedContext()),
    } as any;
    const notifications = {
      dispatchInBackground: jest.fn(),
      buildDailyNotification: jest.fn().mockReturnValue({
        userId: 'user-1',
        type: 'NUDGE',
        title: 'Check-in from Mira',
        body: 'Test',
      }),
    } as any;
    const service = new DailyEngineService(
      prisma,
      dailyConversation,
      decisionEngine,
      nudgePolicy,
      new TaskScoringService(),
      actionsService,
      dayResolver,
      unifiedContext,
      notifications,
    );
    return {
      service,
      prisma,
      decisionEngine,
      actionsService,
      nudgePolicy,
      dayResolver,
      unifiedContext,
    };
  };

  it('falls back to next-ranked decision when top nudge is blocked', async () => {
    const { service, decisionEngine } = createService();
    decisionEngine.rankDecisions.mockReturnValue([
      {
        reason: 'NO_PROGRESS',
        action: {
          type: 'SEND_NUDGE',
          nudge: { type: NudgeType.NO_PROGRESS, priority: 'HIGH', createdAt: now },
        },
      },
      {
        reason: 'STUCK_TASK',
        action: {
          type: 'SEND_NUDGE',
          nudge: { type: NudgeType.STUCK_TASK, priority: 'HIGH', createdAt: now },
        },
      },
    ]);

    jest
      .spyOn(service as any, 'executeNudgeAction')
      .mockResolvedValueOnce({ sent: false, blockReason: 'POLICY' })
      .mockResolvedValueOnce({ sent: true });

    const result = await service.handleEvent('user-1', { type: 'TIME_TRIGGER' }, now);

    expect((service as any).executeNudgeAction).toHaveBeenCalledTimes(2);
    expect(result.actions).toBe(1);
    expect(result.stuckTaskNudgeSent).toBe(true);
  });

  it('creates suggested action candidates via ActionsService only', async () => {
    const { service, prisma, decisionEngine, actionsService, nudgePolicy } = createService();
    decisionEngine.rankDecisions.mockReturnValue([
      {
        reason: 'PLAN_OVERLOAD',
        action: {
          type: 'SEND_NUDGE',
          nudge: { type: NudgeType.PLAN_OVERLOAD, priority: 'MEDIUM', createdAt: now },
          action: {
            type: 'SIMPLIFY_DAY',
            payload: { dayId: 'day-1' },
            requiresConfirmation: true,
          },
        },
      },
    ]);
    nudgePolicy.evaluateNudge.mockResolvedValue({ allowed: true, reason: 'ALLOWED' });

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        day: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        message: {
          create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
        },
      }),
    );

    await service.handleEvent('user-1', { type: 'TIME_TRIGGER' }, now);

    expect(actionsService.createCandidate).toHaveBeenCalledTimes(1);
  });

  it('uses the same event time for day resolution and unified context', async () => {
    const { service, dayResolver, unifiedContext, decisionEngine } = createService() as any;
    decisionEngine.rankDecisions.mockReturnValue([]);

    await service.handleEvent('user-1', { type: 'TIME_TRIGGER' }, now);

    expect(dayResolver.getDayForMoment).toHaveBeenCalledWith('user-1', now);
    expect(unifiedContext.getContext).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        now,
      }),
    );
  });

  it('uses the exact stuck task selected by DecisionEngine', async () => {
    const { service, prisma, decisionEngine, actionsService, nudgePolicy, unifiedContext } =
      createService() as any;
    const targetedTask = {
      id: 'task-2',
      userId: 'user-1',
      dayId: 'day-1',
      name: 'Targeted stuck task',
      description: null,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      difficulty: 4,
      estimatedMinutes: 90,
      deadline: null,
      source: 'MANUAL',
      conversationId: null,
      parentId: null,
      goalId: null,
      createdAt: new Date('2026-04-10T06:00:00.000Z'),
      updatedAt: new Date('2026-04-10T06:00:00.000Z'),
    };
    const otherTask = {
      ...targetedTask,
      id: 'task-1',
      name: 'Other stuck task',
      updatedAt: new Date('2026-04-10T05:00:00.000Z'),
    };
    unifiedContext.getContext.mockResolvedValue({
      ...buildUnifiedContext(),
      tasks: [otherTask, targetedTask],
    });

    decisionEngine.rankDecisions.mockReturnValue([
      {
        reason: 'STUCK_TASK',
        action: {
          type: 'SEND_NUDGE',
          nudge: { type: NudgeType.STUCK_TASK, priority: 'HIGH', createdAt: now },
          targetTaskId: 'task-2',
          action: {
            type: 'SPLIT_TASK',
            payload: { taskId: 'task-2', parts: 3 },
            requiresConfirmation: true,
          },
        },
      },
    ]);
    nudgePolicy.evaluateNudge.mockResolvedValue({ allowed: true, reason: 'ALLOWED' });

    const tx = {
      day: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      message: {
        create: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

    await service.handleEvent('user-1', { type: 'TIME_TRIGGER' }, now);

    expect(actionsService.createCandidate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        type: 'SPLIT_TASK',
        payload: expect.objectContaining({ taskId: 'task-2' }),
      }),
      expect.anything(),
      expect.anything(),
    );
    expect(tx.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: expect.stringContaining('Targeted stuck task'),
        }),
      }),
    );
  });
});
