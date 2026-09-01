/**
 * Workout session persistence and progression evaluation (PRD §7, §8, §11).
 *
 * `completeSession` and `recomputeSession` both derive each exercise's
 * `nextTargetWeight` from `evaluateProgression(target, sets)` — never by mutating
 * a running counter — so completing, reopening, and re-saving a workout can never
 * double-apply the +5 lb increment (PRD §11, §16.15).
 */

import type { HealthDB } from '../db'
import { db as defaultDb } from '../db'
import type {
  ExerciseSet,
  WorkoutExercise,
  WorkoutSession,
} from '../../domain/entities'
import type { SetResult, WorkoutType } from '../../domain/types'
import { evaluateProgression } from '../../domain/progression'
import {
  buildSessionFromPrevious,
  type PreviousExerciseResult,
} from '../../domain/workoutBuilder'
import { newId } from '../../lib/ids'
import { nowTimestamp } from '../../lib/dates'
import { getTemplateExerciseViews } from './templateRepo'

/** A fully-loaded session for the UI: session + its exercises + their sets. */
export interface LoadedSession {
  session: WorkoutSession
  exercises: Array<WorkoutExercise & { sets: ExerciseSet[] }>
}

/** The most recent COMPLETED session of a type, as builder input (PRD §7). */
async function previousResults(
  type: WorkoutType,
  db: HealthDB,
): Promise<PreviousExerciseResult[] | null> {
  const last = await db.workoutSessions
    .where('[workoutType+completedAt]')
    .between([type, ''], [type, '￿'], true, true)
    .last()
  if (!last) return null

  const exercises = await db.workoutExercises
    .where('workoutSessionId')
    .equals(last.id)
    .toArray()
  return exercises.map((e) => ({
    exerciseId: e.exerciseId,
    nextTargetWeight: e.nextTargetWeight ?? e.targetWeightSnapshot,
  }))
}

/**
 * Start a new session of `type`, seeded from the previous same-type session and
 * the current template (PRD §7). Persists the session, its exercise snapshots,
 * and one default set per exercise.
 */
export async function startSession(
  type: WorkoutType,
  db: HealthDB = defaultDb,
): Promise<LoadedSession> {
  const template = await getTemplateExerciseViews(type, db)
  const previous = await previousResults(type, db)
  const draft = buildSessionFromPrevious(type, template, previous)
  const ts = nowTimestamp()

  const session: WorkoutSession = {
    id: newId(),
    workoutType: type,
    startedAt: ts,
    completedAt: null,
    status: 'in_progress',
    createdAt: ts,
    updatedAt: ts,
  }

  const exercises: Array<WorkoutExercise & { sets: ExerciseSet[] }> = []

  await db.transaction(
    'rw',
    db.workoutSessions,
    db.workoutExercises,
    db.exerciseSets,
    async () => {
      await db.workoutSessions.add(session)
      for (const d of draft.exercises) {
        const we: WorkoutExercise = {
          id: newId(),
          workoutSessionId: session.id,
          exerciseId: d.exerciseId,
          exerciseNameSnapshot: d.exerciseNameSnapshot,
          sortOrder: d.sortOrder,
          targetWeightSnapshot: d.targetWeightSnapshot,
          completed: false,
          progressionAchieved: null,
          nextTargetWeight: null,
          createdAt: ts,
          updatedAt: ts,
        }
        await db.workoutExercises.add(we)
        const sets: ExerciseSet[] = []
        for (const s of d.sets) {
          const set: ExerciseSet = {
            id: newId(),
            workoutExerciseId: we.id,
            setNumber: s.setNumber,
            weight: s.weight,
            reps: s.reps,
            createdAt: ts,
            updatedAt: ts,
          }
          await db.exerciseSets.add(set)
          sets.push(set)
        }
        exercises.push({ ...we, sets })
      }
    },
  )

  return { session, exercises }
}

/** Load a session with its exercises (ordered) and sets (ordered). */
export async function loadSession(
  sessionId: string,
  db: HealthDB = defaultDb,
): Promise<LoadedSession | undefined> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return undefined
  const exercises = await db.workoutExercises
    .where('workoutSessionId')
    .equals(sessionId)
    .sortBy('sortOrder')
  const withSets = await Promise.all(
    exercises.map(async (e) => ({
      ...e,
      sets: await db.exerciseSets
        .where('workoutExerciseId')
        .equals(e.id)
        .sortBy('setNumber'),
    })),
  )
  return { session, exercises: withSets }
}

/** Append a set to an exercise, defaulting its number to the next in sequence. */
export async function addSet(
  workoutExerciseId: string,
  set: { weight: number | null; reps: number },
  db: HealthDB = defaultDb,
): Promise<ExerciseSet> {
  return db.transaction('rw', db.exerciseSets, async () => {
    const existing = await db.exerciseSets
      .where('workoutExerciseId')
      .equals(workoutExerciseId)
      .toArray()
    const setNumber = existing.length + 1
    const ts = nowTimestamp()
    const row: ExerciseSet = {
      id: newId(),
      workoutExerciseId,
      setNumber,
      weight: set.weight,
      reps: set.reps,
      createdAt: ts,
      updatedAt: ts,
    }
    await db.exerciseSets.add(row)
    return row
  })
}

