/**
 * Persisted entity interfaces — the data model from PRD §15.
 *
 * These describe the shape of records stored in IndexedDB (see data/db.ts).
 * IDs are UUID strings; timestamps are ISO-8601 strings. Kept in the domain
 * layer (not data/) so pure logic and repositories share one source of truth.
 */

import type { DateISO, Timestamp, WorkoutStatus, WorkoutType } from './types'

/**
 * A single daily body-weight measurement (PRD §5.1, §15).
 *
 * Constraint: at most one primary entry per calendar `date` — enforced by a
 * unique index in data/db.ts and upsert-by-date in weightRepo.
 */
export interface WeightEntry {
  id: string
  /** Calendar day of the weigh-in (`YYYY-MM-DD`, local). */
  date: DateISO
  /** Weight in pounds; supports decimals (PRD §5.1). */
  weight: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** A workout template — Workout A or Workout B (PRD §6, §15). */
export interface WorkoutTemplate {
  id: string
  type: WorkoutType
  name: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * A logical exercise with a stable ID so progression and history attach to the
 * exercise, not a text string (PRD §10, §15). Renaming edits `name` here without
 * touching historical snapshots. `archivedAt` removes it from future templates
 * while preserving history (PRD §6, §16.4).
 */
export interface Exercise {
  id: string
  name: string
  createdAt: Timestamp
  updatedAt: Timestamp
  archivedAt: Timestamp | null
}

/**
 * An exercise's placement within a template, carrying its current progression
 * target (PRD §10, §15). Progression state is kept per template exercise, not
 * shared across A and B (PRD §10 — MVP preference).
 */
export interface WorkoutTemplateExercise {
  id: string
  workoutTemplateId: string
  exerciseId: string
  sortOrder: number
  /** Current suggested target weight; `null` for bodyweight (PRD §8.2, §16.14). */
  targetWeight: number | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** A single workout occurrence the user performs (PRD §11, §15). */
export interface WorkoutSession {
  id: string
  workoutType: WorkoutType
  startedAt: Timestamp
  /** Set when the user explicitly finishes the workout (PRD §11). */
  completedAt: Timestamp | null
  status: WorkoutStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}

/**
 * Snapshot of one exercise within a session (PRD §15). Name and target are
 * copied in at session time so later renames/template edits never rewrite
 * history (PRD §10, §16.3–4). Progression results are recorded on completion
 * and recomputed deterministically on edit (PRD §11).
 */
export interface WorkoutExercise {
  id: string
  workoutSessionId: string
  exerciseId: string
  /** Exercise name as it was when the session ran (immutable history). */
  exerciseNameSnapshot: string
  sortOrder: number
  /** Target weight asked of the user this session; `null` for bodyweight. */
  targetWeightSnapshot: number | null
  /** Whether the user marked this exercise done (vs skipped/incomplete). */
  completed: boolean
  /**
   * Whether the exercise met the progression criteria this session
   * (PRD §9.2). `null` until the session is completed/evaluated.
   */
  progressionAchieved: boolean | null
  /**
   * Derived next target after evaluating this session (PRD §9.3). Computed
   * from the target + sets, never incrementally accumulated, so re-saving is
   * idempotent (PRD §11, §16.15).
   */
  nextTargetWeight: number | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** A single logged set within a workout exercise (PRD §8, §15). */
export interface ExerciseSet {
  id: string
  workoutExerciseId: string
  setNumber: number
  /** Actual weight used for this set; `null`/blank for bodyweight (PRD §8.2). */
  weight: number | null
  /** Reps completed; defaults to 12 in the UI (PRD §8.1). */
  reps: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
