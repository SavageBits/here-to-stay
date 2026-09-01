import { beforeEach, describe, expect, it } from 'vitest'
import type { HealthDB } from '../db'
import { makeTestDb } from '../testDb'
import { seedIfEmpty } from '../seed'
import {
  deleteWeight,
  getWeightByDate,
  listAllWeights,
  upsertWeight,
} from './weightRepo'
import { getTemplate, getTemplateExerciseViews, setTemplateTargetWeight } from './templateRepo'
import { renameExercise } from './exerciseRepo'
import {
  addSet,
  completeSession,
  loadSession,
  recomputeSession,
  startSession,
  updateSet,
} from './sessionRepo'
import { exportBackup, importBackup } from './backupRepo'

let db: HealthDB

beforeEach(async () => {
  db = await makeTestDb()
})

describe('weightRepo — one weigh-in per day (PRD §5.1)', () => {
  it('upserts by date: a second weigh-in for the same day replaces the first', async () => {
    await upsertWeight('2026-01-10', 164.8, db)
    await upsertWeight('2026-01-10', 165.2, db)
    const all = await listAllWeights(db)
    expect(all).toHaveLength(1)
    expect(all[0].weight).toBe(165.2)
  })

  it('keeps separate entries for separate days', async () => {
    await upsertWeight('2026-01-10', 164.0, db)
    await upsertWeight('2026-01-11', 163.5, db)
    expect(await listAllWeights(db)).toHaveLength(2)
  })

  it('supports decimals, edit, and delete', async () => {
    const e = await upsertWeight('2026-01-10', 164.85, db)
    expect((await getWeightByDate('2026-01-10', db))?.weight).toBe(164.85)
    await deleteWeight(e.id, db)
    expect(await getWeightByDate('2026-01-10', db)).toBeUndefined()
  })
})

describe('seed (PRD §6)', () => {
  it('creates Workout A and B with default exercises, and is idempotent', async () => {
    await seedIfEmpty(db)
    await seedIfEmpty(db) // second call must not duplicate
    expect(await getTemplate('A', db)).toBeDefined()
    expect(await getTemplate('B', db)).toBeDefined()
    const a = await getTemplateExerciseViews('A', db)
    expect(a.length).toBeGreaterThan(0)
    expect(a.map((e) => e.name)).toContain('Deadlift')
    expect(await db.workoutTemplates.count()).toBe(2)
  })
})

