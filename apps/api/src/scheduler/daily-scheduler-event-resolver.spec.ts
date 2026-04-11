import { DailySchedulerEventResolver } from './daily-scheduler-event-resolver';

describe('DailySchedulerEventResolver', () => {
  const resolver = new DailySchedulerEventResolver();
  const now = new Date('2026-04-11T12:00:00.000Z');

  it('returns INACTIVITY when inactivity and time trigger both apply', () => {
    const event = resolver.resolve({
      now,
      lastActivityAt: new Date('2026-04-11T09:00:00.000Z'),
      dayPlanningTime: 'morning',
      reflectionTime: 'evening',
      helpStyle: 'active',
    });

    expect(event.type).toBe('INACTIVITY');
  });

  it('returns TIME_TRIGGER for active users', () => {
    const event = resolver.resolve({
      now,
      lastActivityAt: new Date('2026-04-11T11:30:00.000Z'),
      dayPlanningTime: 'morning',
      reflectionTime: 'evening',
      helpStyle: 'active',
    });

    expect(event.type).toBe('TIME_TRIGGER');
  });
});
