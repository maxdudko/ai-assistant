import type { SubscriptionPlan } from '@ai/shared-types';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  proPriceId: string;
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  billingPortalReturnUrl: string;
}

export function loadStripeConfig(): StripeConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID?.trim();
  const checkoutSuccessUrl = process.env.STRIPE_CHECKOUT_SUCCESS_URL?.trim();
  const checkoutCancelUrl = process.env.STRIPE_CHECKOUT_CANCEL_URL?.trim();
  const billingPortalReturnUrl = process.env.STRIPE_BILLING_PORTAL_RETURN_URL?.trim();

  if (
    !secretKey ||
    !webhookSecret ||
    !proPriceId ||
    !checkoutSuccessUrl ||
    !checkoutCancelUrl ||
    !billingPortalReturnUrl
  ) {
    return null;
  }

  return {
    secretKey,
    webhookSecret,
    proPriceId,
    checkoutSuccessUrl,
    checkoutCancelUrl,
    billingPortalReturnUrl,
  };
}

export function resolvePlanFromStripePriceId(priceId: string | null | undefined): SubscriptionPlan {
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID?.trim();
  if (priceId && proPriceId && priceId === proPriceId) {
    return 'PRO';
  }
  return 'FREE';
}

/** Checkout line_items.price must be a Price ID (price_...), not a Product ID (prod_...). */
export function assertProPriceId(proPriceId: string): void {
  if (proPriceId.startsWith('prod_')) {
    throw new Error(
      'STRIPE_PRO_PRICE_ID is a Product ID (prod_...). Use a Price ID (price_...) from Stripe Dashboard → Product → Pricing.',
    );
  }
  if (!proPriceId.startsWith('price_')) {
    throw new Error('STRIPE_PRO_PRICE_ID must be a Stripe Price ID starting with price_.');
  }
}
