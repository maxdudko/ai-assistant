import { apiFetch } from './client';
import type { DayDto, DaySummaryDto } from './types';

export async function getToday(): Promise<DayDto> {
  return apiFetch<DayDto>('/api/day/today');
}

export async function startDay(): Promise<DayDto> {
  return apiFetch<DayDto>('/api/day/start', {
    method: 'POST',
  });
}

export async function endDay(): Promise<DayDto> {
  return apiFetch<DayDto>('/api/day/end', {
    method: 'POST',
  });
}

export async function getDaySummary(): Promise<DaySummaryDto> {
  return apiFetch<DaySummaryDto>('/api/day/summary');
}
