/**
 * Build a new workout session from the previous same-type session (PRD §7).
 *
 * Pure: produces a draft (no IDs, no timestamps, no persistence). The repository
 * layer (sessionRepo) turns this draft into persisted records. Rules:
 *   - copy exercise order and CURRENT names from the template (PRD §7.3),
 *   - suggest the previous session's next target, else the template target,
 *   - do NOT copy completed reps (PRD §7.4),
 *   - seed each exercise with one set defaulted to 12 reps (PRD §7.5, §8.1),
 *   - with no previous session, use the current template (PRD §7).
 */

import type { WorkoutType } from './types'

/** Default reps for a newly seeded set (PRD §8.1). */
export const DEFAULT_REPS = 12

/** A template exercise as the builder needs to see it (current name + target). */
export interface TemplateExerciseView {
  exerciseId: string
  name: string
  sortOrder: number
  targetWeight: number | null
}

/** The relevant outcome of an exercise in the previous session. */
export interface PreviousExerciseResult {
  exerciseId: string
  /** The target computed for next time by the progression algorithm. */
  nextTargetWeight: number | null
  /** Previous snapshot name — intentionally NOT used (current name wins). */
  exerciseNameSnapshot?: string
}

export interface DraftSet {
  setNumber: number
  weight: number | null
  reps: number
}

export interface DraftExercise {
  exerciseId: string
  exerciseNameSnapshot: string
  sortOrder: number
  targetWeightSnapshot: number | null
  sets: DraftSet[]
}

export interface NewWorkoutSessionDraft {
  workoutType: WorkoutType
  exercises: DraftExercise[]
}

/**
 * Compose the draft for a new session of `type` from the current template and,
 * if present, the previous same-type session's per-exercise results.
 */
export function buildSessionFromPrevious(
  type: WorkoutType,
  currentTemplate: TemplateExerciseView[],
  previousSession: PreviousExerciseResult[] | null,
): NewWorkoutSessionDraft {
  const previousByExercise = new Map(
    (previousSession ?? []).map((p) => [p.exerciseId, p]),
  )

  const ordered = [...currentTemplate].sort((a, b) => a.sortOrder - b.sortOrder)

  const exercises: DraftExercise[] = ordered.map((t) => {
    const prev = previousByExercise.get(t.exerciseId)
    // Suggested target: previous session's next target if it exists, else the
    // template's current target (covers exercises added after the last session).
    const target = prev ? prev.nextTargetWeight : t.targetWeight

    return {
      exerciseId: t.exerciseId,
      exerciseNameSnapshot: t.name, // current name, per PRD §7.3
      sortOrder: t.sortOrder,
      targetWeightSnapshot: target,
      sets: [{ setNumber: 1, weight: target, reps: DEFAULT_REPS }],
    }
  })

  return { workoutType: type, exercises }
}
