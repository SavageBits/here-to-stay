import { describe, expect, it } from 'vitest'
import { DEFAULT_REPS, buildSessionFromPrevious } from './workoutBuilder'
import type { TemplateExerciseView, PreviousExerciseResult } from './workoutBuilder'

/**
 * Tests for building a new session from the previous same-type workout (PRD §7).
 *
 * Copy exercise order, CURRENT names, and suggested target weight (the previous
 * session's next target where present). Do NOT copy reps. Default new sets to 12.
 * With no previous session, fall back to the current template.
 */

const tmpl = (
  exerciseId: string,
  name: string,
  sortOrder: number,
  targetWeight: number | null,
): TemplateExerciseView => ({ exerciseId, name, sortOrder, targetWeight })

describe('buildSessionFromPrevious — no previous session', () => {
  it('uses the current template for a first-ever Workout A', () => {
    const template = [
      tmpl('e1', 'Deadlift', 0, 135),
      tmpl('e2', 'Pull-up', 1, null),
      tmpl('e3', 'Incline Press', 2, 55),
    ]
    const draft = buildSessionFromPrevious('A', template, null)

    expect(draft.workoutType).toBe('A')
    expect(draft.exercises.map((e) => e.exerciseId)).toEqual(['e1', 'e2', 'e3'])
    expect(draft.exercises.map((e) => e.exerciseNameSnapshot)).toEqual([
      'Deadlift',
      'Pull-up',
      'Incline Press',
    ])
    expect(draft.exercises.map((e) => e.targetWeightSnapshot)).toEqual([135, null, 55])
  })

  it('works for a first-ever Workout B', () => {
    const draft = buildSessionFromPrevious('B', [tmpl('e9', 'Squat', 0, 185)], null)
    expect(draft.workoutType).toBe('B')
    expect(draft.exercises).toHaveLength(1)
    expect(draft.exercises[0].targetWeightSnapshot).toBe(185)
  })
})

describe('buildSessionFromPrevious — with a previous session', () => {
  const template = [
    tmpl('e1', 'Deadlift', 0, 135),
    tmpl('e3', 'Incline Press', 2, 55),
  ]

  it('uses the previous session’s next target as the new suggested target', () => {
    const previous: PreviousExerciseResult[] = [
      { exerciseId: 'e1', nextTargetWeight: 140 },
      { exerciseId: 'e3', nextTargetWeight: 60 },
    ]
    const draft = buildSessionFromPrevious('A', template, previous)
    expect(draft.exercises.map((e) => e.targetWeightSnapshot)).toEqual([140, 60])
  })

  it('falls back to the template target when the previous session lacks that exercise', () => {
    // e3 was added to the template after the previous session ran.
    const previous: PreviousExerciseResult[] = [{ exerciseId: 'e1', nextTargetWeight: 140 }]
    const draft = buildSessionFromPrevious('A', template, previous)
    expect(draft.exercises.find((e) => e.exerciseId === 'e1')?.targetWeightSnapshot).toBe(140)
    expect(draft.exercises.find((e) => e.exerciseId === 'e3')?.targetWeightSnapshot).toBe(55)
  })

  it('uses CURRENT template names, not the previous session’s snapshot (PRD §7.3)', () => {
    const renamedTemplate = [tmpl('e1', 'Trap Bar Deadlift', 0, 135)]
    const previous: PreviousExerciseResult[] = [
      { exerciseId: 'e1', nextTargetWeight: 140, exerciseNameSnapshot: 'Deadlift' },
    ]
    const draft = buildSessionFromPrevious('A', renamedTemplate, previous)
    expect(draft.exercises[0].exerciseNameSnapshot).toBe('Trap Bar Deadlift')
  })

  it('respects the current template order and set (added/removed exercises)', () => {
    // Previous had e1 and an old e2 that has since been removed from the template.
    const previous: PreviousExerciseResult[] = [
      { exerciseId: 'e1', nextTargetWeight: 140 },
      { exerciseId: 'e2', nextTargetWeight: 999 },
    ]
    const draft = buildSessionFromPrevious('A', template, previous)
    expect(draft.exercises.map((e) => e.exerciseId)).toEqual(['e1', 'e3'])
  })
})

describe('buildSessionFromPrevious — set defaults (PRD §7.4-7.5, §8.1)', () => {
  it('seeds no sets; the focused view starts at Set 1 and the user records each', () => {
    const template = [tmpl('e1', 'Incline Press', 0, 55)]
    const previous: PreviousExerciseResult[] = [{ exerciseId: 'e1', nextTargetWeight: 60 }]
    const draft = buildSessionFromPrevious('A', template, previous)

    const ex = draft.exercises[0]
    // No pre-recorded sets are copied from the previous session (PRD §7.4).
    expect(ex.sets).toHaveLength(0)
    // The suggested target is still carried on the exercise for pre-fill.
    expect(ex.targetWeightSnapshot).toBe(60)
    // Reps default to 12 when the UI records a set.
    expect(DEFAULT_REPS).toBe(12)
  })

  it('sorts exercises by the template sortOrder', () => {
    const template = [
      tmpl('e3', 'Third', 2, null),
      tmpl('e1', 'First', 0, null),
      tmpl('e2', 'Second', 1, null),
    ]
    const draft = buildSessionFromPrevious('A', template, null)
    expect(draft.exercises.map((e) => e.exerciseNameSnapshot)).toEqual([
      'First',
      'Second',
      'Third',
    ])
  })

  it('carries the per-exercise rest seconds into the draft snapshot', () => {
    const template: TemplateExerciseView[] = [
      { exerciseId: 'e1', name: 'Deadlift', sortOrder: 0, targetWeight: 135, restSeconds: 180 },
      { exerciseId: 'e2', name: 'Plank', sortOrder: 1, targetWeight: null }, // no rest set
    ]
    const draft = buildSessionFromPrevious('A', template, null)
    expect(draft.exercises[0].restSecondsSnapshot).toBe(180)
    expect(draft.exercises[1].restSecondsSnapshot).toBeNull()
  })
})
