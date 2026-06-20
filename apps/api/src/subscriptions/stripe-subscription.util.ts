import type Stripe from 'stripe';

export function extractSubscriptionPeriod(stripeSubscription: Stripe.Subscription): {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
} {
  const item = stripeSubscription.items?.data?.[0];
  return {
    currentPeriodStart: unixToDate(item?.current_period_start),
    currentPeriodEnd: unixToDate(item?.current_period_end),
  };
}

export function extractInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (!subscription) {
    return null;
  }
  return typeof subscription === 'string' ? subscription : subscription.id;
}

function unixToDate(unixSeconds: number | null | undefined): Date | null {
  if (unixSeconds == null) {
    return null;
  }
  return new Date(unixSeconds * 1000);
}
