import { TaskPriority, TaskStatus } from '@prisma/client';

import { TaskScoringService } from './task-scoring.service';

describe('TaskScoringService', () => {
  let service: TaskScoringService;

  beforeEach(() => {
    service = new TaskScoringService();
  });

  it('scores urgent high-priority low-difficulty tasks highest', () => {
    const now = new Date('2026-04-06T09:00:00.000Z');
    const urgentHigh = service.scoreTask(
      {
        id: 'task-1',
        name: 'Urgent',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        difficulty: 1,
        estimatedMinutes: 45,
        deadline: new Date('2026-04-06T12:00:00.000Z'),
      },
      { now },
    );
    const laterLow = service.scoreTask(
      {
        id: 'task-2',
        name: 'Later',
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        difficulty: 5,
        estimatedMinutes: 45,
        deadline: new Date('2026-04-09T09:00:00.000Z'),
      },
      { now },
    );

    expect(urgentHigh).toBeGreaterThan(laterLow);
  });

  it('computes daily load from estimated or fallback difficulty minutes', () => {
    const total = service.totalEstimatedTime([
      {
        id: 'task-1',
        name: 'Explicit estimate',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        estimatedMinutes: 30,
      },
      {
        id: 'task-2',
        name: 'Difficulty fallback',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        difficulty: 4,
      },
      {
        id: 'task-3',
        name: 'Completed',
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        estimatedMinutes: 100,
      },
    ]);

    expect(total).toBe(105);
  });

  it('returns top tasks with a high-impact item and quick wins', () => {
    const top = service.getTopTasks(
      [
        {
          id: 'high-impact',
          name: 'Core project push',
          status: TaskStatus.TODO,
          priority: TaskPriority.HIGH,
          difficulty: 4,
          estimatedMinutes: 120,
        },
        {
          id: 'quick-1',
          name: 'Reply to stakeholder',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          difficulty: 1,
          estimatedMinutes: 20,
        },
        {
          id: 'quick-2',
          name: 'Clean inbox labels',
          status: TaskStatus.TODO,
          priority: TaskPriority.LOW,
          difficulty: 1,
          estimatedMinutes: 15,
        },
      ],
      { limit: 2 },
    );

    const ids = top.map(task => task.id);
    expect(ids).toContain('high-impact');
    expect(ids.some(id => id.startsWith('quick-'))).toBe(true);
  });

  it('prioritizes heavy work when morning-focus is active', () => {
    const top = service.getTopTasks(
      [
        {
          id: 'heavy',
          name: 'Deep architecture task',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          difficulty: 5,
          estimatedMinutes: 120,
        },
        {
          id: 'quick',
          name: 'Quick inbox cleanup',
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          difficulty: 1,
          estimatedMinutes: 15,
        },
      ],
      { limit: 1, morningFocus: true, includeHighImpact: false },
    );

    expect(top[0]?.id).toBe('heavy');
  });
});
