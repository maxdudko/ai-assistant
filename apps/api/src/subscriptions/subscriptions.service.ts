import { Injectable } from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import type { SubscriptionPlan, SubscriptionStatus, SubscriptionSummary } from '@ai/shared-types';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({
      where: { stripeCustomerId },
    });
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
    });
  }

  async attachStripeCustomerId(userId: string, stripeCustomerId: string): Promise<Subscription> {
    await this.getOrCreateForUser(userId);
    return this.prisma.subscription.update({
      where: { userId },
      data: { stripeCustomerId },
    });
  }

  async markPastDue(userId: string): Promise<SubscriptionSummary> {
    const subscription = await this.prisma.subscription.update({
      where: { userId },
      data: { status: 'PAST_DUE' },
    });
    return this.toSummary(subscription);
  }

  async revertToFree(userId: string): Promise<SubscriptionSummary> {
    const subscription = await this.prisma.subscription.update({
      where: { userId },
      data: {
        plan: 'FREE',
        status: 'CANCELED',
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEnd: null,
      },
    });
    return this.toSummary(subscription);
  }

  hasActivePaidPlan(subscription: Subscription): boolean {
    return (
      subscription.plan === 'PRO' &&
      (subscription.status === 'ACTIVE' || subscription.status === 'TRIALING')
    );
  }

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
      hasStripeCustomer: Boolean(subscription.stripeCustomerId),
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }
}
