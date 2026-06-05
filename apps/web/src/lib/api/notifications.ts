import { apiFetch } from './client';
import type {
  NotificationDto,
  NotificationPreferencesDto,
  PaginatedList,
  PushPublicKeyDto,
} from './types';

export async function getNotificationPreferences(): Promise<NotificationPreferencesDto> {
  return apiFetch<NotificationPreferencesDto>('/api/notifications/preferences');
}

export async function updateNotificationPreferences(
  request: Partial<NotificationPreferencesDto>,
): Promise<NotificationPreferencesDto> {
  return apiFetch<NotificationPreferencesDto>('/api/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

export async function getPushPublicKey(): Promise<PushPublicKeyDto> {
  return apiFetch<PushPublicKeyDto>('/api/notifications/push/public-key');
}

export async function subscribePush(request: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/api/notifications/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function unsubscribePush(endpoint: string): Promise<{ removed: boolean }> {
  return apiFetch<{ removed: boolean }>('/api/notifications/push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  });
}

export async function listNotifications(
  options: { limit?: number; offset?: number } = {},
): Promise<PaginatedList<NotificationDto>> {
  const params = new URLSearchParams();
  if (options.limit != null) params.set('limit', String(options.limit));
  if (options.offset != null) params.set('offset', String(options.offset));
  const qs = params.toString();
  return apiFetch<PaginatedList<NotificationDto>>(`/api/notifications${qs ? `?${qs}` : ''}`);
}

export async function getUnreadNotificationCount(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>('/api/notifications/unread-count');
}

export async function markNotificationRead(id: string): Promise<{ read: boolean }> {
  return apiFetch<{ read: boolean }>(`/api/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsRead(): Promise<{ read: boolean }> {
  return apiFetch<{ read: boolean }>('/api/notifications/read-all', {
    method: 'PATCH',
  });
}
