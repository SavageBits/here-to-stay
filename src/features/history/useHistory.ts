/**
 * Reactive history hooks (architecture §6): completed workout list, a single
 * loaded session, and one exercise's history across sessions (PRD §12, §13).
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type {
  Exercise,
  ExerciseSet,
  WorkoutExercise,
  WorkoutSession,
} from '../../domain/entities'

/** Completed sessions, most recent first, each with its completed-exercise count. */
export interface HistoryRow {
  session: WorkoutSession
  exerciseCount: number
}

export function useWorkoutHistory(): HistoryRow[] | undefined {
  return useLiveQuery(async () => {
    const sessions = await db.workoutSessions.where('status').equals('completed').toArray()
    sessions.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    return Promise.all(
      sessions.map(async (session) => {
        const exercises = await db.workoutExercises
          .where('workoutSessionId')
          .equals(session.id)
          .toArray()
        return { session, exerciseCount: exercises.filter((e) => e.completed).length }
      }),
    )
  }, [])
}

export interface LoadedSessionDetail {
  session: WorkoutSession
  exercises: Array<WorkoutExercise & { sets: ExerciseSet[] }>
}

/** A single session with exercises (ordered) and their sets. */
export function useSessionDetail(
  sessionId: string | undefined,
): LoadedSessionDetail | undefined | null {
  return useLiveQuery(async () => {
    if (!sessionId) return null
    const session = await db.workoutSessions.get(sessionId)
    if (!session) return null
    const exercises = await db.workoutExercises
      .where('workoutSessionId')
      .equals(sessionId)
      .sortBy('sortOrder')
    const withSets = await Promise.all(
      exercises.map(async (e) => ({
        ...e,
        sets: await db.exerciseSets.where('workoutExerciseId').equals(e.id).sortBy('setNumber'),
      })),
    )
    return { session, exercises: withSets }
  }, [sessionId])
}

/** One occurrence of an exercise in history: the snapshot + its sets + date. */
export interface ExerciseHistoryEntry {
  workoutExercise: WorkoutExercise
  sets: ExerciseSet[]
  session: WorkoutSession
}

export interface ExerciseHistory {
  exercise: Exercise | undefined
  entries: ExerciseHistoryEntry[]
}

/**
 * The history of a single logical exercise across all completed sessions,
 * most recent first (PRD §13).
 */
export function useExerciseHistory(exerciseId: string | undefined): ExerciseHistory | undefined {
  return useLiveQuery(async () => {
    if (!exerciseId) return { exercise: undefined, entries: [] }
    const exercise = await db.exercises.get(exerciseId)
    const workoutExercises = await db.workoutExercises
      .where('exerciseId')
      .equals(exerciseId)
      .toArray()

    const entries: ExerciseHistoryEntry[] = []
    for (const we of workoutExercises) {
      const session = await db.workoutSessions.get(we.workoutSessionId)
      if (!session || session.status !== 'completed') continue
      const sets = await db.exerciseSets
        .where('workoutExerciseId')
        .equals(we.id)
        .sortBy('setNumber')
      entries.push({ workoutExercise: we, sets, session })
    }
    entries.sort((a, b) =>
      (b.session.completedAt ?? '').localeCompare(a.session.completedAt ?? ''),
    )
    return { exercise, entries }
  }, [exerciseId])
}
