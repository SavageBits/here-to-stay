import { describe, expect, it } from 'vitest'
import { evaluateProgression } from './progression'
import type { SetResult } from './types'

/**
 * Tests for the progressive-overload rules (PRD §9, §16, §20).
 *
 * A weighted exercise session is successful only when (PRD §9.2):
 *   - at least one set was completed, AND
 *   - every completed set has reps >= 12, AND
 *   - every completed set weight >= current target.
 * Success => next target = target + 5. Failure => target unchanged (never reduced).
 */

const set = (weight: number | null, reps: number): SetResult => ({ weight, reps })

describe('evaluateProgression — required PRD §20 examples', () => {
  it('55x12 x4 => success, next target 60', () => {
    const out = evaluateProgression({
      targetWeight: 55,
      sets: [set(55, 12), set(55, 12), set(55, 12), set(55, 12)],
      skipped: false,
    })
    expect(out.successful).toBe(true)
    expect(out.nextTargetWeight).toBe(60)
  })

  it('60x12, 60x12, 60x10, 55x12 => not successful, stays 60', () => {
    const out = evaluateProgression({
      targetWeight: 60,
      sets: [set(60, 12), set(60, 12), set(60, 10), set(55, 12)],
      skipped: false,
    })
    expect(out.successful).toBe(false)
    expect(out.nextTargetWeight).toBe(60)
  })

  it('60x12 x4 => success, next target 65', () => {
    const out = evaluateProgression({
      targetWeight: 60,
      sets: [set(60, 12), set(60, 12), set(60, 12), set(60, 12)],
      skipped: false,
    })
    expect(out.successful).toBe(true)
    expect(out.nextTargetWeight).toBe(65)
  })
})

describe('evaluateProgression — set-level rules', () => {
  it('one set below target weight => no increase', () => {
    const out = evaluateProgression({
      targetWeight: 60,
      sets: [set(60, 12), set(59, 12)],
      skipped: false,
    })
    expect(out.successful).toBe(false)
    expect(out.nextTargetWeight).toBe(60)
  })

  it('one set below 12 reps => no increase', () => {
    const out = evaluateProgression({
      targetWeight: 60,
      sets: [set(60, 12), set(60, 11)],
      skipped: false,
    })
    expect(out.successful).toBe(false)
    expect(out.nextTargetWeight).toBe(60)
  })

  it('all sets above 12 reps at target => success (reps above 12 count)', () => {
    const out = evaluateProgression({
      targetWeight: 60,
      sets: [set(60, 13), set(60, 15), set(60, 12)],
      skipped: false,
    })
    expect(out.successful).toBe(true)
    expect(out.nextTargetWeight).toBe(65)
  })

  it('sets above target weight still count as success', () => {
    const out = evaluateProgression({
      targetWeight: 60,
      sets: [set(65, 12), set(65, 12)],
      skipped: false,
    })
    expect(out.successful).toBe(true)
    expect(out.nextTargetWeight).toBe(65)
  })
})