/** Edit a set's weight and/or reps. */
export async function updateSet(
  id: string,
  changes: Partial<Pick<ExerciseSet, 'weight' | 'reps'>>,
  db: HealthDB = defaultDb,
): Promise<void> {
  await db.exerciseSets.update(id, { ...changes, updatedAt: nowTimestamp() })
}

/** Delete a set and re-pack the remaining set numbers to stay 1..n. */
export async function deleteSet(id: string, db: HealthDB = defaultDb): Promise<void> {
  await db.transaction('rw', db.exerciseSets, async () => {
    const set = await db.exerciseSets.get(id)
    if (!set) return
    await db.exerciseSets.delete(id)
    const remaining = await db.exerciseSets
      .where('workoutExerciseId')
      .equals(set.workoutExerciseId)
      .sortBy('setNumber')
    const ts = nowTimestamp()
    await Promise.all(
      remaining.map((r, i) =>
        r.setNumber === i + 1
          ? Promise.resolve(0)
          : db.exerciseSets.update(r.id, { setNumber: i + 1, updatedAt: ts }),
      ),
    )
  })
}

/** Mark an exercise as done / not done (skipping leaves target unchanged). */
export async function setExerciseCompleted(
  workoutExerciseId: string,
  completed: boolean,
  db: HealthDB = defaultDb,
): Promise<void> {
  await db.workoutExercises.update(workoutExerciseId, {
    completed,
    updatedAt: nowTimestamp(),
  })
}

/**
 * Re-evaluate progression for every exercise in a session from its current sets
 * and write the results (PRD §11). Deterministic and idempotent: it derives
 * `progressionAchieved` and `nextTargetWeight` fresh each time, so calling it
 * repeatedly on unchanged data yields identical results. Also updates the
 * template's current target so the next session suggests the advanced weight.
 */
export async function recomputeSession(
  sessionId: string,
  db: HealthDB = defaultDb,
): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.workoutSessions,
      db.workoutExercises,
      db.exerciseSets,
      db.templateExercises,
      db.workoutTemplates,
    ],
    async () => {
      const exercises = await db.workoutExercises
        .where('workoutSessionId')
        .equals(sessionId)
        .toArray()
      const ts = nowTimestamp()

      for (const we of exercises) {
        const sets = await db.exerciseSets
          .where('workoutExerciseId')
          .equals(we.id)
          .toArray()
        const setResults: SetResult[] = sets.map((s) => ({
          weight: s.weight,
          reps: s.reps,
        }))

        const outcome = evaluateProgression({
          targetWeight: we.targetWeightSnapshot,
          sets: setResults,
          skipped: !we.completed,
        })

        await db.workoutExercises.update(we.id, {
          progressionAchieved: outcome.successful,
          nextTargetWeight: outcome.nextTargetWeight,
          updatedAt: ts,
        })

        // Advance the template's current target on success so the next session
        // suggests the new weight. Idempotent: we SET it to the derived target,
        // never add to it.
        if (outcome.successful) {
          const session = await db.workoutSessions.get(sessionId)
          if (session) {
            const template = await db.workoutTemplates
              .where('type')
              .equals(session.workoutType)
              .first()
            if (template) {
              const row = await db.templateExercises
                .where('workoutTemplateId')
                .equals(template.id)
                .and((r) => r.exerciseId === we.exerciseId)
                .first()
              if (row) {
                await db.templateExercises.update(row.id, {
                  targetWeight: outcome.nextTargetWeight,
                  updatedAt: ts,
                })
              }
            }
          }
        }
      }
    },
  )
}

/**
 * Explicitly finish a workout (PRD §11): stamp completion, mark it completed,
 * then evaluate progression via `recomputeSession`. Completing an
 * already-completed session just re-stamps and recomputes — no double increment.
 */
export async function completeSession(
  sessionId: string,
  db: HealthDB = defaultDb,
): Promise<void> {
  const ts = nowTimestamp()
  await db.workoutSessions.update(sessionId, {
    status: 'completed',
    completedAt: ts,
    updatedAt: ts,
  })
  await recomputeSession(sessionId, db)
}

/** Reopen a completed session for editing (PRD §11). Progression is preserved. */
export async function reopenSession(
  sessionId: string,
  db: HealthDB = defaultDb,
): Promise<void> {
  await db.workoutSessions.update(sessionId, {
    status: 'in_progress',
    updatedAt: nowTimestamp(),
  })
}

/** Completed sessions, most recent first (PRD §12 history). */
export async function listCompletedSessions(
  db: HealthDB = defaultDb,
): Promise<WorkoutSession[]> {
  const sessions = await db.workoutSessions
    .where('status')
    .equals('completed')
    .toArray()
  return sessions.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
}

/** The in-progress session, if one exists (PRD §17 — abandoned/resumed). */
export async function getActiveSession(
  db: HealthDB = defaultDb,
): Promise<WorkoutSession | undefined> {
  return db.workoutSessions.where('status').equals('in_progress').first()
}
