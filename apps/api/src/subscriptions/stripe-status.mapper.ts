import type { SubscriptionStatus } from '@ai/shared-types';

/** Maps Stripe subscription status strings to internal enum values. */
export function mapStripeSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return 'ACTIVE';
    case 'trialing':
      return 'TRIALING';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELED';
    case 'unpaid':
      return 'PAST_DUE';
    case 'incomplete':
    case 'incomplete_expired':
      return 'INCOMPLETE';
    default:
      return 'INCOMPLETE';
  }
}
