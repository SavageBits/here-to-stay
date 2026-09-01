import { describe, expect, it } from 'vitest'
import type { WeightEntry } from './entities'
import {
  movingAverageSeries,
  sevenDayAverage,
  trendDelta,
  trendLabel,
} from './weightStats'

/**
 * Tests for the 7-day rolling average and trend (PRD §5.2, §5.3, §20).
 *
 * The average uses only the weigh-ins that exist in the window; missing days are
 * excluded, never treated as zero (PRD §5.2, §18).
 */

let seq = 0
const entry = (date: string, weight: number): WeightEntry => {
  seq += 1
  const ts = `2020-01-01T00:00:${String(seq).padStart(2, '0')}.000Z`
  return { id: `e${seq}`, date, weight, createdAt: ts, updatedAt: ts }
}

describe('sevenDayAverage', () => {
  it('averages exactly 7 consecutive entries', () => {
    const entries = [
      entry('2026-01-01', 165.0),
      entry('2026-01-02', 164.4),
      entry('2026-01-03', 164.8),
      entry('2026-01-04', 164.0),
      entry('2026-01-05', 164.3),
      entry('2026-01-06', 163.9),
      entry('2026-01-07', 164.1),
    ]
    const expected = (165.0 + 164.4 + 164.8 + 164.0 + 164.3 + 163.9 + 164.1) / 7
    expect(sevenDayAverage(entries, '2026-01-07')).toBeCloseTo(expected, 5)
  })

  it('averages fewer than 7 entries using only those that exist', () => {
    const entries = [entry('2026-01-05', 164.0), entry('2026-01-07', 166.0)]
    expect(sevenDayAverage(entries, '2026-01-07')).toBeCloseTo(165.0, 5)
  })

  it('excludes missing days rather than treating them as zero', () => {
    // Only 2 of 7 days present; average must be ~164, not dragged toward 0.
    const entries = [entry('2026-01-01', 164.0), entry('2026-01-07', 164.0)]
    expect(sevenDayAverage(entries, '2026-01-07')).toBeCloseTo(164.0, 5)
  })

  it('ignores entries outside the trailing 7-day window', () => {
    const entries = [
      entry('2025-12-25', 200.0), // outside window (> 6 days before)
      entry('2026-01-07', 164.0),
    ]
    expect(sevenDayAverage(entries, '2026-01-07')).toBeCloseTo(164.0, 5)
  })

  it('reflects an edited entry (edit changes the mean)', () => {
    const before = [entry('2026-01-06', 164.0), entry('2026-01-07', 166.0)]
    expect(sevenDayAverage(before, '2026-01-07')).toBeCloseTo(165.0, 5)
    // Simulate editing the 2026-01-06 entry to 160.
    const after = [entry('2026-01-06', 160.0), entry('2026-01-07', 166.0)]
    expect(sevenDayAverage(after, '2026-01-07')).toBeCloseTo(163.0, 5)
  })

  it('reflects a deleted entry (deletion changes the mean)', () => {
    const withEntry = [entry('2026-01-06', 160.0), entry('2026-01-07', 166.0)]
    expect(sevenDayAverage(withEntry, '2026-01-07')).toBeCloseTo(163.0, 5)
    const deleted = [entry('2026-01-07', 166.0)]
    expect(sevenDayAverage(deleted, '2026-01-07')).toBeCloseTo(166.0, 5)
  })

  it('returns null when there are no entries in the window', () => {
    expect(sevenDayAverage([], '2026-01-07')).toBeNull()
  })
})

describe('trendDelta', () => {
  it('is the difference between today’s avg and the avg 7 days earlier', () => {
    const entries = [
      // window ending 2026-01-01 (single entry)
      entry('2026-01-01', 168.0),
      // window ending 2026-01-08 (single entry)
      entry('2026-01-08', 165.0),
    ]
    // avg(2026-01-08 window) = 165, avg(2026-01-01 window) = 168 => -3
    expect(trendDelta(entries, '2026-01-08')).toBeCloseTo(-3.0, 5)
  })

  it('returns null when either window is empty', () => {
    const entries = [entry('2026-01-08', 165.0)]
    expect(trendDelta(entries, '2026-01-08')).toBeNull()
  })
})

describe('trendLabel', () => {
  it('labels a drop of more than 0.25 lb as down', () => {
    expect(trendLabel(-0.3)).toBe('down')
    expect(trendLabel(-0.25)).toBe('down')
  })

  it('labels small changes as flat', () => {
    expect(trendLabel(0)).toBe('flat')
    expect(trendLabel(-0.24)).toBe('flat')
    expect(trendLabel(0.24)).toBe('flat')
  })

  it('labels a rise of 0.25 lb or more as up', () => {
    expect(trendLabel(0.25)).toBe('up')
    expect(trendLabel(1.0)).toBe('up')
  })

  it('labels null as flat', () => {
    expect(trendLabel(null)).toBe('flat')
  })
})

describe('movingAverageSeries', () => {
  it('produces one point per day with a weigh-in, each carrying its 7-day avg', () => {
    const entries = [
      entry('2026-01-01', 165.0),
      entry('2026-01-02', 163.0),
    ]
    const series = movingAverageSeries(entries, 'all')
    expect(series).toHaveLength(2)
    expect(series[0]).toMatchObject({ date: '2026-01-01', weight: 165.0 })
    expect(series[0].average).toBeCloseTo(165.0, 5)
    // 2026-01-02 average = mean(165, 163) = 164
    expect(series[1].average).toBeCloseTo(164.0, 5)
  })

  it('sorts entries chronologically regardless of input order', () => {
    const entries = [entry('2026-01-03', 163.0), entry('2026-01-01', 165.0)]
    const series = movingAverageSeries(entries, 'all')
    expect(series.map((p) => p.date)).toEqual(['2026-01-01', '2026-01-03'])
  })
})
