import { apiFetch } from './client';
import type { TaskDto, CreateTaskRequest, UpdateTaskRequest } from './types';

export async function getTasks(): Promise<TaskDto[]> {
  return apiFetch<TaskDto[]>('/api/tasks');
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
