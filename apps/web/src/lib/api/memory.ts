import { apiFetch } from './client';
import type { MemoryDto } from './types';

export async function getMemories(): Promise<MemoryDto[]> {
  return apiFetch<MemoryDto[]>('/api/me/memory');
}

export async function deleteMemory(id: string): Promise<void> {
  return apiFetch<void>(`/api/me/memory/${id}`, {
    method: 'DELETE',
  });
}
