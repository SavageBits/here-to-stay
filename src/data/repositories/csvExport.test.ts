import { beforeEach, describe, expect, it } from 'vitest'
import type { HealthDB } from '../db'
import { makeTestDb } from '../testDb'
import { seedIfEmpty } from '../seed'
import { addSet, completeSession, startSession } from './sessionRepo'
import { exportWeightsCsv, exportWorkoutSetsCsv } from './backupRepo'
import { upsertWeight } from './weightRepo'

let db: HealthDB

beforeEach(async () => {
  db = await makeTestDb()
  await seedIfEmpty(db)
})

describe('exportWeightsCsv', () => {
  it('emits a header and one row per weigh-in, oldest first', async () => {
    await upsertWeight('2026-01-02', 164.4, db)
    await upsertWeight('2026-01-01', 165.0, db)
    const csv = await exportWeightsCsv(db)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('date,weight')
    expect(lines[1]).toBe('2026-01-01,165')
    expect(lines[2]).toBe('2026-01-02,164.4')
  })
})

describe('exportWorkoutSetsCsv', () => {
  it('emits one row per set of a completed workout', async () => {
    const { session, exercises } = await startSession('A', db)
    const incline = exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!
    await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await addSet(incline.id, { weight: 55, reps: 10 }, db)
    await db.workoutExercises.update(incline.id, { completed: true })
    await completeSession(session.id, db)

    const csv = await exportWorkoutSetsCsv(db)
    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'date,workout,exercise,set,weight,reps,target_weight,progression_achieved',
    )
    const inclineRows = lines.filter((l) => l.includes('Dumbbell Incline Press'))
    expect(inclineRows).toHaveLength(2)
    expect(inclineRows[0]).toContain(',A,Dumbbell Incline Press,1,55,12,55,')
    // Two sets, one below 12 reps → not achieved.
    expect(inclineRows[0].endsWith(',no')).toBe(true)
  })

  it('quotes exercise names containing commas', async () => {
    const { session, exercises } = await startSession('A', db)
    const first = exercises[0]
    await db.workoutExercises.update(first.id, { exerciseNameSnapshot: 'Row, Barbell' })
    await addSet(first.id, { weight: 95, reps: 12 }, db)
    await completeSession(session.id, db)

    const csv = await exportWorkoutSetsCsv(db)
    expect(csv).toContain('"Row, Barbell"')
  })

  it('excludes in-progress (non-completed) sessions', async () => {
    const { exercises } = await startSession('A', db)
    await addSet(exercises[0].id, { weight: 100, reps: 12 }, db)
    // Not completed.
    const csv = await exportWorkoutSetsCsv(db)
    expect(csv.split('\n')).toHaveLength(1) // header only
  })
})
