import { NudgePriority, NudgeType } from '@prisma/client';

export { NudgePriority, NudgeType };

export type Nudge = {
  type: NudgeType;
  priority: NudgePriority;
  createdAt: Date;
};
