/**
 * Reactive workout-session hooks (architecture §6). Loads a session with its
 * exercises (ordered) and their sets (ordered), live-updating as sets change.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { ExerciseSet, WorkoutExercise, WorkoutSession } from '../../domain/entities'

export interface LoadedSessionView {
  session: WorkoutSession
  exercises: Array<WorkoutExercise & { sets: ExerciseSet[] }>
}

/** Load a session by id with its exercises + sets. `undefined` while loading. */
export function useSession(sessionId: string | undefined): LoadedSessionView | undefined | null {
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
