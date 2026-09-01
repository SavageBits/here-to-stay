/**
 * Suggest the next workout type (PRD §4): the opposite of the most recently
 * completed workout; default A when there is no history. Also surfaces any
 * in-progress session so the dashboard can offer to resume it.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { WorkoutSession } from '../../domain/entities'
import type { WorkoutType } from '../../domain/types'

export interface NextWorkout {
  suggested: WorkoutType
  lastCompleted: WorkoutSession | null
  active: WorkoutSession | null
}

export function useNextWorkout(): NextWorkout | undefined {
  return useLiveQuery(async () => {
    const completed = await db.workoutSessions.where('status').equals('completed').toArray()
    completed.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    const lastCompleted = completed[0] ?? null
    const suggested: WorkoutType = lastCompleted?.workoutType === 'A' ? 'B' : 'A'
    const active = (await db.workoutSessions.where('status').equals('in_progress').first()) ?? null
    return { suggested, lastCompleted, active }
  }, [])
}
