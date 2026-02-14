import { apiFetch } from './client';

export interface DigestSubscriptionDto {
  id: string;
  topic: string;
  frequency: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscribeDigestRequest {
  topic: string;
  frequency?: 'daily';
}

export interface UnsubscribeDigestRequest {
  topic: string;
}

export async function getDigestSubscriptions(): Promise<DigestSubscriptionDto[]> {
  return apiFetch<DigestSubscriptionDto[]>('/api/digest/subscriptions');
}

export async function subscribeDigest(
  request: SubscribeDigestRequest,
): Promise<DigestSubscriptionDto> {
  return apiFetch<DigestSubscriptionDto>('/api/digest/subscriptions', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function unsubscribeDigest(
  request: UnsubscribeDigestRequest,
): Promise<{ success: boolean; deleted: boolean }> {
  return apiFetch<{ success: boolean; deleted: boolean }>('/api/digest/subscriptions', {
    method: 'DELETE',
    body: JSON.stringify(request),
  });
}
