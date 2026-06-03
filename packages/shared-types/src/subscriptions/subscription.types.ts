export const SubscriptionPlanValues = {
  FREE: 'FREE',
  PRO: 'PRO',
} as const;

export type SubscriptionPlan = (typeof SubscriptionPlanValues)[keyof typeof SubscriptionPlanValues];

export const SubscriptionStatusValues = {
  ACTIVE: 'ACTIVE',
  TRIALING: 'TRIALING',
  PAST_DUE: 'PAST_DUE',
  CANCELED: 'CANCELED',
  INCOMPLETE: 'INCOMPLETE',
} as const;

export type SubscriptionStatus =
  (typeof SubscriptionStatusValues)[keyof typeof SubscriptionStatusValues];

export interface SubscriptionSummary {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  createdAt: string;
  updatedAt: string;
}
