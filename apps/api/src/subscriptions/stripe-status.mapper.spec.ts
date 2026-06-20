import { mapStripeSubscriptionStatus } from './stripe-status.mapper';

describe('mapStripeSubscriptionStatus', () => {
  it('maps known Stripe statuses', () => {
    expect(mapStripeSubscriptionStatus('active')).toBe('ACTIVE');
    expect(mapStripeSubscriptionStatus('trialing')).toBe('TRIALING');
    expect(mapStripeSubscriptionStatus('past_due')).toBe('PAST_DUE');
    expect(mapStripeSubscriptionStatus('canceled')).toBe('CANCELED');
    expect(mapStripeSubscriptionStatus('unpaid')).toBe('PAST_DUE');
    expect(mapStripeSubscriptionStatus('incomplete')).toBe('INCOMPLETE');
    expect(mapStripeSubscriptionStatus('incomplete_expired')).toBe('INCOMPLETE');
  });

  it('defaults unknown statuses to INCOMPLETE', () => {
    expect(mapStripeSubscriptionStatus('paused')).toBe('INCOMPLETE');
  });
});
