import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type Stripe from 'stripe';

import { PrismaService } from '../prisma/prisma.service';

import { BillingHistoryService } from './billing-history.service';
import { resolvePlanFromStripePriceId } from './stripe.config';
import { mapStripeSubscriptionStatus } from './stripe-status.mapper';
import {
  extractInvoiceSubscriptionId,
  extractSubscriptionPeriod,
} from './stripe-subscription.util';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly subscriptions: SubscriptionsService,
    private readonly billingHistory: BillingHistoryService,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    const recorded = await this.recordEventIfNew(event);
    if (!recorded) {
      this.logger.debug(`Skipping duplicate Stripe event ${event.id}`);
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.syncStripeSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  private async recordEventIfNew(event: Stripe.Event): Promise<boolean> {
    try {
      await this.prisma.stripeWebhookEvent.create({
        data: {
          id: event.id,
          type: event.type,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    if (session.mode !== 'subscription') {
      return;
    }

    const userId = this.resolveUserIdFromSession(session);
    if (!userId) {
      this.logger.warn(`checkout.session.completed ${session.id} missing userId metadata`);
      return;
    }

    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

    if (!subscriptionId) {
      this.logger.warn(`checkout.session.completed ${session.id} missing subscription id`);
      return;
    }

    const stripeSubscription = await this.stripe.retrieveSubscription(subscriptionId);
    await this.syncStripeSubscription(stripeSubscription, userId);
  }

  private async syncStripeSubscription(
    stripeSubscription: Stripe.Subscription,
    explicitUserId?: string,
  ): Promise<void> {
    const userId =
      explicitUserId ??
      stripeSubscription.metadata?.userId ??
      (await this.resolveUserIdFromStripeSubscription(stripeSubscription));

    if (!userId) {
      this.logger.warn(
        `Cannot sync subscription ${stripeSubscription.id}: userId not found in metadata`,
      );
      return;
    }

    const previous = await this.subscriptions.getOrCreateForUser(userId);

    const customerId =
      typeof stripeSubscription.customer === 'string'
        ? stripeSubscription.customer
        : stripeSubscription.customer.id;

    const firstItem = stripeSubscription.items.data[0];
    const priceId = firstItem?.price?.id ?? null;
    const plan = resolvePlanFromStripePriceId(priceId);
    const status = mapStripeSubscriptionStatus(stripeSubscription.status);

    const effectivePlan = status === 'ACTIVE' || status === 'TRIALING' ? plan : 'FREE';
    const period = extractSubscriptionPeriod(stripeSubscription);

    await this.subscriptions.applyStripeSubscriptionUpdate({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: priceId,
      plan: effectivePlan,
      status,
      currentPeriodStart: period.currentPeriodStart,
      currentPeriodEnd: period.currentPeriodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      trialEnd: this.toDate(stripeSubscription.trial_end),
    });

    if (previous.plan !== effectivePlan || previous.status !== status) {
      await this.billingHistory.recordEvent({
        userId,
        type: 'UPDATED',
        plan: effectivePlan,
        status,
        description: `Subscription updated (${effectivePlan}, ${status.replace('_', ' ').toLowerCase()})`,
      });
    }
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const existing = await this.subscriptions.findByStripeSubscriptionId(stripeSubscription.id);
    const userId =
      existing?.userId ?? (await this.resolveUserIdFromStripeSubscription(stripeSubscription));

    if (existing) {
      await this.subscriptions.revertToFree(existing.userId);
    } else if (userId) {
      await this.subscriptions.revertToFree(userId);
    }

    if (userId) {
      await this.billingHistory.recordEvent({
        userId,
        type: 'CANCELED',
        plan: 'FREE',
        status: 'CANCELED',
        description: 'Subscription canceled',
      });
    }
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const userId = await this.resolveUserIdFromInvoice(invoice);
    if (!userId) {
      return;
    }

    await this.billingHistory.upsertPaymentFromInvoice(userId, invoice);

    const isInitial = invoice.billing_reason === 'subscription_create';
    await this.billingHistory.recordEvent({
      userId,
      type: isInitial ? 'SUBSCRIBED' : 'RENEWED',
      plan: 'PRO',
      status: 'ACTIVE',
      description: isInitial ? 'Initial Pro payment received' : 'Pro subscription renewed',
      occurredAt: this.toDate(invoice.status_transitions?.paid_at) ?? new Date(),
    });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = extractInvoiceSubscriptionId(invoice);

    const userId = await this.resolveUserIdFromInvoice(invoice);
    if (!userId) {
      return;
    }

    if (invoice.id) {
      await this.billingHistory.upsertPaymentFromInvoice(userId, invoice, { status: 'FAILED' });
    }

    if (subscriptionId) {
      const existing = await this.subscriptions.findByStripeSubscriptionId(subscriptionId);
      if (existing) {
        await this.subscriptions.markPastDue(existing.userId);
      }
    }

    await this.billingHistory.recordEvent({
      userId,
      type: 'PAYMENT_FAILED',
      plan: 'PRO',
      status: 'PAST_DUE',
      description: 'Subscription payment failed',
    });
  }

  private resolveUserIdFromSession(session: Stripe.Checkout.Session): string | null {
    return session.client_reference_id ?? session.metadata?.userId ?? null;
  }

  private async resolveUserIdFromStripeSubscription(
    stripeSubscription: Stripe.Subscription,
  ): Promise<string | null> {
    if (stripeSubscription.metadata?.userId) {
      return stripeSubscription.metadata.userId;
    }

    const customerId =
      typeof stripeSubscription.customer === 'string'
        ? stripeSubscription.customer
        : stripeSubscription.customer?.id;

    if (!customerId) {
      return null;
    }

    const existing = await this.subscriptions.findByStripeCustomerId(customerId);
    return existing?.userId ?? null;
  }

  private async resolveUserIdFromInvoice(invoice: Stripe.Invoice): Promise<string | null> {
    const subscriptionId = extractInvoiceSubscriptionId(invoice);
    if (subscriptionId) {
      const existing = await this.subscriptions.findByStripeSubscriptionId(subscriptionId);
      if (existing) {
        return existing.userId;
      }
    }

    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

    if (!customerId) {
      return null;
    }

    const existing = await this.subscriptions.findByStripeCustomerId(customerId);
    return existing?.userId ?? null;
  }

  private toDate(unixSeconds: number | null | undefined): Date | null {
    if (unixSeconds == null) {
      return null;
    }
    return new Date(unixSeconds * 1000);
  }
}
