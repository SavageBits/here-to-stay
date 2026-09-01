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

/** An exercise that can be re-added to a template, with its resume target. */
export interface ReaddableExercise {
  exerciseId: string
  name: string
  /**
   * Target to resume at: the most recent completed session's next target if the
   * exercise has completed history; otherwise the target it had when last
   * removed from a template (`Exercise.lastTargetWeight`). `null` only for a
   * genuine bodyweight exercise with no recorded target.
   */
  lastTarget: number | null
  /** Whether the exercise has any completed-session history. */
  hasHistory: boolean
}

/**
 * Logical exercises that are NOT currently in the given template and are not
 * archived — i.e. candidates to (re-)add, each with the target it should resume
 * at (its last achieved target). Sorted by name.
 */
export async function listReaddableExercises(
  type: WorkoutType,
  db: HealthDB = defaultDb,
): Promise<ReaddableExercise[]> {
  const template = await getTemplate(type, db)
  if (!template) return []

  const inTemplate = new Set(
    (await listTemplateExercises(template.id, db)).map((r) => r.exerciseId),
  )
  const candidates = (await db.exercises.toArray()).filter(
    (e) => e.archivedAt === null && !inTemplate.has(e.id),
  )

  const result: ReaddableExercise[] = []
  for (const ex of candidates) {
    // Most recent COMPLETED session that included this exercise → resume target.
    const workoutExercises = await db.workoutExercises
      .where('exerciseId')
      .equals(ex.id)
      .toArray()
    let historyTarget: number | null = null
    let hasHistory = false
    let latestCompletedAt = ''
    for (const we of workoutExercises) {
      const session = await db.workoutSessions.get(we.workoutSessionId)
      if (!session || session.status !== 'completed' || !session.completedAt) continue
      hasHistory = true
      if (session.completedAt > latestCompletedAt) {
        latestCompletedAt = session.completedAt
        historyTarget = we.nextTargetWeight ?? we.targetWeightSnapshot
      }
    }
    // Prefer the completed-history target; otherwise the target the exercise had
    // when it was last removed from a template (Exercise.lastTargetWeight).
    const lastTarget = hasHistory ? historyTarget : (ex.lastTargetWeight ?? null)
    result.push({ exerciseId: ex.id, name: ex.name, lastTarget, hasHistory })
  }

  result.sort((a, b) => a.name.localeCompare(b.name))
  return result
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
      // Reuse an existing non-archived exercise with the same name (case- and
      // whitespace-insensitive) rather than creating a duplicate logical
      // exercise — keeps one Exercise per name so history/progression stay unified.
      const wanted = opts.name.trim().toLowerCase()
      const match = (await db.exercises.toArray()).find(
        (e) => e.archivedAt === null && e.name.trim().toLowerCase() === wanted,
      )
      exercise = match ?? (await createExercise(opts.name.trim(), db))
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

/**
 * Remove an exercise from a template's future workouts. Deletes only the
 * template slot — the logical Exercise and all historical WorkoutExercise
 * snapshots are left intact, so the exercise can be re-added later (see
 * `listReaddableExercises`) with its history and progression restored.
 */
export async function removeExerciseFromTemplate(
  templateExerciseId: string,
  db: HealthDB = defaultDb,
): Promise<void> {
  await db.transaction('rw', db.templateExercises, db.exercises, async () => {
    const row = await db.templateExercises.get(templateExerciseId)
    if (!row) return
    // Remember the slot's target on the logical exercise so a re-add can resume
    // at it even before any completed session exists.
    await db.exercises.update(row.exerciseId, {
      lastTargetWeight: row.targetWeight,
      updatedAt: nowTimestamp(),
    })
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
