import { Test, TestingModule } from '@nestjs/testing';
import type { Subscription } from '@prisma/client';

import { FeatureAccessService } from './feature-access.service';
import { Features } from './plan-entitlements';
import { SubscriptionsService } from './subscriptions.service';

function buildSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    userId: 'user-1',
    plan: 'FREE',
    status: 'ACTIVE',
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    trialEnd: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as Subscription;
}

describe('FeatureAccessService', () => {
  let service: FeatureAccessService;
  let subscriptions: { getOrCreateForUser: jest.Mock };

  beforeEach(async () => {
    subscriptions = {
      getOrCreateForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FeatureAccessService, { provide: SubscriptionsService, useValue: subscriptions }],
    }).compile();

    service = module.get(FeatureAccessService);
  });

  it('denies premium features on the free plan', async () => {
    subscriptions.getOrCreateForUser.mockResolvedValue(buildSubscription());

    await expect(service.canUse('user-1', Features.TRUTHLENS)).resolves.toBe(false);
    await expect(service.canUse('user-1', Features.ADVANCED_INSIGHTS)).resolves.toBe(false);
  });

  it('allows pro features for active pro subscriptions', async () => {
    subscriptions.getOrCreateForUser.mockResolvedValue(buildSubscription({ plan: 'PRO' }));

    await expect(service.canUse('user-1', Features.TRUTHLENS)).resolves.toBe(true);
    await expect(service.canUse('user-1', Features.CROSS_WEEK_ANALYSIS)).resolves.toBe(true);
  });

  it('treats canceled subscriptions as free for entitlements', async () => {
    subscriptions.getOrCreateForUser.mockResolvedValue(
      buildSubscription({
        plan: 'PRO',
        status: 'CANCELED',
      }),
    );

    await expect(service.canUse('user-1', Features.TRUTHLENS)).resolves.toBe(false);
    await expect(service.getEffectivePlan('user-1')).resolves.toBe('FREE');
  });

  it('returns plan limits from the effective plan', async () => {
    subscriptions.getOrCreateForUser.mockResolvedValue(buildSubscription({ plan: 'PRO' }));

    await expect(service.getPlanLimits('user-1')).resolves.toEqual({ maxDigestTopics: 10 });
  });
});
