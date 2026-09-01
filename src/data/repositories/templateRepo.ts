/**
 * Workout template persistence (PRD §6, §10). A template (Workout A/B) holds an
 * ordered list of exercises, each with its own progression target. Editing a
 * template never touches historical sessions (PRD §16.3).
 */

import type { HealthDB } from '../db'
import { db as defaultDb } from '../db'
import type {
  Exercise,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '../../domain/entities'
import type { WorkoutType } from '../../domain/types'
import type { TemplateExerciseView } from '../../domain/workoutBuilder'
import { newId } from '../../lib/ids'
import { nowTimestamp } from '../../lib/dates'
import { createExercise } from './exerciseRepo'

/** The template for a given workout type. */
export async function getTemplate(
  type: WorkoutType,
  db: HealthDB = defaultDb,
): Promise<WorkoutTemplate | undefined> {
  return db.workoutTemplates.where('type').equals(type).first()
}

/** Raw template-exercise rows for a template, ordered by sortOrder. */
export async function listTemplateExercises(
  templateId: string,
  db: HealthDB = defaultDb,
): Promise<WorkoutTemplateExercise[]> {
  return db.templateExercises
    .where('workoutTemplateId')
    .equals(templateId)
    .sortBy('sortOrder')
}

/**
 * Ordered view of a workout type's exercises with their CURRENT names and
 * targets — the exact shape `buildSessionFromPrevious` consumes (PRD §7).
 */
export async function getTemplateExerciseViews(
  type: WorkoutType,
  db: HealthDB = defaultDb,
): Promise<TemplateExerciseView[]> {
  const template = await getTemplate(type, db)
  if (!template) return []
  const rows = await listTemplateExercises(template.id, db)
  const views: TemplateExerciseView[] = []
  for (const row of rows) {
    const exercise = await db.exercises.get(row.exerciseId)
    if (!exercise || exercise.archivedAt !== null) continue
    views.push({
      exerciseId: row.exerciseId,
      name: exercise.name,
      sortOrder: row.sortOrder,
      targetWeight: row.targetWeight,
    })
  }
  return views
}

/**
 * Add an exercise to a template. Creates the logical exercise if a name is
 * given, or reuses an existing `exerciseId`. Appended at the end.
 */
export async function addExerciseToTemplate(
  templateId: string,
  opts: { name?: string; exerciseId?: string; targetWeight?: number | null },
  db: HealthDB = defaultDb,
): Promise<WorkoutTemplateExercise> {
  return db.transaction('rw', db.templateExercises, db.exercises, async () => {
    let exercise: Exercise | undefined
    if (opts.exerciseId) {
      exercise = await db.exercises.get(opts.exerciseId)
    } else if (opts.name) {
      exercise = await createExercise(opts.name, db)
    }
    if (!exercise) throw new Error('addExerciseToTemplate requires a name or exerciseId')

    const existing = await listTemplateExercises(templateId, db)
    const nextOrder = existing.length
    const ts = nowTimestamp()
    const row: WorkoutTemplateExercise = {
      id: newId(),
      workoutTemplateId: templateId,
      exerciseId: exercise.id,
      sortOrder: nextOrder,
      targetWeight: opts.targetWeight ?? null,
      createdAt: ts,
      updatedAt: ts,
    }
    await db.templateExercises.add(row)
    return row
  })
}

/** Remove an exercise from future workouts (archives the row; history intact). */
export async function removeExerciseFromTemplate(
  templateExerciseId: string,
  db: HealthDB = defaultDb,
): Promise<void> {
  await db.transaction('rw', db.templateExercises, async () => {
    const row = await db.templateExercises.get(templateExerciseId)
    if (!row) return
    await db.templateExercises.delete(templateExerciseId)
    // Re-pack sortOrder so it stays 0..n-1.
    const remaining = await listTemplateExercises(row.workoutTemplateId, db)
    await Promise.all(
      remaining.map((r, i) =>
        r.sortOrder === i
          ? Promise.resolve(0)
          : db.templateExercises.update(r.id, { sortOrder: i, updatedAt: nowTimestamp() }),
      ),
    )
  })
}

/** Set the current progression target for a template exercise. */
export async function setTemplateTargetWeight(
  templateExerciseId: string,
  targetWeight: number | null,
  db: HealthDB = defaultDb,
): Promise<void> {
  await db.templateExercises.update(templateExerciseId, {
    targetWeight,
    updatedAt: nowTimestamp(),
  })
}

/**
 * Reorder a template's exercises. `orderedIds` is the full list of
 * templateExercise ids in the desired order (PRD §6).
 */
export async function reorderTemplateExercises(
  orderedIds: string[],
  db: HealthDB = defaultDb,
): Promise<void> {
  await db.transaction('rw', db.templateExercises, async () => {
    const ts = nowTimestamp()
    await Promise.all(
      orderedIds.map((id, i) =>
        db.templateExercises.update(id, { sortOrder: i, updatedAt: ts }),
      ),
    )
  })
}
