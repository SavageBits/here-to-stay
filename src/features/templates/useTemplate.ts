/**
 * Reactive workout-template hooks (architecture §6). Exposes each template's
 * exercises with their current names + targets, live-updating on any edit.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type {
  Exercise,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '../../domain/entities'
import type { WorkoutType } from '../../domain/types'

/** A template-exercise row joined with its current logical exercise. */
export interface TemplateRow {
  templateExercise: WorkoutTemplateExercise
  exercise: Exercise
}

export interface TemplateView {
  template: WorkoutTemplate
  rows: TemplateRow[]
}

/**
 * The full editable view of a workout type's template: the template record plus
 * its non-archived exercises in sort order. `undefined` while loading.
 */
export function useTemplate(type: WorkoutType): TemplateView | undefined {
  return useLiveQuery(async () => {
    const template = await db.workoutTemplates.where('type').equals(type).first()
    if (!template) return undefined
    const templateExercises = await db.templateExercises
      .where('workoutTemplateId')
      .equals(template.id)
      .sortBy('sortOrder')

    const rows: TemplateRow[] = []
    for (const te of templateExercises) {
      const exercise = await db.exercises.get(te.exerciseId)
      if (!exercise || exercise.archivedAt !== null) continue
      rows.push({ templateExercise: te, exercise })
    }
    return { template, rows }
  }, [type])
}
