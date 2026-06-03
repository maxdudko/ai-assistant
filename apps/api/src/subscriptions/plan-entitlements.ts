import type { Feature, PlanLimits, SubscriptionPlan } from '@ai/shared-types';

/** Runtime entitlement map — keep in sync with packages/shared-types plan catalog. */
export const PLAN_ENTITLEMENTS: Record<SubscriptionPlan, ReadonlySet<Feature>> = {
  FREE: new Set<Feature>(),
  PRO: new Set<Feature>(['ADVANCED_INSIGHTS', 'TRUTHLENS', 'CROSS_WEEK_ANALYSIS']),
};

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  FREE: { maxDigestTopics: 2 },
  PRO: { maxDigestTopics: 10 },
};

export const Features = {
  ADVANCED_INSIGHTS: 'ADVANCED_INSIGHTS',
  TRUTHLENS: 'TRUTHLENS',
  CROSS_WEEK_ANALYSIS: 'CROSS_WEEK_ANALYSIS',
} as const satisfies Record<string, Feature>;

export const FEATURE_LABELS: Record<Feature, string> = {
  ADVANCED_INSIGHTS: 'Advanced weekly insights',
  TRUTHLENS: 'TruthLens comparative digests',
  CROSS_WEEK_ANALYSIS: 'Cross-week trend analysis',
};

export const PLAN_CATALOG = [
  {
    plan: 'FREE' as SubscriptionPlan,
    label: 'Free',
    description: 'Core assistant features for daily planning and chat.',
    features: [] as Feature[],
    limits: PLAN_LIMITS.FREE,
  },
  {
    plan: 'PRO' as SubscriptionPlan,
    label: 'Pro',
    description: 'Advanced insights, TruthLens digests, and cross-week analysis.',
    features: Array.from(PLAN_ENTITLEMENTS.PRO),
    limits: PLAN_LIMITS.PRO,
  },
];
