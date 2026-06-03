export const FeatureValues = {
  ADVANCED_INSIGHTS: 'ADVANCED_INSIGHTS',
  TRUTHLENS: 'TRUTHLENS',
  CROSS_WEEK_ANALYSIS: 'CROSS_WEEK_ANALYSIS',
} as const;

export type Feature = (typeof FeatureValues)[keyof typeof FeatureValues];
