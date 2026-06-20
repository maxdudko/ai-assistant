import { DailyFlowScheduler } from './daily-flow.scheduler';
import { DailySchedulerEventResolver } from './daily-scheduler-event-resolver';

describe('DailyFlowScheduler', () => {
  const now = new Date('2026-04-11T12:00:00.000Z');

  function createScheduler() {
    const prisma = {
      userProfile: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-1',
            timezone: 'UTC',
            dayPlanningTime: 'anytime',
            reflectionTime: 'anytime',
            helpStyle: 'active',
          },
        ]),
      },
      day: {
        findUnique: jest.fn().mockResolvedValue({
          lastActivityAt: new Date('2026-04-11T11:50:00.000Z'),
        }),
      },
    } as any;
    const patternDetection = {
      runDailyForAllUsers: jest.fn(),
      decayStaleMemories: jest.fn(),
    } as any;
    const dailyEngine = {
      handleEvent: jest.fn().mockResolvedValue({ actions: 0 }),
    } as any;
    const eventResolver = {
      resolve: jest.fn().mockReturnValue({ type: 'TIME_TRIGGER' }),
    } as unknown as DailySchedulerEventResolver;

    const scheduler = new DailyFlowScheduler(prisma, patternDetection, dailyEngine, eventResolver);

    return {
      scheduler,
      prisma,
      dailyEngine,
      eventResolver,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('fires only INACTIVITY when resolver selects inactivity', async () => {
    const { scheduler, dailyEngine, eventResolver } = createScheduler();
    (eventResolver.resolve as jest.Mock).mockReturnValue({ type: 'INACTIVITY' });

    await scheduler.runTimeTriggers('all');

    expect(dailyEngine.handleEvent).toHaveBeenCalledTimes(1);
    expect(dailyEngine.handleEvent).toHaveBeenCalledWith('user-1', { type: 'INACTIVITY' }, now);
  });

  it('fires only TIME_TRIGGER for active users', async () => {
    const { scheduler, dailyEngine, eventResolver } = createScheduler();
    (eventResolver.resolve as jest.Mock).mockReturnValue({ type: 'TIME_TRIGGER' });

    await scheduler.runTimeTriggers('all');

    expect(dailyEngine.handleEvent).toHaveBeenCalledTimes(1);
    expect(dailyEngine.handleEvent).toHaveBeenCalledWith('user-1', { type: 'TIME_TRIGGER' }, now);
  });

  it('never emits two events in a single tick', async () => {
    const { scheduler, prisma, dailyEngine } = createScheduler();
    prisma.userProfile.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        timezone: 'UTC',
        dayPlanningTime: 'anytime',
        reflectionTime: 'anytime',
        helpStyle: 'active',
      },
      {
        userId: 'user-2',
        timezone: 'UTC',
        dayPlanningTime: 'anytime',
        reflectionTime: 'anytime',
        helpStyle: 'active',
      },
    ]);

    await scheduler.runTimeTriggers('all');

    expect(dailyEngine.handleEvent).toHaveBeenCalledTimes(2);
  });
});
