/**
 * Backup / export / import (PRD §19, §21). A safety net given local-only
 * storage. JSON is full-fidelity round-trippable; CSV is for spreadsheet use.
 */

import type { HealthDB } from '../db'
import { db as defaultDb } from '../db'
import type {
  Exercise,
  ExerciseSet,
  WeightEntry,
  WorkoutExercise,
  WorkoutSession,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '../../domain/entities'

export interface BackupData {
  version: 1
  exportedAt: string
  weightEntries: WeightEntry[]
  workoutTemplates: WorkoutTemplate[]
  exercises: Exercise[]
  templateExercises: WorkoutTemplateExercise[]
  workoutSessions: WorkoutSession[]
  workoutExercises: WorkoutExercise[]
  exerciseSets: ExerciseSet[]
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
  ] = await Promise.all([
    db.weightEntries.toArray(),
    db.workoutTemplates.toArray(),
    db.exercises.toArray(),
    db.templateExercises.toArray(),
    db.workoutSessions.toArray(),
    db.workoutExercises.toArray(),
    db.exerciseSets.toArray(),
  ])
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    weightEntries,
    workoutTemplates,
    exercises,
    templateExercises,
    workoutSessions,
    workoutExercises,
    exerciseSets,
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
 * Replace all data with the contents of a backup (PRD §19). Clears every table
 * first, then bulk-inserts. Throws on an unrecognized version.
 */
export async function importBackup(
  data: BackupData,
  db: HealthDB = defaultDb,
): Promise<void> {
  if (data.version !== 1) {
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
      ])
      await Promise.all([
        db.weightEntries.bulkAdd(data.weightEntries),
        db.workoutTemplates.bulkAdd(data.workoutTemplates),
        db.exercises.bulkAdd(data.exercises),
        db.templateExercises.bulkAdd(data.templateExercises),
        db.workoutSessions.bulkAdd(data.workoutSessions),
        db.workoutExercises.bulkAdd(data.workoutExercises),
        db.exerciseSets.bulkAdd(data.exerciseSets),
      ])
    },
  )
}

/** Parse and import a JSON backup string. */
export async function importBackupJson(json: string, db: HealthDB = defaultDb): Promise<void> {
  await importBackup(JSON.parse(json) as BackupData, db)
}
