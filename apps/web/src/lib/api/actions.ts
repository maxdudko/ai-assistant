import { apiFetch } from './client';

export interface ConfirmActionRequest {
  actionId: string;
}

export interface ConfirmActionResponse {
  actionId: string;
  status: string;
}

export async function confirmAction(request: ConfirmActionRequest): Promise<ConfirmActionResponse> {
  return apiFetch<ConfirmActionResponse>('/api/actions/confirm', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
