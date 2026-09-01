/**
 * Backup / export / import (PRD §19, §21). A safety net given local-only
 * storage. JSON is full-fidelity round-trippable; CSV is for spreadsheet use.
 */

import type { HealthDB } from '../db'
import { db as defaultDb } from '../db'
import type {
  AppSettings,
  Exercise,
  ExerciseSet,
  WeightEntry,
  WorkoutExercise,
  WorkoutSession,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '../../domain/entities'
import { timestampToLocalDate } from '../../lib/dates'

/** Backup format version currently written by exportBackup. */
export const BACKUP_VERSION = 2

export interface BackupData {
  /** 1 = original tables; 2 = adds `settings`. Both are importable. */
  version: 1 | 2
  exportedAt: string
  weightEntries: WeightEntry[]
  workoutTemplates: WorkoutTemplate[]
  exercises: Exercise[]
  templateExercises: WorkoutTemplateExercise[]
  workoutSessions: WorkoutSession[]
  workoutExercises: WorkoutExercise[]
  exerciseSets: ExerciseSet[]
  /** Present in v2+ backups. */
  settings?: AppSettings[]
}

/** Snapshot every table into a plain object (JSON-serializable). */
export async function exportBackup(db: HealthDB = defaultDb): Promise<BackupData> {
  const [
    weightEntries,
    workoutTemplates,
    exercises,
    templateExercises,
    workoutSessions,
    workoutExercises,
    exerciseSets,
    settings,
  ] = await Promise.all([
    db.weightEntries.toArray(),
    db.workoutTemplates.toArray(),
    db.exercises.toArray(),
    db.templateExercises.toArray(),
    db.workoutSessions.toArray(),
    db.workoutExercises.toArray(),
    db.exerciseSets.toArray(),
    db.settings.toArray(),
  ])
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    weightEntries,
    workoutTemplates,
    exercises,
    templateExercises,
    workoutSessions,
    workoutExercises,
    exerciseSets,
    settings,
  }
}

/** Serialize a full backup to a JSON string. */
export async function exportBackupJson(db: HealthDB = defaultDb): Promise<string> {
  return JSON.stringify(await exportBackup(db), null, 2)
}

function csvEscape(value: string | number | null): string {
  if (value === null) return ''
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Weigh-ins as CSV (date,weight). */
export async function exportWeightsCsv(db: HealthDB = defaultDb): Promise<string> {
  const rows = await db.weightEntries.orderBy('date').toArray()
  const lines = ['date,weight', ...rows.map((r) => `${csvEscape(r.date)},${csvEscape(r.weight)}`)]
  return lines.join('\n')
}

/**
 * Completed workout sets as CSV, one row per set, for spreadsheet analysis:
 * date, workout, exercise, set number, weight, reps, target, achieved.
 * Only completed sessions are included; ordered by date, then exercise, then set.
 */
export async function exportWorkoutSetsCsv(db: HealthDB = defaultDb): Promise<string> {
  const sessions = (await db.workoutSessions.where('status').equals('completed').toArray()).sort(
    (a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''),
  )

  const header =
    'date,workout,exercise,set,weight,reps,target_weight,progression_achieved'
  const lines = [header]

  for (const session of sessions) {
    const date = timestampToLocalDate(session.completedAt ?? session.startedAt)
    const exercises = (
      await db.workoutExercises.where('workoutSessionId').equals(session.id).toArray()
    ).sort((a, b) => a.sortOrder - b.sortOrder)

    for (const ex of exercises) {
      const sets = (
        await db.exerciseSets.where('workoutExerciseId').equals(ex.id).toArray()
      ).sort((a, b) => a.setNumber - b.setNumber)

      for (const s of sets) {
        lines.push(
          [
            csvEscape(date),
            csvEscape(session.workoutType),
            csvEscape(ex.exerciseNameSnapshot),
            csvEscape(s.setNumber),
            csvEscape(s.weight),
            csvEscape(s.reps),
            csvEscape(ex.targetWeightSnapshot),
            csvEscape(ex.progressionAchieved === null ? '' : ex.progressionAchieved ? 'yes' : 'no'),
          ].join(','),
        )
      }
    }
  }

  return lines.join('\n')
}

/**
 * Replace all data with the contents of a backup (PRD §19). Clears every table
 * first, then bulk-inserts. Throws on an unrecognized version.
 */
export async function importBackup(
  data: BackupData,
  db: HealthDB = defaultDb,
): Promise<void> {
  if (data.version !== 1 && data.version !== 2) {
    throw new Error(`Unsupported backup version: ${data.version}`)
  }
  await db.transaction(
    'rw',
    [
      db.weightEntries,
      db.workoutTemplates,
      db.exercises,
      db.templateExercises,
      db.workoutSessions,
      db.workoutExercises,
      db.exerciseSets,
      db.settings,
    ],
    async () => {
      await Promise.all([
        db.weightEntries.clear(),
        db.workoutTemplates.clear(),
        db.exercises.clear(),
        db.templateExercises.clear(),
        db.workoutSessions.clear(),
        db.workoutExercises.clear(),
        db.exerciseSets.clear(),
        db.settings.clear(),
      ])
      await Promise.all([
        db.weightEntries.bulkAdd(data.weightEntries),
        db.workoutTemplates.bulkAdd(data.workoutTemplates),
        db.exercises.bulkAdd(data.exercises),
        db.templateExercises.bulkAdd(data.templateExercises),
        db.workoutSessions.bulkAdd(data.workoutSessions),
        db.workoutExercises.bulkAdd(data.workoutExercises),
        db.exerciseSets.bulkAdd(data.exerciseSets),
        // v2+ carries settings; v1 backups omit it (settings stay cleared and
        // are re-created with defaults on next read).
        data.settings ? db.settings.bulkAdd(data.settings) : Promise.resolve([]),
      ])
    },
  )
}

/** Parse and import a JSON backup string. */
export async function importBackupJson(json: string, db: HealthDB = defaultDb): Promise<void> {
  await importBackup(JSON.parse(json) as BackupData, db)
}
