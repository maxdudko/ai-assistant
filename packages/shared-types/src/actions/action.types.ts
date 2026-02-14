export type ActionType =
  | 'TASK_CREATE'
  | 'TASK_UPDATE_STATUS'
  | 'TASK_SET_PRIORITY'
  | 'TASK_SET_DUE_DATE'
  | 'TASK_COMPLETE'
  | 'DAY_START'
  | 'DAY_END'
  | 'SUGGEST_DIGEST_SUBSCRIPTION';

export interface ActionCandidate {
  id: string; // uuid
  type: ActionType;
  payload: Record<string, unknown>;
  confidence: number; // 0..1
  requiresConfirmation: boolean;
}
