import { Injectable } from '@nestjs/common';

import type { DailyEvent } from '../daily/daily.types';

type DailySchedulerEventInput = {
  now: Date;
  lastActivityAt: Date | null;
  dayPlanningTime: string | null;
  reflectionTime: string | null;
  helpStyle: string | null;
};

@Injectable()
export class DailySchedulerEventResolver {
  resolve(input: DailySchedulerEventInput): DailyEvent {
    if (this.isInactivityApplicable(input)) {
      return { type: 'INACTIVITY' };
    }

    return { type: 'TIME_TRIGGER' };
  }

  private isInactivityApplicable(input: DailySchedulerEventInput): boolean {
    if (!input.lastActivityAt) {
      return false;
    }

    const elapsedMs = input.now.getTime() - input.lastActivityAt.getTime();
    return elapsedMs >= this.inactivityThresholdMs(input.helpStyle);
  }

  private inactivityThresholdMs(helpStyle: string | null): number {
    if (helpStyle === 'proactive') {
      return 60 * 60 * 1000;
    }
    if (helpStyle === 'passive') {
      return 150 * 60 * 1000;
    }
    return 90 * 60 * 1000;
  }
}
