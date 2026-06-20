import {
  SubscriptionPlanValues,
  type SubscriptionPlan,
} from '../subscriptions/subscription.types.js';

import { FeatureValues, type Feature } from './feature.types.js';

export interface PlanLimits {
  maxDigestTopics: number;
}

/** Central plan → feature mapping for clients and documentation. */
export const PLAN_ENTITLEMENTS: Record<SubscriptionPlan, ReadonlySet<Feature>> = {
  [SubscriptionPlanValues.FREE]: new Set<Feature>(),
  [SubscriptionPlanValues.PRO]: new Set<Feature>([
    FeatureValues.ADVANCED_INSIGHTS,
    FeatureValues.TRUTHLENS,
    FeatureValues.CROSS_WEEK_ANALYSIS,
  ]),
};

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  [SubscriptionPlanValues.FREE]: { maxDigestTopics: 2 },
  [SubscriptionPlanValues.PRO]: { maxDigestTopics: 10 },
};

export const PLAN_CATALOG: Array<{
  plan: SubscriptionPlan;
  label: string;
  description: string;
  features: Feature[];
  limits: PlanLimits;
}> = [
  {
    plan: SubscriptionPlanValues.FREE,
    label: 'Free',
    description: 'Core assistant features for daily planning and chat.',
    features: [],
    limits: PLAN_LIMITS[SubscriptionPlanValues.FREE],
  },
  {
    plan: SubscriptionPlanValues.PRO,
    label: 'Pro',
    description: 'Advanced insights, TruthLens digests, and cross-week analysis.',
    features: Array.from(PLAN_ENTITLEMENTS[SubscriptionPlanValues.PRO]),
    limits: PLAN_LIMITS[SubscriptionPlanValues.PRO],
  },
];

export const FEATURE_LABELS: Record<Feature, string> = {
  [FeatureValues.ADVANCED_INSIGHTS]: 'Advanced weekly insights',
  [FeatureValues.TRUTHLENS]: 'TruthLens comparative digests',
  [FeatureValues.CROSS_WEEK_ANALYSIS]: 'Cross-week trend analysis',
};
