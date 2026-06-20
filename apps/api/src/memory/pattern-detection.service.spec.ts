import { TaskStatus } from '@prisma/client';

import { PatternDetectionService } from './pattern-detection.service';

type DayRow = {
  id: string;
  date: Date;
  tasks: Array<{ id: string; status: TaskStatus; createdAt: Date; updatedAt: Date }>;
};

function makeDay(daysAgo: number, tasks: DayRow['tasks']): DayRow {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return { id: `day-${daysAgo}`, date, tasks };
}

function makeTask(
  status: TaskStatus,
  hour: number,
  options: { ageDays?: number; id?: string } = {},
) {
  const ageDays = options.ageDays ?? 0;
  const updatedAt = new Date();
  updatedAt.setDate(updatedAt.getDate() - ageDays);
  updatedAt.setHours(hour, 0, 0, 0);
  const createdAt = new Date(updatedAt);
  createdAt.setDate(createdAt.getDate() - ageDays);
  return {
    id: options.id ?? `task-${Math.random().toString(36).slice(2)}`,
    status,
    createdAt,
    updatedAt,
  };
}

describe('PatternDetectionService', () => {
  it('detects overload pattern with backward-compatible overcommitment tag', async () => {
    const ingest = jest.fn().mockResolvedValue(undefined);
    const days = [
      makeDay(0, [
        makeTask(TaskStatus.DONE, 9),
        makeTask(TaskStatus.TODO, 10),
        makeTask(TaskStatus.TODO, 10),
        makeTask(TaskStatus.TODO, 11),
        makeTask(TaskStatus.TODO, 11),
        makeTask(TaskStatus.IN_PROGRESS, 11),
      ]),
      makeDay(1, [
        makeTask(TaskStatus.DONE, 9),
        makeTask(TaskStatus.TODO, 10),
        makeTask(TaskStatus.TODO, 10),
        makeTask(TaskStatus.TODO, 11),
        makeTask(TaskStatus.TODO, 11),
        makeTask(TaskStatus.IN_PROGRESS, 11),
      ]),
      makeDay(2, [
        makeTask(TaskStatus.DONE, 9),
        makeTask(TaskStatus.TODO, 10),
        makeTask(TaskStatus.TODO, 10),
        makeTask(TaskStatus.TODO, 11),
        makeTask(TaskStatus.TODO, 11),
        makeTask(TaskStatus.IN_PROGRESS, 11),
      ]),
    ];

    const prisma = {
      day: { findMany: jest.fn().mockResolvedValue(days) },
      memory: { findMany: jest.fn().mockResolvedValue([]) },
      actionExecutionLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PatternDetectionService(
      prisma as unknown as never,
      { ingest } as unknown as never,
    );

    const generated = await service.detectForUser('user-1');
    expect(generated).toBeGreaterThanOrEqual(1);
    const candidates = ingest.mock.calls[0][1];
    const overload = candidates.find((candidate: { tags?: string[] }) =>
      candidate.tags?.includes('overload'),
    );
    expect(overload).toBeDefined();
    // Backward compat: overcommitment tag still present.
    expect(overload.tags).toContain('overcommitment');
  });

  it('detects procrastination from repeated reschedules', async () => {
    const ingest = jest.fn().mockResolvedValue(undefined);
    const days = [makeDay(0, [makeTask(TaskStatus.DONE, 11)])];
    const reschedules = [
      { payload: { taskId: 'task-a' } },
      { payload: { taskId: 'task-a' } },
      { payload: { taskId: 'task-b' } },
      { payload: { taskId: 'task-b' } },
      { payload: { taskId: 'task-b' } },
    ];

    const prisma = {
      day: { findMany: jest.fn().mockResolvedValue(days) },
      memory: { findMany: jest.fn().mockResolvedValue([]) },
      actionExecutionLog: { findMany: jest.fn().mockResolvedValue(reschedules) },
    };
    const service = new PatternDetectionService(
      prisma as unknown as never,
      { ingest } as unknown as never,
    );

    await service.detectForUser('user-1');
    const candidates = ingest.mock.calls[0][1];
    const procrastination = candidates.find((candidate: { tags?: string[] }) =>
      candidate.tags?.includes('procrastination'),
    );
    expect(procrastination).toBeDefined();
    expect(procrastination.layer).toBe('PATTERN');
  });

  it('detects evening productivity peak when most completions land 18-22', async () => {
    const ingest = jest.fn().mockResolvedValue(undefined);
    // 6 evening completions, 1 morning, 1 afternoon -> evening dominance > 0.55
    const tasks = [
      makeTask(TaskStatus.DONE, 19),
      makeTask(TaskStatus.DONE, 19),
      makeTask(TaskStatus.DONE, 20),
      makeTask(TaskStatus.DONE, 20),
      makeTask(TaskStatus.DONE, 21),
      makeTask(TaskStatus.DONE, 21),
      makeTask(TaskStatus.DONE, 9),
      makeTask(TaskStatus.DONE, 14),
    ];
    const days = [makeDay(0, tasks)];
    const prisma = {
      day: { findMany: jest.fn().mockResolvedValue(days) },
      memory: { findMany: jest.fn().mockResolvedValue([]) },
      actionExecutionLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PatternDetectionService(
      prisma as unknown as never,
      { ingest } as unknown as never,
    );

    await service.detectForUser('user-1');
    const candidates = ingest.mock.calls[0][1] as Array<{ tags?: string[] }>;
    const evening = candidates.find(candidate => candidate.tags?.includes('evening-productivity'));
    expect(evening).toBeDefined();
  });

  it('skips a pattern that was already produced this week', async () => {
    const ingest = jest.fn().mockResolvedValue(undefined);
    const days = [makeDay(0, [makeTask(TaskStatus.DONE, 9), makeTask(TaskStatus.DONE, 10)])];
    const prisma = {
      day: { findMany: jest.fn().mockResolvedValue(days) },
      memory: {
        findMany: jest.fn().mockResolvedValue([
          {
            tags: ['pattern', 'morning-productivity', 'energy'],
            createdAt: new Date(),
          },
        ]),
      },
      actionExecutionLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PatternDetectionService(
      prisma as unknown as never,
      { ingest } as unknown as never,
    );

    const generated = await service.detectForUser('user-1');
    expect(generated).toBe(0);
    expect(ingest).not.toHaveBeenCalled();
  });
});
