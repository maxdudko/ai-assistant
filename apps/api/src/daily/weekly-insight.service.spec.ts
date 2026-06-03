import { TaskStatus } from '@prisma/client';

import { WeeklyInsightService, computeIsoWeekBounds } from './weekly-insight.service';

function buildFeatureAccess() {
  return {
    assertCanUse: jest.fn().mockResolvedValue(undefined),
    canUse: jest.fn().mockResolvedValue(true),
    getPlanLimits: jest.fn().mockResolvedValue({ maxDigestTopics: 2 }),
    listEnabledFeatures: jest.fn().mockResolvedValue([]),
  };
}

function buildPrismaStub(
  overrides: Partial<{
    days: unknown[];
    memories: unknown[];
    rescheduleCount: number;
    goals: unknown[];
    patternMemories: unknown[];
    upsertResult: unknown;
    profile: unknown;
  }> = {},
) {
  return {
    userProfile: {
      findUnique: jest
        .fn()
        .mockResolvedValue(overrides.profile ?? { timezone: 'UTC', displayName: 'Tester' }),
    },
    day: {
      findMany: jest.fn().mockResolvedValue(overrides.days ?? []),
    },
    memory: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(overrides.memories ?? []) // recent reflections
        .mockResolvedValueOnce(overrides.patternMemories ?? []), // pattern memories
    },
    actionExecutionLog: {
      count: jest.fn().mockResolvedValue(overrides.rescheduleCount ?? 0),
    },
    goal: {
      findMany: jest.fn().mockResolvedValue(overrides.goals ?? []),
    },
    weeklyInsight: {
      upsert: jest.fn().mockImplementation(async ({ create }) => ({
        id: 'wi-1',
        weekStart: create.weekStart,
        weekEnd: create.weekEnd,
        isoYear: create.isoYear,
        isoWeek: create.isoWeek,
        score: create.score,
        completionRate: create.completionRate,
        totalTasks: create.totalTasks,
        completedTasks: create.completedTasks,
        reschedules: create.reschedules,
        topPatterns: create.topPatterns ?? [],
        focusSuggestion: create.focusSuggestion ?? null,
        narrative: create.narrative,
        source: create.source,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('computeIsoWeekBounds', () => {
  it('places Monday as start and Sunday as end (UTC)', () => {
    // Wednesday 2024-05-15 -> ISO week 20 of 2024.
    const reference = new Date('2024-05-15T12:00:00Z');
    const bounds = computeIsoWeekBounds(reference, 'UTC');
    expect(bounds.weekStart.toISOString().slice(0, 10)).toBe('2024-05-13'); // Monday
    expect(bounds.weekEnd.toISOString().slice(0, 10)).toBe('2024-05-19'); // Sunday
    expect(bounds.isoYear).toBe(2024);
    expect(bounds.isoWeek).toBe(20);
  });

  it('handles the year boundary (ISO week 53)', () => {
    // 2026-01-01 falls in ISO week 1 of 2026 (Thursday rule).
    const reference = new Date('2026-01-01T12:00:00Z');
    const bounds = computeIsoWeekBounds(reference, 'UTC');
    expect(bounds.isoYear).toBe(2026);
    expect(bounds.isoWeek).toBe(1);
  });
});

describe('WeeklyInsightService', () => {
  it('returns null and does not persist when the user has no activity', async () => {
    const prisma = buildPrismaStub();
    const ai = { generateWeeklyNarrative: jest.fn() };
    const memory = { ingest: jest.fn().mockResolvedValue(undefined) };

    const service = new WeeklyInsightService(
      prisma as unknown as never,
      ai as unknown as never,
      memory as unknown as never,
      buildFeatureAccess() as unknown as never,
    );
    const result = await service.generateForUser('user-1');
    expect(result).toBeNull();
    expect(prisma.weeklyInsight.upsert).not.toHaveBeenCalled();
    expect(memory.ingest).not.toHaveBeenCalled();
  });

  it('persists insights using the LLM narrative when available', async () => {
    const prisma = buildPrismaStub({
      days: [
        {
          id: 'd1',
          date: new Date(),
          startedAt: new Date(),
          endedAt: null,
          insight: { score: 7, summary: 'Solid day' },
          tasks: [
            {
              id: 't1',
              status: TaskStatus.DONE,
              priority: 'HIGH',
              createdAt: new Date(),
              updatedAt: new Date(),
              goalId: null,
            },
            {
              id: 't2',
              status: TaskStatus.TODO,
              priority: 'LOW',
              createdAt: new Date(),
              updatedAt: new Date(),
              goalId: null,
            },
          ],
        },
      ],
      patternMemories: [
        { tags: ['pattern', 'morning-productivity', 'energy'], content: 'morning peaks' },
      ],
    });
    const ai = {
      generateWeeklyNarrative: jest.fn().mockResolvedValue({
        narrative: 'You completed half of what you planned and noticed mornings are your peak.',
        focusSuggestion: 'Lock the first hour for high-impact work next week.',
        topPatterns: ['morning-productivity'],
      }),
    };
    const memory = { ingest: jest.fn().mockResolvedValue(undefined) };

    const service = new WeeklyInsightService(
      prisma as unknown as never,
      ai as unknown as never,
      memory as unknown as never,
      buildFeatureAccess() as unknown as never,
    );
    const result = await service.generateForUser('user-1');
    expect(result).not.toBeNull();
    expect(result?.totalTasks).toBe(2);
    expect(result?.completedTasks).toBe(1);
    expect(result?.topPatterns).toContain('morning-productivity');
    expect(prisma.weeklyInsight.upsert).toHaveBeenCalledTimes(1);
    expect(memory.ingest).toHaveBeenCalledTimes(1);
  });

  it('falls back to a deterministic narrative when the LLM payload is unusable', async () => {
    const prisma = buildPrismaStub({
      days: [
        {
          id: 'd1',
          date: new Date(),
          startedAt: new Date(),
          endedAt: null,
          insight: null,
          tasks: [
            {
              id: 't1',
              status: TaskStatus.DONE,
              priority: 'HIGH',
              createdAt: new Date(),
              updatedAt: new Date(),
              goalId: null,
            },
          ],
        },
      ],
    });
    const ai = { generateWeeklyNarrative: jest.fn().mockResolvedValue(null) };
    const memory = { ingest: jest.fn().mockResolvedValue(undefined) };

    const service = new WeeklyInsightService(
      prisma as unknown as never,
      ai as unknown as never,
      memory as unknown as never,
      buildFeatureAccess() as unknown as never,
    );
    const result = await service.generateForUser('user-1');
    expect(result).not.toBeNull();
    expect(result?.narrative).toContain('Tester');
    expect(result?.completionRate).toBeCloseTo(1);
  });
});
