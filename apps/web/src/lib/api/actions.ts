import { apiFetch } from './client';

export interface ConfirmActionRequest {
  actionId: string;
}

export interface ConfirmActionResponse {
  actionId: string;
  status: string;
}

export interface PendingAction {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  confidence: number;
  requiresConfirmation: boolean;
  status: string;
  createdAt: string;
  conversationId: string | null;
}

export interface PendingActionsResponse {
  items: PendingAction[];
  hasMore: boolean;
  nextOffset: number | null;
}

export async function confirmAction(request: ConfirmActionRequest): Promise<ConfirmActionResponse> {
  return apiFetch<ConfirmActionResponse>('/api/actions/confirm', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getPendingActions(params?: {
  conversationId?: string;
  dayId?: string;
  limit?: number;
  offset?: number;
}): Promise<PendingActionsResponse> {
  const search = new URLSearchParams();
  if (params?.conversationId) search.set('conversationId', params.conversationId);
  if (params?.dayId) search.set('dayId', params.dayId);
  if (typeof params?.limit === 'number') search.set('limit', String(params.limit));
  if (typeof params?.offset === 'number') search.set('offset', String(params.offset));

  const query = search.toString();
  const path = query ? `/api/actions/pending?${query}` : '/api/actions/pending';
  return apiFetch<PendingActionsResponse>(path);
}
