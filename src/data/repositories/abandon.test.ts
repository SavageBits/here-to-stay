import { beforeEach, describe, expect, it } from 'vitest'
import type { HealthDB } from '../db'
import { makeTestDb } from '../testDb'
import { seedIfEmpty } from '../seed'
import {
  abandonSession,
  addSet,
  completeSession,
  getActiveSession,
  startSession,
} from './sessionRepo'
import { getTemplateExerciseViews } from './templateRepo'

let db: HealthDB

beforeEach(async () => {
  db = await makeTestDb()
  await seedIfEmpty(db)
})

describe('abandonSession (PRD §17)', () => {
  it('deletes the session and all its exercises and sets', async () => {
    const { session, exercises } = await startSession('A', db)
    const incline = exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!
    await addSet(incline.id, { weight: 55, reps: 12 }, db)

    await abandonSession(session.id, db)

    expect(await db.workoutSessions.get(session.id)).toBeUndefined()
    expect(await db.workoutExercises.where('workoutSessionId').equals(session.id).count()).toBe(0)
    expect(await db.exerciseSets.where('workoutExerciseId').equals(incline.id).count()).toBe(0)
    expect(await getActiveSession(db)).toBeUndefined()
  })

  it('does not affect progression targets', async () => {
    // A prior successful session advanced Incline Press to 60.
    const first = await startSession('A', db)
    const incline1 = first.exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!
    await addSet(incline1.id, { weight: 55, reps: 12 }, db)
    await db.workoutExercises.update(incline1.id, { completed: true })
    await completeSession(first.session.id, db)
    expect(
      (await getTemplateExerciseViews('A', db)).find((v) => v.name === 'Dumbbell Incline Press')
        ?.targetWeight,
    ).toBe(60)

    // Start a second session, log something, then abandon it.
    const second = await startSession('A', db)
    const incline2 = second.exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!
    await addSet(incline2.id, { weight: 60, reps: 12 }, db)
    await abandonSession(second.session.id, db)

    // Target unchanged; the abandoned session left no trace.
    expect(
      (await getTemplateExerciseViews('A', db)).find((v) => v.name === 'Dumbbell Incline Press')
        ?.targetWeight,
    ).toBe(60)
    expect(await db.workoutSessions.count()).toBe(1) // only the completed one
  })

  it('leaves completed sessions in history untouched', async () => {
    const done = await startSession('A', db)
    await completeSession(done.session.id, db)
    const abandoned = await startSession('A', db)
    await abandonSession(abandoned.session.id, db)

    const completed = await db.workoutSessions.where('status').equals('completed').toArray()
    expect(completed).toHaveLength(1)
    expect(completed[0].id).toBe(done.session.id)
  })
})
