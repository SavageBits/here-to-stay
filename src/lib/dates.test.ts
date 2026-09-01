import { describe, expect, it } from 'vitest'
import { timestampToLocalDate, today, toDateISO } from './dates'

/**
 * timestampToLocalDate must return the LOCAL calendar date, not the UTC date.
 * The bug it fixes: `timestamp.slice(0, 10)` returns the UTC day, which is
 * "tomorrow" for an evening timestamp in a timezone behind UTC.
 */
describe('timestampToLocalDate', () => {
  it('returns the local date for a given instant', () => {
    // Build a timestamp from a real Date so the expectation matches the local TZ.
    const d = new Date(2026, 7, 31, 20, 30) // Aug 31 2026, 8:30pm local
    expect(timestampToLocalDate(d.toISOString())).toBe('2026-08-31')
  })

  it('agrees with toDateISO for the same instant', () => {
    const d = new Date(2026, 0, 15, 23, 45) // 11:45pm local
    expect(timestampToLocalDate(d.toISOString())).toBe(toDateISO(d))
  })

  it('a workout started now is labelled with today’s local date', () => {
    const startedAt = new Date().toISOString() // how sessions store startedAt
    expect(timestampToLocalDate(startedAt)).toBe(today())
  })
})
