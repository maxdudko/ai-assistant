import { apiFetch } from './client';
import type { GoalDto, CreateGoalRequest, UpdateGoalRequest, PaginatedList } from './types';

export async function getGoals(options?: {
  limit?: number;
  offset?: number;
}): Promise<PaginatedList<GoalDto>> {
  const params = new URLSearchParams();
  if (options?.limit != null) params.set('limit', String(options.limit));
  if (options?.offset != null) params.set('offset', String(options.offset));
  const q = params.toString();
  return apiFetch<PaginatedList<GoalDto>>(`/api/goals${q ? `?${q}` : ''}`);
}

export async function getGoal(id: string): Promise<GoalDto> {
  return apiFetch<GoalDto>(`/api/goals/${id}`);
}

export async function createGoal(request: CreateGoalRequest): Promise<GoalDto> {
  return apiFetch<GoalDto>('/api/goals', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function updateGoal(id: string, request: UpdateGoalRequest): Promise<GoalDto> {
  return apiFetch<GoalDto>(`/api/goals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

export async function deleteGoal(id: string): Promise<void> {
  return apiFetch<void>(`/api/goals/${id}`, {
    method: 'DELETE',
  });
}
