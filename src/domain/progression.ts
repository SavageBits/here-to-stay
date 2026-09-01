/**
 * Progressive-overload rules (PRD §9, §16).
 *
 * Pure and deterministic: the next target is *derived* from the current target
 * and this session's sets, never accumulated. Re-evaluating an unchanged session
 * therefore yields the same result and cannot double-apply +5 lb (PRD §11, §16.15).
 */

import type { SetResult } from './types'

/** Rep goal each set must meet to count toward progression (PRD §8.1, §9.2). */
export const TARGET_REP_GOAL = 12

/** Amount the target advances on a successful session (PRD §9.1). */
export const PROGRESSION_INCREMENT_LB = 5

export interface ProgressionInput {
  /** Current target weight; `null` or `0` means bodyweight (no progression). */
  targetWeight: number | null
  /** The sets the user completed this session. */
  sets: SetResult[]
  /** True if the user skipped the exercise entirely (PRD §16.13). */
  skipped: boolean
}

export interface ProgressionOutcome {
  successful: boolean
  /** Target to suggest next time; unchanged unless the session succeeded. */
  nextTargetWeight: number | null
  /** Human-readable explanation, surfaced in history/debugging. */
  reason: string
}

/** A weighted exercise has a positive numeric target. */
function isWeighted(targetWeight: number | null): targetWeight is number {
  return targetWeight !== null && targetWeight > 0
}

/**
 * Evaluate whether an exercise session met the progression criteria and compute
 * the next target weight (PRD §9.2–9.3).
 *
 * Success requires ALL of:
 *   - the exercise was not skipped,
 *   - it is weighted (positive target),
 *   - at least one set was completed,
 *   - every set has reps >= 12,
 *   - every set weight >= the current target.
 */
export function evaluateProgression(input: ProgressionInput): ProgressionOutcome {
  const { targetWeight, sets, skipped } = input

  if (skipped) {
    return {
      successful: false,
      nextTargetWeight: targetWeight,
      reason: 'Exercise skipped — target unchanged.',
    }
  }

  // Bodyweight / non-weighted exercises do not use the +5 lb rule (PRD §16.14).
  if (!isWeighted(targetWeight)) {
    return {
      successful: false,
      nextTargetWeight: targetWeight,
      reason: 'Bodyweight exercise — no weight progression.',
    }
  }

  if (sets.length === 0) {
    return {
      successful: false,
      nextTargetWeight: targetWeight,
      reason: 'No sets completed — target unchanged.',
    }
  }

  const everySetReachesReps = sets.every((s) => s.reps >= TARGET_REP_GOAL)
  const everySetAtOrAboveTarget = sets.every((s) => (s.weight ?? 0) >= targetWeight)
  const successful = everySetReachesReps && everySetAtOrAboveTarget

  if (successful) {
    return {
      successful: true,
      nextTargetWeight: targetWeight + PROGRESSION_INCREMENT_LB,
      reason: `All sets >= ${TARGET_REP_GOAL} reps at >= ${targetWeight} lb — target advances by ${PROGRESSION_INCREMENT_LB} lb.`,
    }
  }

  const reason = !everySetAtOrAboveTarget
    ? 'A set was below the target weight — target retained.'
    : `A set was below ${TARGET_REP_GOAL} reps — target retained.`
  return { successful: false, nextTargetWeight: targetWeight, reason }
}
