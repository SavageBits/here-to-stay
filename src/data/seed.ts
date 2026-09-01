/**
 * First-run seeding (architecture §5.4).
 *
 * Creates Workout A and Workout B templates with a sensible default exercise
 * list (PRD §6 example) that the user can freely edit. Idempotent: does nothing
 * if templates already exist.
 */

import type { HealthDB } from './db'
import { db as defaultDb } from './db'
import { newId } from '../lib/ids'
import { nowTimestamp } from '../lib/dates'
import type { WorkoutType } from '../domain/types'

interface SeedExercise {
  name: string
  targetWeight: number | null
}

const DEFAULT_WORKOUTS: Record<WorkoutType, SeedExercise[]> = {
  A: [
    { name: 'Deadlift', targetWeight: 135 },
    { name: 'Pull-up', targetWeight: null },
    { name: 'Dumbbell Incline Press', targetWeight: 55 },
    { name: 'Calf Raise', targetWeight: 90 },
    { name: 'Plank', targetWeight: null },
  ],
  B: [
    { name: 'Back Squat', targetWeight: 185 },
    { name: 'Barbell Row', targetWeight: 95 },
    { name: 'Overhead Press', targetWeight: 65 },
    { name: 'Romanian Deadlift', targetWeight: 115 },
    { name: 'Hanging Leg Raise', targetWeight: null },
  ],
}

/** Whether the database has been seeded (any template exists). */
export async function isSeeded(db: HealthDB = defaultDb): Promise<boolean> {
  return (await db.workoutTemplates.count()) > 0
}

/**
 * Seed default Workout A/B templates and their exercises. Safe to call on every
 * startup — returns early if already seeded.
 */
export async function seedIfEmpty(db: HealthDB = defaultDb): Promise<void> {
  if (await isSeeded(db)) return

  const ts = nowTimestamp()

  await db.transaction(
    'rw',
    db.workoutTemplates,
    db.exercises,
    db.templateExercises,
    async () => {
      for (const type of ['A', 'B'] as WorkoutType[]) {
        const templateId = newId()
        await db.workoutTemplates.add({
          id: templateId,
          type,
          name: `Workout ${type}`,
          createdAt: ts,
          updatedAt: ts,
        })

        const exercises = DEFAULT_WORKOUTS[type]
        for (let i = 0; i < exercises.length; i += 1) {
          const { name, targetWeight } = exercises[i]
          const exerciseId = newId()
          await db.exercises.add({
            id: exerciseId,
            name,
            createdAt: ts,
            updatedAt: ts,
            archivedAt: null,
          })
          await db.templateExercises.add({
            id: newId(),
            workoutTemplateId: templateId,
            exerciseId,
            sortOrder: i,
            targetWeight,
            createdAt: ts,
            updatedAt: ts,
          })
        }
      }
    },
  )
}
