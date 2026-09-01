/**
 * Logical exercise persistence (PRD §10). Exercises have stable IDs so
 * progression and history attach to the exercise, not a text string. Renaming
 * edits the name here without touching historical snapshots (PRD §16.4).
 */

import type { HealthDB } from '../db'
import { db as defaultDb } from '../db'
import type { Exercise } from '../../domain/entities'
import { newId } from '../../lib/ids'
import { nowTimestamp } from '../../lib/dates'

/** Create a new logical exercise. */
export async function createExercise(
  name: string,
  db: HealthDB = defaultDb,
): Promise<Exercise> {
  const ts = nowTimestamp()
  const exercise: Exercise = {
    id: newId(),
    name,
    createdAt: ts,
    updatedAt: ts,
    archivedAt: null,
    lastTargetWeight: null,
  }
  await db.exercises.add(exercise)
  return exercise
}

/**
 * Rename a logical exercise. Only the current name changes — historical
 * `exerciseNameSnapshot` values in past sessions are untouched (PRD §16.4).
 */
export async function renameExercise(
  id: string,
  name: string,
  db: HealthDB = defaultDb,
): Promise<void> {
  await db.exercises.update(id, { name, updatedAt: nowTimestamp() })
}

/** Archive an exercise so it drops out of future templates but keeps history. */
export async function archiveExercise(id: string, db: HealthDB = defaultDb): Promise<void> {
  await db.exercises.update(id, { archivedAt: nowTimestamp(), updatedAt: nowTimestamp() })
}

export async function getExercise(
  id: string,
  db: HealthDB = defaultDb,
): Promise<Exercise | undefined> {
  return db.exercises.get(id)
}

/** All non-archived exercises. */
export async function listActiveExercises(db: HealthDB = defaultDb): Promise<Exercise[]> {
  return db.exercises.filter((e) => e.archivedAt === null).toArray()
}
