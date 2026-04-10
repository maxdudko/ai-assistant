import { Injectable } from '@nestjs/common';
import { DayPhase, TaskStatus } from '@prisma/client';

import { DecisionContext, DecisionResult } from './decision.types';
import { NudgePriority, NudgeType } from './nudge.types';

type CandidateDecision = {
  rank: number;
  result: DecisionResult;
};

const DECISION_RANK: Record<NonNullable<DecisionResult['reason']>, number> = {
  NO_PROGRESS: 5,
  STUCK_TASK: 4,
  PLAN_OVERLOAD: 3,
  MORNING_START: 2,
  EVENING_REFLECTION: 1,
};

const VALID_PHASE_TRANSITIONS: Record<DayPhase, DayPhase[]> = {
  NOT_STARTED: [DayPhase.MORNING],
  MORNING: [DayPhase.PLANNING],
  PLANNING: [DayPhase.EXECUTION],
  EXECUTION: [DayPhase.EVENING],
  EVENING: [DayPhase.CLOSED],
  CLOSED: [],
};

@Injectable()
export class DecisionEngineService {
  evaluate(context: DecisionContext): DecisionResult {
    const ranked = this.rankDecisions(context);
    if (ranked.length === 0) {
      return { action: { type: 'NO_OP' } };
    }

    const selected = ranked[0];
    if (selected.nextPhase && !this.isValidPhaseTransition(context.day.phase, selected.nextPhase)) {
      return {
        action: { type: 'NO_OP' },
      };
    }
    return selected;
  }

  rankDecisions(context: DecisionContext): DecisionResult[] {
    const candidates: CandidateDecision[] = [];

    const morningStart = this.ruleMorningStart(context);
    if (morningStart) candidates.push(this.toCandidate(morningStart));

    const planOverload = this.rulePlanOverload(context);
    if (planOverload) candidates.push(this.toCandidate(planOverload));

    const noProgress = this.ruleNoProgress(context);
    if (noProgress) candidates.push(this.toCandidate(noProgress));

    const stuckTask = this.ruleStuckTask(context);
    if (stuckTask) candidates.push(this.toCandidate(stuckTask));

    const eveningReflection = this.ruleEveningReflection(context);
    if (eveningReflection) candidates.push(this.toCandidate(eveningReflection));

    const phaseProgression = this.rulePhaseProgression(context);
    if (phaseProgression) candidates.push(this.toCandidate(phaseProgression));

    if (candidates.length === 0) {
      return [];
    }

    return candidates
      .sort((a, b) => b.rank - a.rank)
      .map(candidate => candidate.result)
      .filter(result =>
        result.nextPhase ? this.isValidPhaseTransition(context.day.phase, result.nextPhase) : true,
      );
  }

  isValidPhaseTransition(from: DayPhase, to: DayPhase): boolean {
    return VALID_PHASE_TRANSITIONS[from]?.includes(to) ?? false;
  }

  private ruleMorningStart(context: DecisionContext): DecisionResult | null {
    if (
      context.event.type !== 'DAY_START' ||
      context.day.phase !== DayPhase.NOT_STARTED ||
      context.day.morningBriefingSentAt
    ) {
      return null;
    }

    return {
      action: {
        type: 'SEND_MESSAGE',
        mode: 'MANAGER',
        template: 'MORNING_BRIEFING',
      },
      nextPhase: DayPhase.MORNING,
      reason: 'MORNING_START',
    };
  }

  private rulePlanOverload(context: DecisionContext): DecisionResult | null {
    const activePlanningPhase =
      context.day.phase === DayPhase.MORNING || context.day.phase === DayPhase.PLANNING;
    if (!activePlanningPhase || context.day.planningSuggestionSentAt) {
      return null;
    }

    const hasOvercommitmentPattern = context.patterns.some(pattern => {
      const content = pattern.content.toLowerCase();
      return pattern.tags.includes('overcommitment') || content.includes('overcommit');
    });
    if (!context.isOverloaded) {
      return null;
    }

    return {
      action: {
        type: 'SEND_NUDGE',
        nudge: {
          type: NudgeType.PLAN_OVERLOAD,
          priority: NudgePriority.MEDIUM,
          createdAt: context.now,
        },
        action: {
          type: 'SIMPLIFY_DAY',
          payload: {
            dayId: context.day.id,
            keepCount: hasOvercommitmentPattern ? 2 : 3,
            totalEstimatedMinutes: context.totalEstimatedMinutes,
            availableMinutes: context.availableMinutes,
          },
          requiresConfirmation: true,
        },
      },
      reason: 'PLAN_OVERLOAD',
    };
  }

