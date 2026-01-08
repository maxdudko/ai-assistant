import { apiFetch } from './client';
import type { GoalDto, CreateGoalRequest, UpdateGoalRequest } from './types';

export async function getGoals(): Promise<GoalDto[]> {
  return apiFetch<GoalDto[]>('/api/goals');
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
