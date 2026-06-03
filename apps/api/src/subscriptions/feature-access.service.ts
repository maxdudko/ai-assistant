import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import type { Feature, PlanLimits, SubscriptionPlan, SubscriptionStatus } from '@ai/shared-types';

import { SubscriptionsService } from './subscriptions.service';
import { PLAN_ENTITLEMENTS, PLAN_LIMITS } from './plan-entitlements';

const ACTIVE_STATUSES = new Set<SubscriptionStatus>(['ACTIVE', 'TRIALING']);

@Injectable()
export class FeatureAccessService {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  async canUse(userId: string, feature: Feature): Promise<boolean> {
    const subscription = await this.subscriptions.getOrCreateForUser(userId);
    return this.canUseWithSubscription(subscription, feature);
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
    if (!this.isActive(subscription.status)) {
      return [];
    }
    const plan = this.resolveEffectivePlan(subscription);
    return Array.from(PLAN_ENTITLEMENTS[plan]);
  }

  canUseWithSubscription(subscription: Subscription, feature: Feature): boolean {
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

  private isActive(status: Subscription['status']): boolean {
    return ACTIVE_STATUSES.has(status as SubscriptionStatus);
  }
}
