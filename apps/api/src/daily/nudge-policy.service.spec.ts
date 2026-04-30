import { NudgePriority } from '@prisma/client';

import { NudgePolicyService } from './nudge-policy.service';
import { NudgeType } from './nudge.types';

describe('NudgePolicyService', () => {
  const createService = () => {
    const prisma = {
      day: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      nudgeEvent: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      userProfile: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;
    const dayResolver = {
      getDayForMomentTx: jest.fn(),
    } as any;
    return {
      service: new NudgePolicyService(prisma, dayResolver),
      prisma,
      dayResolver,
    };
  };

  it('resolves day id through the provided transaction client', async () => {
    const { service, dayResolver } = createService();
    const tx = {
      day: {
        findUnique: jest.fn().mockResolvedValue({
          nudgesSentToday: 0,
          lastNudgeAt: new Date('2026-04-10T06:00:00.000Z'),
        }),
      },
      nudgeEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      userProfile: {
        findUnique: jest.fn().mockResolvedValue({ helpStyle: 'active' }),
      },
    } as any;
    const now = new Date('2026-04-10T12:00:00.000Z');
    dayResolver.getDayForMomentTx.mockResolvedValue({ id: 'day-1' });

    const allowed = await service.shouldSendNudge(
      'user-1',
      {
        type: NudgeType.PLAN_OVERLOAD,
        priority: NudgePriority.MEDIUM,
        createdAt: now,
      },
      { client: tx },
    );

    expect(allowed).toBe(true);
    expect(dayResolver.getDayForMomentTx).toHaveBeenCalledWith('user-1', now, tx);
  });

  it('allows more nudges for proactive users', async () => {
    const { service, prisma, dayResolver } = createService();
    const now = new Date('2026-04-10T12:00:00.000Z');
    dayResolver.getDayForMomentTx.mockResolvedValue({ id: 'day-1' });
    prisma.day.findUnique.mockResolvedValue({
      nudgesSentToday: 3,
      lastNudgeAt: new Date('2026-04-10T08:00:00.000Z'),
      lastActivityAt: new Date('2026-04-10T10:00:00.000Z'),
    });
    prisma.userProfile.findUnique.mockResolvedValue({ helpStyle: 'proactive' });
    prisma.nudgeEvent.findFirst.mockResolvedValue(null);

    const allowed = await service.shouldSendNudge('user-1', {
      type: NudgeType.PLAN_OVERLOAD,
      priority: NudgePriority.MEDIUM,
      createdAt: now,
    });

    expect(allowed).toBe(true);
  });

  it('suppresses passive users with recent activity for non-high nudges', async () => {
    const { service, prisma, dayResolver } = createService();
    const now = new Date('2026-04-10T12:00:00.000Z');
    dayResolver.getDayForMomentTx.mockResolvedValue({ id: 'day-1' });
    prisma.day.findUnique.mockResolvedValue({
      nudgesSentToday: 0,
      lastNudgeAt: new Date('2026-04-10T08:00:00.000Z'),
      lastActivityAt: new Date('2026-04-10T11:45:00.000Z'),
    });
    prisma.userProfile.findUnique.mockResolvedValue({ helpStyle: 'passive' });
    prisma.nudgeEvent.findFirst.mockResolvedValue(null);

    const allowed = await service.shouldSendNudge('user-1', {
      type: NudgeType.PLAN_OVERLOAD,
      priority: NudgePriority.MEDIUM,
      createdAt: now,
    });

    expect(allowed).toBe(false);
  });
});
