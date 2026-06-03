import { Prisma } from '@prisma/client';

import { StripeWebhookService } from './stripe-webhook.service';

function buildBillingHistoryMock() {
  return {
    upsertPaymentFromInvoice: jest.fn().mockResolvedValue(undefined),
    recordEvent: jest.fn().mockResolvedValue(undefined),
  };
}

function buildStripeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_stripe_1',
    customer: 'cus_1',
    status: 'active',
    metadata: { userId: 'user-1' },
    items: {
      data: [
        {
          price: { id: 'price_pro' },
          current_period_start: 1_700_000_000,
          current_period_end: 1_700_086_400,
        },
      ],
    },
    cancel_at_period_end: false,
    trial_end: null,
    ...overrides,
  };
}

describe('StripeWebhookService', () => {
  const originalProPriceId = process.env.STRIPE_PRO_PRICE_ID;

  beforeAll(() => {
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
  });

  afterAll(() => {
    process.env.STRIPE_PRO_PRICE_ID = originalProPriceId;
  });

  it('skips duplicate Stripe events', async () => {
    const prisma = {
      stripeWebhookEvent: {
        create: jest
          .fn()
          .mockRejectedValueOnce(
            new Prisma.PrismaClientKnownRequestError('dup', {
              code: 'P2002',
              clientVersion: 'test',
            }),
          ),
      },
    };
    const service = new StripeWebhookService(
      prisma as never,
      { retrieveSubscription: jest.fn() } as never,
      { applyStripeSubscriptionUpdate: jest.fn() } as never,
      buildBillingHistoryMock() as never,
    );

    await service.handleEvent({
      id: 'evt_1',
      type: 'customer.subscription.updated',
      data: { object: {} },
    } as never);

    expect(prisma.stripeWebhookEvent.create).toHaveBeenCalledTimes(1);
  });

  it('syncs subscription.updated into applyStripeSubscriptionUpdate', async () => {
    const applyStripeSubscriptionUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      stripeWebhookEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new StripeWebhookService(
      prisma as never,
      { retrieveSubscription: jest.fn() } as never,
      {
        applyStripeSubscriptionUpdate,
        getOrCreateForUser: jest.fn().mockResolvedValue({
          userId: 'user-1',
          plan: 'FREE',
          status: 'ACTIVE',
        }),
        findByStripeCustomerId: jest.fn(),
        findByStripeSubscriptionId: jest.fn(),
        revertToFree: jest.fn(),
        markPastDue: jest.fn(),
      } as never,
      buildBillingHistoryMock() as never,
    );

    await service.handleEvent({
      id: 'evt_2',
      type: 'customer.subscription.updated',
      data: { object: buildStripeSubscription() },
    } as never);

    expect(applyStripeSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        plan: 'PRO',
        status: 'ACTIVE',
        stripeSubscriptionId: 'sub_stripe_1',
      }),
    );
  });

  it('reverts to free on subscription.deleted', async () => {
    const revertToFree = jest.fn().mockResolvedValue({});
    const billingHistory = buildBillingHistoryMock();
    const prisma = {
      stripeWebhookEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new StripeWebhookService(
      prisma as never,
      { retrieveSubscription: jest.fn() } as never,
      {
        applyStripeSubscriptionUpdate: jest.fn(),
        findByStripeCustomerId: jest.fn(),
        findByStripeSubscriptionId: jest.fn().mockResolvedValue({ userId: 'user-1' }),
        revertToFree,
        markPastDue: jest.fn(),
      } as never,
      billingHistory as never,
    );

    await service.handleEvent({
      id: 'evt_3',
      type: 'customer.subscription.deleted',
      data: { object: buildStripeSubscription({ status: 'canceled' }) },
    } as never);

    expect(revertToFree).toHaveBeenCalledWith('user-1');
    expect(billingHistory.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', type: 'CANCELED' }),
    );
  });
});
