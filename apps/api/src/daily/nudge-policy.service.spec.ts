import { NudgePriority } from '@prisma/client';

import { NudgePolicyService } from './nudge-policy.service';
import { NudgeType } from './nudge.types';

describe('NudgePolicyService', () => {
  const createService = () => {
    const prisma = {
      day: {
        findUnique: jest.fn(),
      },
      nudgeEvent: {
        findFirst: jest.fn(),
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
        findUnique: jest
          .fn()
          .mockResolvedValue({
            nudgesSentToday: 0,
            lastNudgeAt: new Date('2026-04-10T06:00:00.000Z'),
          }),
      },
      nudgeEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      userProfile: {
        findUnique: jest.fn(),
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
});
