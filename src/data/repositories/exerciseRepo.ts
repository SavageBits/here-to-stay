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

/** Normalized name key for detecting duplicates. */
function nameKey(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Consolidate logical exercises that share a name (case/space-insensitive) into
 * a single canonical exercise, re-pointing history and template rows so no data
 * is lost. Returns the number of duplicate exercises removed.
 *
 * Repairs data created before add-by-name de-duplication existed. Canonical
 * choice: the exercise with completed history, else the oldest (earliest
 * createdAt). The canonical keeps the best available `lastTargetWeight`.
 */
export async function mergeDuplicateExercises(db: HealthDB = defaultDb): Promise<number> {
  return db.transaction(
    'rw',
    [db.exercises, db.templateExercises, db.workoutExercises],
    async () => {
      const all = await db.exercises.toArray()
      const byName = new Map<string, Exercise[]>()
      for (const ex of all) {
        const key = nameKey(ex.name)
        const group = byName.get(key)
        if (group) group.push(ex)
        else byName.set(key, [ex])
      }

      let removed = 0
      for (const group of byName.values()) {
        if (group.length < 2) continue

        // Which exercises have completed-session history?
        const withHistory = new Set<string>()
        for (const ex of group) {
          const count = await db.workoutExercises.where('exerciseId').equals(ex.id).count()
          if (count > 0) withHistory.add(ex.id)
        }

        // Canonical: prefer one with history, then oldest createdAt.
        const canonical = [...group].sort((a, b) => {
          const ah = withHistory.has(a.id) ? 0 : 1
          const bh = withHistory.has(b.id) ? 0 : 1
          if (ah !== bh) return ah - bh
          return a.createdAt.localeCompare(b.createdAt)
        })[0]

        // Best resume target across the group (any non-null lastTargetWeight).
        const bestTarget = group
          .map((e) => e.lastTargetWeight ?? null)
          .find((t) => t !== null && t !== undefined)
        if (bestTarget !== undefined && (canonical.lastTargetWeight ?? null) === null) {
          await db.exercises.update(canonical.id, { lastTargetWeight: bestTarget })
        }

        for (const dup of group) {
          if (dup.id === canonical.id) continue
          // Re-point history snapshots and template slots to the canonical id.
          await db.workoutExercises
            .where('exerciseId')
            .equals(dup.id)
            .modify({ exerciseId: canonical.id })
          await db.templateExercises
            .where('exerciseId')
            .equals(dup.id)
            .modify({ exerciseId: canonical.id })
          await db.exercises.delete(dup.id)
          removed += 1
        }

        // If re-pointing left the canonical exercise in the same template twice,
        // keep the first slot (by sortOrder) and drop the rest.
        const slots = await db.templateExercises.where('exerciseId').equals(canonical.id).toArray()
        const seenTemplates = new Set<string>()
        for (const slot of slots.sort((a, b) => a.sortOrder - b.sortOrder)) {
          if (seenTemplates.has(slot.workoutTemplateId)) {
            await db.templateExercises.delete(slot.id)
          } else {
            seenTemplates.add(slot.workoutTemplateId)
          }
        }
      }
      return removed
    },
  )
}
