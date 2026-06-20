import { apiFetch } from './client';
import type {
  DayDto,
  DayIntelligenceDto,
  DaySummaryDto,
  MorningBriefingDto,
  WeeklyInsightDto,
  WeeklyInsightListResponse,
} from './types';

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

export async function getMorningBriefing(): Promise<MorningBriefingDto> {
  return apiFetch<MorningBriefingDto>('/api/day/morning-briefing');
}

export async function getDayIntelligence(): Promise<DayIntelligenceDto> {
  return apiFetch<DayIntelligenceDto>('/api/day/intelligence');
}

export async function getLatestWeeklyInsight(): Promise<WeeklyInsightDto | null> {
  return apiFetch<WeeklyInsightDto | null>('/api/day/weekly-insight/latest');
}

export async function listWeeklyInsights(
  options: { limit?: number; offset?: number } = {},
): Promise<WeeklyInsightListResponse> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));
  const qs = params.toString();
  return apiFetch<WeeklyInsightListResponse>(`/api/day/weekly-insight${qs ? `?${qs}` : ''}`);
}

export async function generateWeeklyInsight(): Promise<WeeklyInsightDto | null> {
  return apiFetch<WeeklyInsightDto | null>('/api/day/weekly-insight/generate', {
    method: 'POST',
  });
}
