import { Injectable } from '@nestjs/common';
import type { PaymentRecord, PaymentStatus, SubscriptionEvent, SubscriptionEventType } from '@prisma/client';
import type { SubscriptionPlan, SubscriptionStatus } from '@ai/shared-types';
import type Stripe from 'stripe';

import { PrismaService } from '../prisma/prisma.service';

import { mapStripeInvoiceToPaymentInput } from './stripe-invoice.mapper';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';

export interface PaymentRecordSummary {
  id: string;
  stripeInvoiceId: string;
  amountCents: number;
  currency: string;
  status: string;
  description: string | null;
  invoiceNumber: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

export interface SubscriptionEventSummary {
  id: string;
  type: string;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus | null;
  description: string;
  occurredAt: string;
}

@Injectable()
export class BillingHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly stripe: StripeService,
  ) {}

  async listForUser(userId: string, options: { limit?: number } = {}): Promise<{
    payments: PaymentRecordSummary[];
    events: SubscriptionEventSummary[];
  }> {
    await this.syncFromStripeIfNeeded(userId);

    const limit = Math.max(1, Math.min(50, options.limit ?? 20));

    const [payments, events] = await Promise.all([
      this.prisma.paymentRecord.findMany({
        where: { userId },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      }),
      this.prisma.subscriptionEvent.findMany({
        where: { userId },
        orderBy: { occurredAt: 'desc' },
        take: limit,
      }),
    ]);

    return {
      payments: payments.map(payment => this.toPaymentSummary(payment)),
      events: events.map(event => this.toEventSummary(event)),
    };
  }

  async upsertPaymentFromInvoice(
    userId: string,
    invoice: Stripe.Invoice,
    options: { status?: PaymentStatus } = {},
  ): Promise<void> {
    const data = mapStripeInvoiceToPaymentInput(userId, invoice);
    if (options.status) {
      data.status = options.status;
    }

    await this.prisma.paymentRecord.upsert({
      where: { stripeInvoiceId: data.stripeInvoiceId },
      create: data,
      update: {
        amountCents: data.amountCents,
        currency: data.currency,
        status: data.status,
        description: data.description,
        invoiceNumber: data.invoiceNumber,
        hostedInvoiceUrl: data.hostedInvoiceUrl,
        invoicePdfUrl: data.invoicePdfUrl,
        paidAt: data.paidAt,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      },
    });
  }

  async recordEvent(input: {
    userId: string;
    type: SubscriptionEventType;
    plan?: SubscriptionPlan | null;
    status?: SubscriptionStatus | null;
    description: string;
    occurredAt?: Date;
  }): Promise<void> {
    await this.prisma.subscriptionEvent.create({
      data: {
        userId: input.userId,
        type: input.type,
        plan: input.plan ?? null,
        status: input.status ?? null,
        description: input.description,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  }

  async syncFromStripe(userId: string): Promise<number> {
    const subscription = await this.subscriptions.getOrCreateForUser(userId);
    if (!subscription.stripeCustomerId || !this.stripe.isConfigured()) {
      return 0;
    }

    const invoices = await this.stripe.listInvoicesForCustomer(subscription.stripeCustomerId);
    for (const invoice of invoices) {
      if (!invoice.id) {
        continue;
      }
      await this.upsertPaymentFromInvoice(userId, invoice);
    }

    return invoices.length;
  }

  private async syncFromStripeIfNeeded(userId: string): Promise<void> {
    const subscription = await this.subscriptions.getOrCreateForUser(userId);
    if (!subscription.stripeCustomerId || !this.stripe.isConfigured()) {
      return;
    }

    const paymentCount = await this.prisma.paymentRecord.count({ where: { userId } });
    if (paymentCount > 0) {
      return;
    }

    await this.syncFromStripe(userId);
  }

  private toPaymentSummary(payment: PaymentRecord): PaymentRecordSummary {
    return {
      id: payment.id,
      stripeInvoiceId: payment.stripeInvoiceId,
      amountCents: payment.amountCents,
      currency: payment.currency,
      status: payment.status,
      description: payment.description,
      invoiceNumber: payment.invoiceNumber,
      hostedInvoiceUrl: payment.hostedInvoiceUrl,
      invoicePdfUrl: payment.invoicePdfUrl,
      paidAt: payment.paidAt?.toISOString() ?? null,
      periodStart: payment.periodStart?.toISOString() ?? null,
      periodEnd: payment.periodEnd?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    };
  }

  private toEventSummary(event: SubscriptionEvent): SubscriptionEventSummary {
    return {
      id: event.id,
      type: event.type,
      plan: (event.plan as SubscriptionPlan | null) ?? null,
      status: (event.status as SubscriptionStatus | null) ?? null,
      description: event.description,
      occurredAt: event.occurredAt.toISOString(),
    };
  }
}
