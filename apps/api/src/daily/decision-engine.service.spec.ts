import { DayPhase, DayState, TaskStatus } from '@prisma/client';

import { DecisionEngineService } from './decision-engine.service';
import type { DecisionContext } from './decision.types';

describe('DecisionEngineService', () => {
  const service = new DecisionEngineService();
  const baseNow = new Date('2026-04-06T15:00:00.000Z');

  function createContext(partial?: Partial<DecisionContext>): DecisionContext {
    return {
      userId: 'user-1',
      event: { type: 'TIME_TRIGGER' },
      day: {
        id: 'day-1',
        state: DayState.ACTIVE,
        phase: DayPhase.EXECUTION,
        date: new Date('2026-04-06T00:00:00.000Z'),
        startedAt: new Date('2026-04-06T08:00:00.000Z'),
        endedAt: null,
        lastActivityAt: new Date('2026-04-06T12:00:00.000Z'),
        morningBriefingSentAt: new Date('2026-04-06T08:00:00.000Z'),
        eveningReflectionSentAt: null,
        planningSuggestionSentAt: null,
        noProgressNudgeSentAt: null,
        stuckTaskNudgeSentAt: null,
      },
      tasks: [],
      patterns: [],
      now: baseNow,
      localHour: 15,
      allowEveningReflection: true,
      ...partial,
    };
  }

  it('returns morning message on day start when not started', () => {
    const result = service.evaluate(
      createContext({
        event: { type: 'DAY_START' },
        day: {
          ...createContext().day,
          phase: DayPhase.NOT_STARTED,
          morningBriefingSentAt: null,
        },
      }),
    );

    expect(result.action?.type).toBe('SEND_MESSAGE');
    expect(result.nextPhase).toBe(DayPhase.MORNING);
    expect(result.reason).toBe('MORNING_START');
  });

  it('prioritizes NO_PROGRESS over STUCK_TASK', () => {
    const result = service.evaluate(
      createContext({
        day: {
          ...createContext().day,
          phase: DayPhase.EXECUTION,
        },
        localHour: 16,
        tasks: [
          {
            id: 'task-1',
            name: 'Long task',
            status: TaskStatus.IN_PROGRESS,
            updatedAt: new Date(baseNow.getTime() - 4 * 60 * 60 * 1000),
            priority: 'HIGH',
            deadline: null,
            createdAt: new Date(baseNow.getTime() - 5 * 60 * 60 * 1000),
          },
        ],
      }),
    );

    expect(result.action?.type).toBe('SEND_NUDGE');
    if (result.action?.type === 'SEND_NUDGE') {
      expect(result.action.nudge.type).toBe('NO_PROGRESS');
      expect(result.action.action?.type).toBe('RESCHEDULE_TASK');
    }
    expect(result.reason).toBe('NO_PROGRESS');
  });

  it('returns PLAN_OVERLOAD in planning phase with overcommitment pattern', () => {
    const result = service.evaluate(
      createContext({
        event: { type: 'USER_ACTIVITY' },
        day: {
          ...createContext().day,
          phase: DayPhase.PLANNING,
        },
        tasks: Array.from({ length: 6 }, (_, i) => ({
          id: `task-${i}`,
          name: `Task ${i}`,
          status: TaskStatus.TODO,
          updatedAt: baseNow,
          priority: 'MEDIUM',
          deadline: null,
          createdAt: baseNow,
        })),
        patterns: [{ content: 'You overcommit often', tags: ['overcommitment'] }],
      }),
    );

    expect(result.action?.type).toBe('SEND_NUDGE');
    if (result.action?.type === 'SEND_NUDGE') {
      expect(result.action.nudge.type).toBe('PLAN_OVERLOAD');
      expect(result.action.action?.type).toBe('SIMPLIFY_DAY');
    }
  });

  it('attaches split action for stuck task when no-progress is not applicable', () => {
    const result = service.evaluate(
      createContext({
        day: {
          ...createContext().day,
          phase: DayPhase.EXECUTION,
        },
        localHour: 11,
        tasks: [
          {
            id: 'task-done',
            name: 'Done task',
            status: TaskStatus.DONE,
            updatedAt: new Date(baseNow.getTime() - 5 * 60 * 60 * 1000),
            priority: 'HIGH',
            deadline: null,
            createdAt: new Date(baseNow.getTime() - 6 * 60 * 60 * 1000),
          },
          {
            id: 'task-stuck',
            name: 'Stuck task',
            status: TaskStatus.IN_PROGRESS,
            updatedAt: new Date(baseNow.getTime() - 4 * 60 * 60 * 1000),
            priority: 'MEDIUM',
            deadline: null,
            createdAt: new Date(baseNow.getTime() - 6 * 60 * 60 * 1000),
          },
        ],
      }),
    );

    expect(result.action?.type).toBe('SEND_NUDGE');
    if (result.action?.type === 'SEND_NUDGE') {
      expect(result.action.nudge.type).toBe('STUCK_TASK');
      expect(result.action.action?.type).toBe('SPLIT_TASK');
    }
    expect(result.reason).toBe('STUCK_TASK');
  });

  it('blocks invalid phase transition', () => {
    const result = service.evaluate(
      createContext({
        event: { type: 'DAY_START' },
        day: {
          ...createContext().day,
          phase: DayPhase.EXECUTION,
          morningBriefingSentAt: null,
        },
      }),
    );

    expect(result.action?.type).toBe('NO_OP');
  });

  it('returns phase-only progression for user activity in planning', () => {
    const result = service.evaluate(
      createContext({
        event: { type: 'USER_ACTIVITY' },
        day: {
          ...createContext().day,
          phase: DayPhase.PLANNING,
        },
      }),
    );

    expect(result.action?.type).toBe('NO_OP');
    expect(result.nextPhase).toBe(DayPhase.EXECUTION);
  });
});
