import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import type { Feature, PlanLimits, SubscriptionPlan, SubscriptionStatus } from '@ai/shared-types';

import { PrismaService } from '../prisma/prisma.service';

import { SubscriptionsService } from './subscriptions.service';
import { ALL_FEATURES, PLAN_ENTITLEMENTS, PLAN_LIMITS } from './plan-entitlements';

const ACTIVE_STATUSES = new Set<SubscriptionStatus>(['ACTIVE', 'TRIALING']);

@Injectable()
export class FeatureAccessService {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly prisma: PrismaService,
  ) {}

  async canUse(userId: string, feature: Feature): Promise<boolean> {
    const subscription = await this.subscriptions.getOrCreateForUser(userId);
    return this.resolveFeatureEnabled(userId, subscription, feature);
  }

  async assertCanUse(userId: string, feature: Feature): Promise<void> {
    const allowed = await this.canUse(userId, feature);
    if (!allowed) {
      throw new ForbiddenException(`Feature "${feature}" requires an active Pro subscription.`);
    }
  }

  async getEffectivePlan(userId: string): Promise<SubscriptionPlan> {
    const subscription = await this.subscriptions.getOrCreateForUser(userId);
    return this.resolveEffectivePlan(subscription);
  }

  async getPlanLimits(userId: string): Promise<PlanLimits> {
    const plan = await this.getEffectivePlan(userId);
    return PLAN_LIMITS[plan];
  }

  async listEnabledFeatures(userId: string): Promise<Feature[]> {
    const subscription = await this.subscriptions.getOrCreateForUser(userId);
    return ALL_FEATURES.filter(feature =>
      this.resolveFeatureEnabled(userId, subscription, feature),
    );
  }

  async listOverrides(userId: string): Promise<Array<{ feature: Feature; allowed: boolean }>> {
    const rows = await this.prisma.userFeatureOverride.findMany({
      where: { userId },
      orderBy: { feature: 'asc' },
    });
    return rows.map(row => ({
      feature: row.feature as Feature,
      allowed: row.allowed,
    }));
  }

  async setOverrides(
    userId: string,
    overrides: Array<{ feature: Feature; allowed: boolean }>,
  ): Promise<Array<{ feature: Feature; allowed: boolean }>> {
    await this.prisma.$transaction([
      this.prisma.userFeatureOverride.deleteMany({ where: { userId } }),
      ...(overrides.length > 0
        ? [
            this.prisma.userFeatureOverride.createMany({
              data: overrides.map(override => ({
                userId,
                feature: override.feature,
                allowed: override.allowed,
              })),
            }),
          ]
        : []),
    ]);

    return this.listOverrides(userId);
  }

  canUseWithSubscription(
    subscription: Subscription,
    feature: Feature,
    overrides: Map<Feature, boolean>,
  ): boolean {
    if (overrides.has(feature)) {
      return overrides.get(feature)!;
    }
    if (!this.isActive(subscription.status)) {
      return false;
    }
    const plan = this.resolveEffectivePlan(subscription);
    return PLAN_ENTITLEMENTS[plan].has(feature);
  }

  resolveEffectivePlan(subscription: Subscription): SubscriptionPlan {
    if (!this.isActive(subscription.status)) {
      return 'FREE';
    }
    return subscription.plan as SubscriptionPlan;
  }

  planGrantsFeature(subscription: Subscription, feature: Feature): boolean {
    if (!this.isActive(subscription.status)) {
      return false;
    }
    const plan = subscription.plan as SubscriptionPlan;
    return PLAN_ENTITLEMENTS[plan].has(feature);
  }

  private async resolveFeatureEnabled(
    userId: string,
    subscription: Subscription,
    feature: Feature,
  ): Promise<boolean> {
    const overrides = await this.getOverrideMap(userId);
    return this.canUseWithSubscription(subscription, feature, overrides);
  }

  private async getOverrideMap(userId: string): Promise<Map<Feature, boolean>> {
    const rows = await this.prisma.userFeatureOverride.findMany({
      where: { userId },
    });
    return new Map(rows.map(row => [row.feature as Feature, row.allowed]));
  }

  private isActive(status: Subscription['status']): boolean {
    return ACTIVE_STATUSES.has(status as SubscriptionStatus);
  }
}
