import { Injectable } from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import type { SubscriptionPlan, SubscriptionStatus, SubscriptionSummary } from '@ai/shared-types';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateForUser(userId: string): Promise<Subscription> {
    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.subscription.create({
      data: {
        userId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Stripe webhook handler will call this once billing is wired up.
   * Keeps provider-specific mapping in one place.
   */
  async applyStripeSubscriptionUpdate(input: {
    userId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    stripePriceId?: string | null;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
    trialEnd?: Date | null;
  }): Promise<SubscriptionSummary> {
    const subscription = await this.prisma.subscription.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        plan: input.plan,
        status: input.status,
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripePriceId: input.stripePriceId ?? null,
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        trialEnd: input.trialEnd ?? null,
      },
      update: {
        plan: input.plan,
        status: input.status,
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripePriceId: input.stripePriceId ?? null,
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        trialEnd: input.trialEnd ?? null,
      },
    });

    return this.toSummary(subscription);
  }

  toSummary(subscription: Subscription): SubscriptionSummary {
    return {
      id: subscription.id,
      userId: subscription.userId,
      plan: subscription.plan as SubscriptionPlan,
      status: subscription.status as SubscriptionStatus,
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      trialEnd: subscription.trialEnd?.toISOString() ?? null,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }
}
