import { apiFetch } from './client';
import type { TaskDto, CreateTaskRequest, UpdateTaskRequest, PaginatedList } from './types';

export async function getTasks(options?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedList<TaskDto>> {
  const params = new URLSearchParams();
  if (options?.limit != null) params.set('limit', String(options.limit));
  if (options?.offset != null) params.set('offset', String(options.offset));
  const q = params.toString();
  return apiFetch<PaginatedList<TaskDto>>(`/api/tasks${q ? `?${q}` : ''}`);
}

export async function getTask(id: string): Promise<TaskDto> {
  return apiFetch<TaskDto>(`/api/tasks/${id}`);
}

export async function createTask(request: CreateTaskRequest): Promise<TaskDto> {
  return apiFetch<TaskDto>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function updateTask(id: string, request: UpdateTaskRequest): Promise<TaskDto> {
  return apiFetch<TaskDto>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

export async function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/api/tasks/${id}`, {
    method: 'DELETE',
  });
}
