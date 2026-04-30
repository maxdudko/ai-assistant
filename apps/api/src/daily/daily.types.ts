export type DailyEvent =
  | { type: 'USER_ACTIVITY' }
  | { type: 'DAY_START' }
  | { type: 'INACTIVITY' }
  | { type: 'TIME_TRIGGER' };

export type DailyEventResult = {
  morningSent: boolean;
  planningSuggestionSent: boolean;
  noProgressNudgeSent: boolean;
  stuckTaskNudgeSent: boolean;
  eveningSent: boolean;
  actions: number;
};
