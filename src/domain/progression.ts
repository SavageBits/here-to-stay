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
 *
 * On success the next target is `max(target + 5, highest weight used)`. Because
 * every set already cleared 12 reps at >= target, the highest weight used is the
 * highest weight completed for a full set — so if you added weight mid-exercise
 * (the target was too easy), the next target jumps to that heavier weight rather
 * than only +5. A short set anywhere means no change (12x4 or nothing).
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
    // Every set cleared 12+ reps at >= target, so the heaviest weight used is
    // the heaviest weight completed for a full set. If that exceeds target + 5
    // (weight was added mid-exercise because the target was too easy), advance
    // to it; otherwise the usual +5 step.
    const highestWeight = sets.reduce((max, s) => Math.max(max, s.weight ?? 0), 0)
    const steppedTarget = targetWeight + PROGRESSION_INCREMENT_LB
    const nextTargetWeight = Math.max(steppedTarget, highestWeight)
    const reason =
      nextTargetWeight > steppedTarget
        ? `All sets >= ${TARGET_REP_GOAL} reps; heaviest full set was ${highestWeight} lb — target advances to ${nextTargetWeight} lb.`
        : `All sets >= ${TARGET_REP_GOAL} reps at >= ${targetWeight} lb — target advances by ${PROGRESSION_INCREMENT_LB} lb.`
    return { successful: true, nextTargetWeight, reason }
  }

  const reason = !everySetAtOrAboveTarget
    ? 'A set was below the target weight — target retained.'
    : `A set was below ${TARGET_REP_GOAL} reps — target retained.`
  return { successful: false, nextTargetWeight: targetWeight, reason }
}
