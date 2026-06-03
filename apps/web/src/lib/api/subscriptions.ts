import { apiFetch } from './client';
import type { SubscriptionMeDto } from './types';

export async function getSubscriptionMe(): Promise<SubscriptionMeDto> {
  return apiFetch<SubscriptionMeDto>('/api/subscriptions/me');
}