describe('evaluateProgression — added weight mid-exercise (target too easy)', () => {
  it('advances to the highest weight completed when it exceeds target + 5', () => {
    // Target 55, added weight up to 65 across clean 12-rep sets.
    const out = evaluateProgression({
      targetWeight: 55,
      sets: [set(55, 12), set(60, 12), set(65, 12), set(65, 12)],
      skipped: false,
    })
    expect(out.successful).toBe(true)
    expect(out.nextTargetWeight).toBe(65) // max(55+5, 65)
  })

  it('uses target + 5 when the highest weight does not exceed it', () => {
    // Highest clean weight (57) is below target + 5 (60) → still +5.
    const out = evaluateProgression({
      targetWeight: 55,
      sets: [set(55, 12), set(57, 12)],
      skipped: false,
    })
    expect(out.successful).toBe(true)
    expect(out.nextTargetWeight).toBe(60)
  })

  it('a short set anywhere means no change, even with heavier weight attempted', () => {
    // 65 attempted but only 8 reps → not 12x4 → target unchanged (stays 55).
    const out = evaluateProgression({
      targetWeight: 55,
      sets: [set(55, 12), set(60, 12), set(65, 8)],
      skipped: false,
    })
    expect(out.successful).toBe(false)
    expect(out.nextTargetWeight).toBe(55)
  })

  it('exactly target + 5 when the heaviest equals the stepped target', () => {
    const out = evaluateProgression({
      targetWeight: 55,
      sets: [set(55, 12), set(60, 12)],
      skipped: false,
    })
    expect(out.successful).toBe(true)
    expect(out.nextTargetWeight).toBe(60) // max(60, 60)
  })

  it('zero completed sets => not successful, target unchanged', () => {
    const out = evaluateProgression({ targetWeight: 60, sets: [], skipped: false })
    expect(out.successful).toBe(false)
    expect(out.nextTargetWeight).toBe(60)
  })
})

describe('evaluateProgression — skipped and bodyweight', () => {
  it('skipped exercise => not successful, target unchanged (PRD §16.13)', () => {
    const out = evaluateProgression({
      targetWeight: 60,
      sets: [set(60, 12), set(60, 12)],
      skipped: true,
    })
    expect(out.successful).toBe(false)
    expect(out.nextTargetWeight).toBe(60)
  })

  it('bodyweight (null target) => no +5 rule (PRD §16.14)', () => {
    const out = evaluateProgression({
      targetWeight: null,
      sets: [set(null, 12), set(null, 12), set(null, 12)],
      skipped: false,
    })
    expect(out.successful).toBe(false)
    expect(out.nextTargetWeight).toBe(null)
  })

  it('bodyweight (target 0) => no +5 rule', () => {
    const out = evaluateProgression({
      targetWeight: 0,
      sets: [set(0, 12), set(0, 12)],
      skipped: false,
    })
    expect(out.successful).toBe(false)
    expect(out.nextTargetWeight).toBe(0)
  })
})

describe('evaluateProgression — idempotency (PRD §11, §16.15)', () => {
  it('re-evaluating an unchanged successful session does not double-increment', () => {
    const input = {
      targetWeight: 55,
      sets: [set(55, 12), set(55, 12), set(55, 12), set(55, 12)],
      skipped: false,
    }
    const first = evaluateProgression(input)
    const second = evaluateProgression(input)
    expect(first.nextTargetWeight).toBe(60)
    expect(second.nextTargetWeight).toBe(60)
  })

  it('never reduces the target on a failed session (PRD §16.10-11)', () => {
    const out = evaluateProgression({
      targetWeight: 60,
      sets: [set(50, 12), set(50, 12)],
      skipped: false,
    })
    expect(out.nextTargetWeight).toBe(60)
  })
})

describe('evaluateProgression — full 55 -> 60 -> 60 -> 65 sequence (PRD §9.4)', () => {
  it('walks the required example deterministically', () => {
    // Session 1: 55 all done => 60
    const s1 = evaluateProgression({
      targetWeight: 55,
      sets: [set(55, 12), set(55, 12), set(55, 12), set(55, 12)],
      skipped: false,
    })
    expect(s1.nextTargetWeight).toBe(60)

    // Session 2: 60 with a miss => stays 60
    const s2 = evaluateProgression({
      targetWeight: s1.nextTargetWeight,
      sets: [set(60, 12), set(60, 12), set(60, 10), set(55, 12)],
      skipped: false,
    })
    expect(s2.nextTargetWeight).toBe(60)

    // Session 3: 60 all done => 65
    const s3 = evaluateProgression({
      targetWeight: s2.nextTargetWeight,
      sets: [set(60, 12), set(60, 12), set(60, 12), set(60, 12)],
      skipped: false,
    })
    expect(s3.nextTargetWeight).toBe(65)
  })
})
