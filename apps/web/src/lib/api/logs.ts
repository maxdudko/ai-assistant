import { apiFetch } from './client';
import type { AiLogDto, GetLogsResponse } from './types';

export const logsApi = {
  getAll: (params?: { page?: number; limit?: number; mode?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.mode) searchParams.set('mode', params.mode);

    const query = searchParams.toString();
    return apiFetch<GetLogsResponse>(`/api/logs${query ? `?${query}` : ''}`);
  },

  getOne: (id: string) => apiFetch<AiLogDto>(`/api/logs/${id}`),
};
