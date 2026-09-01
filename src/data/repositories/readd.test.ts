import { beforeEach, describe, expect, it } from 'vitest'
import type { HealthDB } from '../db'
import { makeTestDb } from '../testDb'
import { seedIfEmpty } from '../seed'
import { addSet, completeSession, startSession } from './sessionRepo'
import {
  addExerciseToTemplate,
  getTemplate,
  getTemplateExerciseViews,
  listReaddableExercises,
  listTemplateExercises,
  removeExerciseFromTemplate,
} from './templateRepo'

/**
 * Removing an exercise and re-adding it must retain its history and resume its
 * progression target (user question). Removal deletes only the template slot;
 * the logical exercise and its WorkoutExercise snapshots persist.
 */

let db: HealthDB

beforeEach(async () => {
  db = await makeTestDb()
  await seedIfEmpty(db)
})

async function findTemplateExerciseId(name: string): Promise<{ teId: string; exId: string }> {
  const template = await getTemplate('A', db)
  const rows = await listTemplateExercises(template!.id, db)
  for (const r of rows) {
    const ex = await db.exercises.get(r.exerciseId)
    if (ex?.name === name) return { teId: r.id, exId: r.exerciseId }
  }
  throw new Error(`not found: ${name}`)
}

describe('remove then re-add', () => {
  it('retains historical snapshots after removal', async () => {
    // Complete a session so Incline Press has history at target 55.
    const { session, exercises } = await startSession('A', db)
    const incline = exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!
    await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await db.workoutExercises.update(incline.id, { completed: true })
    await completeSession(session.id, db)

    const { teId, exId } = await findTemplateExerciseId('Dumbbell Incline Press')
    await removeExerciseFromTemplate(teId, db)

    // Gone from the template...
    const views = await getTemplateExerciseViews('A', db)
    expect(views.some((v) => v.name === 'Dumbbell Incline Press')).toBe(false)
    // ...but the logical exercise and its history snapshot remain.
    expect(await db.exercises.get(exId)).toBeDefined()
    const historySnaps = await db.workoutExercises.where('exerciseId').equals(exId).count()
    expect(historySnaps).toBeGreaterThan(0)
  })

  it('resumes at the template target when removed before any completed session', async () => {
    // Deadlift is seeded at target 135 and has NO completed history yet.
    const { teId, exId } = await findTemplateExerciseId('Deadlift')
    await removeExerciseFromTemplate(teId, db)

    const readdable = await listReaddableExercises('A', db)
    const candidate = readdable.find((r) => r.exerciseId === exId)
    expect(candidate).toBeDefined()
    expect(candidate!.hasHistory).toBe(false)
    // The bug was: this resolved to null ("bodyweight"). It must be 135.
    expect(candidate!.lastTarget).toBe(135)

    // Re-adding restores that target.
    const template = await getTemplate('A', db)
    await addExerciseToTemplate(
      template!.id,
      { exerciseId: exId, targetWeight: candidate!.lastTarget },
      db,
    )
    const views = await getTemplateExerciseViews('A', db)
    expect(views.find((v) => v.exerciseId === exId)?.targetWeight).toBe(135)
  })

  it('preserves an edited target across remove/re-add (no completed history)', async () => {
    // Edit Deadlift's target to 145, then remove and check the resume value.
    const { teId, exId } = await findTemplateExerciseId('Deadlift')
    await (await import('./templateRepo')).setTemplateTargetWeight(teId, 145, db)
    await removeExerciseFromTemplate(teId, db)

    const readdable = await listReaddableExercises('A', db)
    expect(readdable.find((r) => r.exerciseId === exId)?.lastTarget).toBe(145)
  })

  it('offers the removed exercise as re-addable, resuming at its last achieved target', async () => {
    // Success at 55 → next target 60.
    const { session, exercises } = await startSession('A', db)
    const incline = exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!
    await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await db.workoutExercises.update(incline.id, { completed: true })
    await completeSession(session.id, db)

    const { teId, exId } = await findTemplateExerciseId('Dumbbell Incline Press')
    await removeExerciseFromTemplate(teId, db)

    const readdable = await listReaddableExercises('A', db)
    const candidate = readdable.find((r) => r.exerciseId === exId)
    expect(candidate).toBeDefined()
    expect(candidate!.hasHistory).toBe(true)
    expect(candidate!.lastTarget).toBe(60) // resumes at last achieved target
  })

  it('re-adding reuses the same exercise id so history is reconnected', async () => {
    const { session, exercises } = await startSession('A', db)
    const incline = exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!
    await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await db.workoutExercises.update(incline.id, { completed: true })
    await completeSession(session.id, db)

    const { teId, exId } = await findTemplateExerciseId('Dumbbell Incline Press')
    await removeExerciseFromTemplate(teId, db)

    const template = await getTemplate('A', db)
    await addExerciseToTemplate(template!.id, { exerciseId: exId, targetWeight: 60 }, db)

    // Same exercise id back in the template, at the resumed target.
    const views = await getTemplateExerciseViews('A', db)
    const readded = views.find((v) => v.exerciseId === exId)
    expect(readded).toBeDefined()
    expect(readded!.targetWeight).toBe(60)

    // A new session sees the full history for that exercise id (old + none-new).
    const historyCount = await db.workoutExercises.where('exerciseId').equals(exId).count()
    expect(historyCount).toBe(1)

    // And starting a fresh session suggests 60 (progression continuity).
    const next = await startSession('A', db)
    const nextIncline = next.exercises.find((e) => e.exerciseId === exId)
    expect(nextIncline?.targetWeightSnapshot).toBe(60)
  })

  it('creating a NEW exercise with the same name does NOT reconnect history', async () => {
    const { session, exercises } = await startSession('A', db)
    const incline = exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')!
    await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await db.workoutExercises.update(incline.id, { completed: true })
    await completeSession(session.id, db)

    const { teId, exId } = await findTemplateExerciseId('Dumbbell Incline Press')
    await removeExerciseFromTemplate(teId, db)

    const template = await getTemplate('A', db)
    const created = await addExerciseToTemplate(
      template!.id,
      { name: 'Dumbbell Incline Press', targetWeight: 55 },
      db,
    )
    // Distinct id → its own fresh history, separate from the original.
    expect(created.exerciseId).not.toBe(exId)
    expect(await db.workoutExercises.where('exerciseId').equals(created.exerciseId).count()).toBe(0)
  })
})
