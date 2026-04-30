import { DayPhase, DayState, TaskPriority, TaskStatus } from '@prisma/client';

import { TaskScoringService } from '../tasks/task-scoring.service';

import { UnifiedContextService } from './unified-context.service';

describe('UnifiedContextService', () => {
  const day = {
    id: 'day-1',
    userId: 'user-1',
    date: new Date('2026-04-10T00:00:00.000Z'),
    state: DayState.ACTIVE,
    phase: DayPhase.PLANNING,
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
  };

  const tasks = [
    {
      id: 'task-1',
      userId: 'user-1',
      dayId: 'day-1',
      name: 'Plan architecture',
      description: null,
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      difficulty: 4,
      estimatedMinutes: 120,
      deadline: null,
      source: 'MANUAL',
      conversationId: null,
      parentId: null,
      goalId: null,
      createdAt: new Date('2026-04-10T08:00:00.000Z'),
      updatedAt: new Date('2026-04-10T08:00:00.000Z'),
    },
    {
      id: 'task-2',
      userId: 'user-1',
      dayId: 'day-1',
      name: 'Small cleanup',
      description: null,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      difficulty: 1,
      estimatedMinutes: 20,
      deadline: null,
      source: 'MANUAL',
      conversationId: null,
      parentId: null,
      goalId: null,
      createdAt: new Date('2026-04-10T09:00:00.000Z'),
      updatedAt: new Date('2026-04-10T09:00:00.000Z'),
    },
  ];

  const memoryRows = [
    {
      id: 'mem-pattern',
      userId: 'user-1',
      type: 'FACTUAL',
      layer: 'PATTERN',
      content: 'Morning focus improves throughput',
      importance: 7,
      confidence: 0.9,
      tags: ['morning-focus'],
      source: 'CONVERSATION',
      usageCount: 0,
      lastUsedAt: null,
      dayId: null,
      conversationId: null,
      embedding: null,
      createdAt: new Date('2026-04-09T00:00:00.000Z'),
      updatedAt: new Date('2026-04-09T00:00:00.000Z'),
    },
    {
      id: 'mem-semantic',
      userId: 'user-1',
      type: 'FACTUAL',
      layer: 'SEMANTIC',
      content: 'Prefers batching notifications',
      importance: 6,
      confidence: 0.8,
      tags: [],
      source: 'CONVERSATION',
      usageCount: 0,
      lastUsedAt: null,
      dayId: null,
      conversationId: null,
      embedding: null,
      createdAt: new Date('2026-04-08T00:00:00.000Z'),
      updatedAt: new Date('2026-04-08T00:00:00.000Z'),
    },
  ] as any[];

  const createService = () => {
    const prisma = {
      task: {
        findMany: jest.fn().mockResolvedValue(tasks),
      },
      memory: {
        findMany: jest.fn().mockResolvedValue(memoryRows),
      },
    } as any;
    const dayResolver = {
      getCurrentDay: jest.fn().mockResolvedValue(day),
      getDayForMoment: jest.fn().mockResolvedValue(day),
    } as any;
    const memoryRetriever = {
      getMemoryContext: jest.fn().mockResolvedValue({
        patterns: [
          {
            id: 'mem-pattern',
            content: 'Morning focus improves throughput',
            importance: 7,
            tags: ['morning-focus'],
            confidence: 0.9,
            layer: 'PATTERN',
            usageCount: 0,
            lastUsedAt: null,
            createdAt: new Date('2026-04-09T00:00:00.000Z'),
            contextBucket: 'PATTERN',
          },
        ],
        semantic: [
          {
            id: 'mem-semantic',
            content: 'Prefers batching notifications',
            importance: 6,
            tags: [],
            confidence: 0.8,
            layer: 'SEMANTIC',
            usageCount: 0,
            lastUsedAt: null,
            createdAt: new Date('2026-04-08T00:00:00.000Z'),
            contextBucket: 'SEMANTIC',
          },
        ],
        recent: [],
        important: [
          {
            id: 'mem-pattern',
            content: 'Morning focus improves throughput',
            importance: 7,
            tags: ['morning-focus'],
            confidence: 0.9,
            layer: 'PATTERN',
            usageCount: 0,
            lastUsedAt: null,
            createdAt: new Date('2026-04-09T00:00:00.000Z'),
            contextBucket: 'IMPORTANT',
          },
        ],
        merged: [
          {
            id: 'mem-pattern',
            content: 'Morning focus improves throughput',
            importance: 7,
            tags: ['morning-focus'],
            confidence: 0.9,
            layer: 'PATTERN',
            usageCount: 0,
            lastUsedAt: null,
            createdAt: new Date('2026-04-09T00:00:00.000Z'),
            contextBucket: 'PATTERN',
          },
          {
            id: 'mem-semantic',
            content: 'Prefers batching notifications',
            importance: 6,
            tags: [],
            confidence: 0.8,
            layer: 'SEMANTIC',
            usageCount: 0,
            lastUsedAt: null,
            createdAt: new Date('2026-04-08T00:00:00.000Z'),
            contextBucket: 'SEMANTIC',
          },
        ],
      }),
      trackUsage: jest.fn().mockResolvedValue(undefined),
    } as any;
    const taskScoring = new TaskScoringService();

    const service = new UnifiedContextService(prisma, dayResolver, memoryRetriever, taskScoring);
    return { service, prisma, dayResolver, memoryRetriever };
  };

  it('assembles memory, tasks, scored tasks, and load', async () => {
    const { service, memoryRetriever, prisma } = createService() as any;
    const context = await service.getContext({
      userId: 'user-1',
      event: { type: 'USER_ACTIVITY' },
      now: new Date('2026-04-10T10:00:00.000Z'),
    });

    expect(context.day.id).toBe('day-1');
    expect(context.tasks).toHaveLength(2);
    expect(context.scoredTasks[0].score).toBeGreaterThan(context.scoredTasks[1].score);
    expect(context.memory.patterns[0].id).toBe('mem-pattern');
    expect(context.memory.semantic[0].id).toBe('mem-semantic');
    expect(context.load.totalEstimated).toBeGreaterThan(0);
    expect(context.load.available).toBe(480);
    expect(memoryRetriever.trackUsage).toHaveBeenCalledWith(['mem-pattern', 'mem-semantic']);
    expect(memoryRetriever.getMemoryContext).toHaveBeenCalledTimes(1);
    expect(prisma.memory.findMany).not.toHaveBeenCalled();
  });

  it('returns stable context for same input', async () => {
    const { service } = createService();
    const first = await service.getContext({
      userId: 'user-1',
      event: { type: 'TIME_TRIGGER' },
      now: new Date('2026-04-10T10:00:00.000Z'),
    });
    const second = await service.getContext({
      userId: 'user-1',
      event: { type: 'TIME_TRIGGER' },
      now: new Date('2026-04-10T10:00:00.000Z'),
    });

    expect(first).toEqual(second);
  });
});