  private ruleNoProgress(context: DecisionContext): DecisionResult | null {
    if (context.event.type === 'DAY_START') {
      return null;
    }

    if (
      context.day.phase !== DayPhase.EXECUTION ||
      context.localHour < 14 ||
      context.day.noProgressNudgeSentAt
    ) {
      return null;
    }
    const completedTasks = context.tasks.filter(task => task.status === TaskStatus.DONE).length;
    if (completedTasks > 0) {
      return null;
    }

    const overdueCandidate = context.tasks
      .filter(task => task.status !== TaskStatus.DONE)
      .sort((a, b) => {
        const aPriority = this.priorityWeight(a.priority);
        const bPriority = this.priorityWeight(b.priority);
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        const aDeadline = a.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
        const bDeadline = b.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
        return aDeadline - bDeadline;
      })[0];

    return {
      action: {
        type: 'SEND_NUDGE',
        nudge: {
          type: NudgeType.NO_PROGRESS,
          priority: NudgePriority.HIGH,
          createdAt: context.now,
        },
        action: overdueCandidate
          ? {
              type: 'RESCHEDULE_TASK',
              payload: { taskId: overdueCandidate.id },
              requiresConfirmation: true,
            }
          : undefined,
      },
      reason: 'NO_PROGRESS',
    };
  }

  private ruleStuckTask(context: DecisionContext): DecisionResult | null {
    if (context.event.type === 'DAY_START') {
      return null;
    }

    if (context.day.stuckTaskNudgeSentAt) {
      return null;
    }

    const thresholdMs = 3 * 60 * 60 * 1000;
    const stuckTask = context.tasks.find(
      task =>
        task.status === TaskStatus.IN_PROGRESS &&
        context.now.getTime() - task.updatedAt.getTime() >= thresholdMs,
    );
    if (!stuckTask) {
      return null;
    }

    return {
      action: {
        type: 'SEND_NUDGE',
        nudge: {
          type: NudgeType.STUCK_TASK,
          priority: NudgePriority.HIGH,
          createdAt: context.now,
        },
        action: {
          type: 'SPLIT_TASK',
          payload: { taskId: stuckTask.id, parts: 3 },
          requiresConfirmation: true,
        },
      },
      reason: 'STUCK_TASK',
    };
  }

  private ruleEveningReflection(context: DecisionContext): DecisionResult | null {
    const inEveningWindow = context.localHour >= 19;
    if (
      !inEveningWindow ||
      context.day.phase === DayPhase.CLOSED ||
      context.day.eveningReflectionSentAt ||
      context.allowEveningReflection === false
    ) {
      return null;
    }

    return {
      action: {
        type: 'SEND_MESSAGE',
        mode: 'REFLECTION',
        template: 'EVENING_REFLECTION',
      },
      nextPhase: DayPhase.EVENING,
      reason: 'EVENING_REFLECTION',
    };
  }

  private rulePhaseProgression(context: DecisionContext): DecisionResult | null {
    if (context.event.type !== 'USER_ACTIVITY') {
      return null;
    }

    if (context.day.phase === DayPhase.MORNING) {
      return {
        action: { type: 'NO_OP' },
        nextPhase: DayPhase.PLANNING,
      };
    }

    if (context.day.phase === DayPhase.PLANNING) {
      return {
        action: { type: 'NO_OP' },
        nextPhase: DayPhase.EXECUTION,
      };
    }

    return null;
  }

  private toCandidate(result: DecisionResult): CandidateDecision {
    const reason = result.reason;
    if (!reason) {
      return { rank: 0, result };
    }
    return {
      rank: DECISION_RANK[reason],
      result,
    };
  }

  private priorityWeight(priority?: string): number {
    if (priority === 'HIGH') return 3;
    if (priority === 'MEDIUM') return 2;
    return 1;
  }
}
