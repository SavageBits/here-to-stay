import { beforeEach, describe, expect, it } from 'vitest'
import type { HealthDB } from '../db'
import { makeTestDb } from '../testDb'
import { seedIfEmpty } from '../seed'
import { createExercise, mergeDuplicateExercises } from './exerciseRepo'
import { addSet, completeSession, startSession } from './sessionRepo'
import {
  addExerciseToTemplate,
  getTemplate,
  getTemplateExerciseViews,
  listReaddableExercises,
  listTemplateExercises,
  removeExerciseFromTemplate,
} from './templateRepo'

let db: HealthDB

beforeEach(async () => {
  db = await makeTestDb()
  await seedIfEmpty(db)
})

async function templateExerciseIdFor(name: string): Promise<{ teId: string; exId: string }> {
  const template = await getTemplate('A', db)
  const rows = await listTemplateExercises(template!.id, db)
  for (const r of rows) {
    const ex = await db.exercises.get(r.exerciseId)
    if (ex?.name === name) return { teId: r.id, exId: r.exerciseId }
  }
  throw new Error(`not found: ${name}`)
}

describe('add-by-name de-duplication (prevention)', () => {
  it('reuses an existing exercise when adding by an equivalent name', async () => {
    const { teId, exId } = await templateExerciseIdFor('Deadlift')
    await removeExerciseFromTemplate(teId, db)

    const template = await getTemplate('A', db)
    // Re-typing the name (different case/spacing) must reuse the same exercise.
    const row = await addExerciseToTemplate(template!.id, { name: '  deadlift ' }, db)
    expect(row.exerciseId).toBe(exId)

    const deadlifts = (await db.exercises.toArray()).filter(
      (e) => e.name.trim().toLowerCase() === 'deadlift',
    )
    expect(deadlifts).toHaveLength(1)
  })

  it('re-adding by name resumes the prior target (no bodyweight duplicate)', async () => {
    const { teId, exId } = await templateExerciseIdFor('Deadlift')
    await removeExerciseFromTemplate(teId, db)

    const readd = await listReaddableExercises('A', db)
    const candidate = readd.filter((r) => r.name.toLowerCase() === 'deadlift')
    // Exactly one Deadlift candidate, resuming at 135 (not a bodyweight twin).
    expect(candidate).toHaveLength(1)
    expect(candidate[0].exerciseId).toBe(exId)
    expect(candidate[0].lastTarget).toBe(135)
  })
})

describe('mergeDuplicateExercises (cleanup of pre-existing dupes)', () => {
  it('consolidates two same-name exercises into one, keeping the one with history', async () => {
    // The seeded Deadlift gains completed history at target 135.
    const { session, exercises } = await startSession('A', db)
    const seededDeadlift = exercises.find((e) => e.exerciseNameSnapshot === 'Deadlift')!
    await addSet(seededDeadlift.id, { weight: 135, reps: 12 }, db)
    await db.workoutExercises.update(seededDeadlift.id, { completed: true })
    await completeSession(session.id, db)
    const canonicalId = seededDeadlift.exerciseId

    // Simulate the old bug: a second bodyweight "Deadlift" with no history.
    const dupe = await createExercise('Deadlift', db)
    expect((await db.exercises.toArray()).filter((e) => e.name === 'Deadlift')).toHaveLength(2)

    const removed = await mergeDuplicateExercises(db)
    expect(removed).toBe(1)

    // One Deadlift left, and it's the one with history.
    const remaining = (await db.exercises.toArray()).filter((e) => e.name === 'Deadlift')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(canonicalId)
    expect(await db.exercises.get(dupe.id)).toBeUndefined()

    // History still attached to the canonical exercise.
    expect(await db.workoutExercises.where('exerciseId').equals(canonicalId).count()).toBe(1)
  })

  it('re-points a duplicate’s history to the canonical exercise', async () => {
    // Two Deadlifts, each with its own history via separate sessions.
    const first = await startSession('A', db)
    const d1 = first.exercises.find((e) => e.exerciseNameSnapshot === 'Deadlift')!
    await addSet(d1.id, { weight: 135, reps: 12 }, db)
    await db.workoutExercises.update(d1.id, { completed: true })
    await completeSession(first.session.id, db)
    const keepId = d1.exerciseId

    // Manually craft a duplicate exercise + a history snapshot pointing at it.
    const dupe = await createExercise('Deadlift', db)
    await db.workoutExercises.add({
      id: 'we-dupe',
      workoutSessionId: first.session.id,
      exerciseId: dupe.id,
      exerciseNameSnapshot: 'Deadlift',
      sortOrder: 99,
      targetWeightSnapshot: 140,
      completed: true,
      progressionAchieved: false,
      nextTargetWeight: 140,
      createdAt: 't',
      updatedAt: 't',
    })

    await mergeDuplicateExercises(db)

    // The duplicate's snapshot now points at the surviving exercise.
    const moved = await db.workoutExercises.get('we-dupe')
    expect(moved?.exerciseId).toBe(keepId)
  })
})

describe('getTemplateExerciseViews stays unique after merge', () => {
  it('does not list the same exercise twice', async () => {
    // Put a duplicate directly into the template, then merge.
    const template = await getTemplate('A', db)
    const dupe = await createExercise('Deadlift', db)
    await addExerciseToTemplate(template!.id, { exerciseId: dupe.id, targetWeight: 0 }, db)

    await mergeDuplicateExercises(db)

    const views = await getTemplateExerciseViews('A', db)
    const deadlifts = views.filter((v) => v.name === 'Deadlift')
    expect(deadlifts).toHaveLength(1)
  })
})
