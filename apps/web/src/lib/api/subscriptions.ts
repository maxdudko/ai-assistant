import { apiFetch } from './client';
import type { StripeRedirectDto, SubscriptionMeDto } from './types';

export async function getSubscriptionMe(): Promise<SubscriptionMeDto> {
  return apiFetch<SubscriptionMeDto>('/api/subscriptions/me');
}

export async function createCheckoutSession(): Promise<StripeRedirectDto> {
  return apiFetch<StripeRedirectDto>('/api/subscriptions/checkout', {
    method: 'POST',
  });
}

export async function createBillingPortalSession(): Promise<StripeRedirectDto> {
  return apiFetch<StripeRedirectDto>('/api/subscriptions/billing-portal', {
    method: 'POST',
  });
}
