import type { ActionType } from '@ai/shared-types';

export type DailyActionType = Extract<
  ActionType,
  'SIMPLIFY_DAY' | 'SPLIT_TASK' | 'RESCHEDULE_TASK'
>;

export type DailyAction = {
  type: DailyActionType;
  payload: Record<string, unknown>;
  requiresConfirmation: boolean;
};