describe('sessionRepo — start from previous (PRD §7)', () => {
  it('first-ever session uses the current template targets', async () => {
    await seedIfEmpty(db)
    const { exercises } = await startSession('A', db)
    const incline = exercises.find((e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press')
    expect(incline?.targetWeightSnapshot).toBe(55)
    // No sets are seeded — the focused view starts at Set 1 (user records each).
    expect(incline?.sets).toHaveLength(0)
  })

  it('a completed successful session advances the next session’s target by 5', async () => {
    await seedIfEmpty(db)
    const first = await startSession('A', db)
    const incline = first.exercises.find(
      (e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press',
    )!
    // Perform 55x12 x4.
    await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await db.workoutExercises.update(incline.id, { completed: true })
    await completeSession(first.session.id, db)

    // Next session should suggest 60.
    const second = await startSession('A', db)
    const inclineNext = second.exercises.find(
      (e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press',
    )
    expect(inclineNext?.targetWeightSnapshot).toBe(60)
  })
})

describe('sessionRepo — idempotency (PRD §11, §16.15)', () => {
  it('re-completing / recomputing an unchanged session does not double-increment', async () => {
    await seedIfEmpty(db)
    const s = await startSession('A', db)
    const incline = s.exercises.find(
      (e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press',
    )!
    await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await db.workoutExercises.update(incline.id, { completed: true })

    await completeSession(s.session.id, db)
    const afterFirst = (await db.workoutExercises.get(incline.id))!.nextTargetWeight
    expect(afterFirst).toBe(60)

    // Re-save several times — the derived target must stay 60.
    await recomputeSession(s.session.id, db)
    await completeSession(s.session.id, db)
    await recomputeSession(s.session.id, db)
    const afterMany = (await db.workoutExercises.get(incline.id))!.nextTargetWeight
    expect(afterMany).toBe(60)

    // And the template target advanced exactly once, to 60.
    const views = await getTemplateExerciseViews('A', db)
    expect(views.find((v) => v.name === 'Dumbbell Incline Press')?.targetWeight).toBe(60)
  })

  it('editing a completed workout to a failure retains (does not lower) the target', async () => {
    await seedIfEmpty(db)
    const s = await startSession('A', db)
    const incline = s.exercises.find(
      (e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press',
    )!
    const set = await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await db.workoutExercises.update(incline.id, { completed: true })
    await completeSession(s.session.id, db)
    expect((await db.workoutExercises.get(incline.id))!.nextTargetWeight).toBe(60)

    // Edit a set down to a failing rep count and recompute.
    await updateSet(set.id, { weight: 55, reps: 8 }, db)
    await recomputeSession(s.session.id, db)
    const after = (await db.workoutExercises.get(incline.id))!
    expect(after.progressionAchieved).toBe(false)
    expect(after.nextTargetWeight).toBe(55) // retained target, not lowered
  })

  it('adding weight mid-session bumps the template target to the highest clean weight', async () => {
    await seedIfEmpty(db)
    const s = await startSession('A', db)
    const incline = s.exercises.find(
      (e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press',
    )! // target 55
    // Clean 12s but progressively heavier — the target was too easy.
    await addSet(incline.id, { weight: 55, reps: 12 }, db)
    await addSet(incline.id, { weight: 60, reps: 12 }, db)
    await addSet(incline.id, { weight: 65, reps: 12 }, db)
    await addSet(incline.id, { weight: 65, reps: 12 }, db)
    await db.workoutExercises.update(incline.id, { completed: true })
    await completeSession(s.session.id, db)

    // Next target = highest clean weight (65), not just 55 + 5.
    expect((await db.workoutExercises.get(incline.id))!.nextTargetWeight).toBe(65)
    const views = await getTemplateExerciseViews('A', db)
    expect(views.find((v) => v.name === 'Dumbbell Incline Press')?.targetWeight).toBe(65)

    // And the following session suggests 65.
    const next = await startSession('A', db)
    const nextIncline = next.exercises.find(
      (e) => e.exerciseNameSnapshot === 'Dumbbell Incline Press',
    )
    expect(nextIncline?.targetWeightSnapshot).toBe(65)
  })
})

describe('templateRepo / exerciseRepo — history immune to rename (PRD §16.3-4)', () => {
  it('renaming an exercise does not rewrite past session snapshots', async () => {
    await seedIfEmpty(db)
    const s = await startSession('A', db)
    await completeSession(s.session.id, db)

    const views = await getTemplateExerciseViews('A', db)
    const deadlift = views.find((v) => v.name === 'Deadlift')!
    // rename the logical exercise
    const before = await loadSession(s.session.id, db)
    const snap = before!.exercises.find((e) => e.exerciseId === deadlift.exerciseId)!
    expect(snap.exerciseNameSnapshot).toBe('Deadlift')

    await renameExercise(deadlift.exerciseId, 'Trap Bar Deadlift', db)

    // Current template reflects the new name...
    const after = await getTemplateExerciseViews('A', db)
    expect(after.find((v) => v.exerciseId === deadlift.exerciseId)?.name).toBe(
      'Trap Bar Deadlift',
    )
    // ...but the historical session snapshot is unchanged.
    const reloaded = await loadSession(s.session.id, db)
    const snap2 = reloaded!.exercises.find((e) => e.exerciseId === deadlift.exerciseId)!
    expect(snap2.exerciseNameSnapshot).toBe('Deadlift')
  })

  it('setTemplateTargetWeight updates the current suggestion', async () => {
    await seedIfEmpty(db)
    const template = await getTemplate('A', db)
    const rows = await db.templateExercises
      .where('workoutTemplateId')
      .equals(template!.id)
      .toArray()
    await setTemplateTargetWeight(rows[0].id, 999, db)
    const views = await getTemplateExerciseViews('A', db)
    expect(views.some((v) => v.targetWeight === 999)).toBe(true)
  })
})

describe('backupRepo — round-trip (PRD §19)', () => {
  it('export then import restores identical data', async () => {
    await seedIfEmpty(db)
    await upsertWeight('2026-01-10', 164.8, db)
    const s = await startSession('A', db)
    await completeSession(s.session.id, db)

    const backup = await exportBackup(db)

    // Wipe by importing into a fresh db, then compare.
    const db2 = await makeTestDb()
    await importBackup(backup, db2)

    expect(await db2.weightEntries.count()).toBe(await db.weightEntries.count())
    expect(await db2.workoutSessions.count()).toBe(await db.workoutSessions.count())
    expect(await db2.exerciseSets.count()).toBe(await db.exerciseSets.count())
    expect((await getWeightByDate('2026-01-10', db2))?.weight).toBe(164.8)
  })

  it('rejects an unsupported backup version', async () => {
    const bad = { ...(await exportBackup(db)), version: 99 as unknown as 1 }
    await expect(importBackup(bad, db)).rejects.toThrow()
  })

  it('exports version 2 including settings', async () => {
    await seedIfEmpty(db)
    const backup = await exportBackup(db)
    expect(backup.version).toBe(2)
    expect(Array.isArray(backup.settings)).toBe(true)
  })

  it('imports a legacy v1 backup (no settings field)', async () => {
    await seedIfEmpty(db)
    await upsertWeight('2026-02-01', 170.2, db)
    const v2 = await exportBackup(db)
    // Simulate an older backup: v1 shape without a settings array.
    const { settings: _omit, ...rest } = v2
    const legacy = { ...rest, version: 1 as const }

    const db2 = await makeTestDb()
    await importBackup(legacy, db2)
    expect((await getWeightByDate('2026-02-01', db2))?.weight).toBe(170.2)
  })
})
