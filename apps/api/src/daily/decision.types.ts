import type { DayPhase, DayState, TaskStatus } from '@prisma/client';

import type { DailyEvent } from './daily.types';
import type { DailyAction } from './action.types';
import type { Nudge } from './nudge.types';

export type DecisionContext = {
  userId: string;
  event: DailyEvent;
  day: {
    id: string;
    state: DayState;
    phase: DayPhase;
    date: Date;
    startedAt: Date | null;
    endedAt: Date | null;
    lastActivityAt: Date | null;
    morningBriefingSentAt: Date | null;
    eveningReflectionSentAt: Date | null;
    planningSuggestionSentAt: Date | null;
    noProgressNudgeSentAt: Date | null;
    stuckTaskNudgeSentAt: Date | null;
  };
  tasks: Array<{
    id: string;
    name: string;
    status: TaskStatus;
    updatedAt: Date;
    priority?: string;
    difficulty?: number | null;
    estimatedMinutes?: number | null;
    deadline?: Date | null;
    createdAt?: Date;
  }>;
  patterns: Array<{
    content: string;
    tags: string[];
  }>;
  now: Date;
  localHour: number;
  allowEveningReflection?: boolean;
  availableMinutes: number;
  totalEstimatedMinutes: number;
  isOverloaded: boolean;
  morningFocusPattern: boolean;
};

export type DecisionMessageTemplate = 'MORNING_BRIEFING' | 'EVENING_REFLECTION';

export type DecisionAction =
  | { type: 'SEND_NUDGE'; nudge: Nudge; action?: DailyAction }
  | {
      type: 'SEND_MESSAGE';
      mode: 'MANAGER' | 'REFLECTION';
      template: DecisionMessageTemplate;
      content?: string;
    }
  | { type: 'NO_OP' };

export type DecisionResult = {
  action: DecisionAction | null;
  nextPhase?: DayPhase;
  reason?: 'MORNING_START' | 'PLAN_OVERLOAD' | 'NO_PROGRESS' | 'STUCK_TASK' | 'EVENING_REFLECTION';
};
