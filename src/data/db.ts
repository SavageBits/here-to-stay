/**
 * IndexedDB schema via Dexie (architecture §5.1).
 *
 * One database, versioned. Every schema change bumps the version with an
 * `upgrade` function so data survives (PRD §19 — migrations/schema versioning).
 * All persistence lives behind the repositories in data/repositories; UI code
 * never touches this module directly.
 */

import Dexie from 'dexie'
import type { DexieOptions, EntityTable } from 'dexie'
import type {
  AppSettings,
  Exercise,
  ExerciseSet,
  WeightEntry,
  WorkoutExercise,
  WorkoutSession,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '../domain/entities'

export class HealthDB extends Dexie {
  // `&date` = unique index enforcing one primary weigh-in per calendar day
  // (PRD §5.1, §15 constraint).
  weightEntries!: EntityTable<WeightEntry, 'id'>
  workoutTemplates!: EntityTable<WorkoutTemplate, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  templateExercises!: EntityTable<WorkoutTemplateExercise, 'id'>
  workoutSessions!: EntityTable<WorkoutSession, 'id'>
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>
  exerciseSets!: EntityTable<ExerciseSet, 'id'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor(name = 'health-goals-tracker', options?: DexieOptions) {
    super(name, options)

    // ---- Version 1 -------------------------------------------------------
    // Only declare INDEXED properties here (the primary key and any fields we
    // query/sort by). Non-indexed fields are still stored — Dexie persists the
    // whole object regardless.
    this.version(1).stores({
      weightEntries: 'id, &date',
      workoutTemplates: 'id, type',
      exercises: 'id, archivedAt',
      templateExercises: 'id, workoutTemplateId, exerciseId, [workoutTemplateId+sortOrder]',
      workoutSessions: 'id, status, workoutType, [workoutType+completedAt]',
      workoutExercises: 'id, workoutSessionId, exerciseId',
      exerciseSets: 'id, workoutExerciseId',
    })

    // ---- Version 2 -------------------------------------------------------
    // Adds the single-row app settings table. Existing tables are unchanged, so
    // no data backfill is needed; the default settings row is created lazily by
    // settingsRepo on first read.
    this.version(2).stores({
      settings: 'id',
    })

    // ---- Version 3 -------------------------------------------------------
    // Adds Exercise.lastTargetWeight (a non-indexed field), so no `stores`
    // change is required — the version bump alone lets Dexie persist the new
    // field. Existing rows simply lack it (treated as null on read).
    this.version(3).stores({})

    // ---- Future migrations ----------------------------------------------
    // When the schema changes, add a new version with only the changed tables
    // and an upgrade() to backfill. Example:
    //
    // this.version(4)
    //   .stores({ weightEntries: 'id, &date, note' })
    //   .upgrade((tx) =>
    //     tx.table('weightEntries').toCollection().modify((e) => {
    //       e.note = e.note ?? null
    //     }),
    //   )
  }
}

/** Singleton database instance used by the repositories. */
export const db = new HealthDB()
