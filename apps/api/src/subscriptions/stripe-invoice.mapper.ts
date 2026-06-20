import type { PaymentStatus } from '@prisma/client';
import type Stripe from 'stripe';

export function mapStripeInvoiceStatus(stripeStatus: Stripe.Invoice.Status | null): PaymentStatus {
  switch (stripeStatus) {
    case 'paid':
      return 'PAID';
    case 'open':
      return 'OPEN';
    case 'void':
      return 'VOID';
    case 'uncollectible':
      return 'UNCOLLECTIBLE';
    default:
      return 'OPEN';
  }
}

export function mapStripeInvoiceToPaymentInput(
  userId: string,
  invoice: Stripe.Invoice,
): {
  userId: string;
  stripeInvoiceId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  description: string | null;
  invoiceNumber: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  paidAt: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
} {
  const stripeInvoiceId = invoice.id;
  if (!stripeInvoiceId) {
    throw new Error('Stripe invoice is missing id');
  }

  const amountCents =
    invoice.status === 'paid' ? (invoice.amount_paid ?? invoice.total ?? 0) : (invoice.total ?? 0);

  return {
    userId,
    stripeInvoiceId,
    amountCents,
    currency: (invoice.currency ?? 'usd').toLowerCase(),
    status: mapStripeInvoiceStatus(invoice.status),
    description: buildInvoiceDescription(invoice),
    invoiceNumber: invoice.number ?? null,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdfUrl: invoice.invoice_pdf ?? null,
    paidAt: unixToDate(invoice.status_transitions?.paid_at),
    periodStart: unixToDate(invoice.period_start),
    periodEnd: unixToDate(invoice.period_end),
  };
}

function buildInvoiceDescription(invoice: Stripe.Invoice): string | null {
  const line = invoice.lines?.data?.[0]?.description;
  if (line) {
    return line;
  }
  if (invoice.billing_reason === 'subscription_create') {
    return 'Pro subscription';
  }
  if (invoice.billing_reason === 'subscription_cycle') {
    return 'Pro subscription renewal';
  }
  return invoice.description ?? 'Subscription invoice';
}

function unixToDate(unixSeconds: number | null | undefined): Date | null {
  if (unixSeconds == null) {
    return null;
  }
  return new Date(unixSeconds * 1000);
}
