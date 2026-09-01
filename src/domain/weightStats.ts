/**
 * Rolling 7-day average and weight trend (PRD §5.2, §5.3).
 *
 * Pure functions over a list of weigh-ins. The average includes only the days
 * that actually have a weigh-in in the trailing 7-day window — missing days are
 * excluded, never counted as zero (PRD §5.2, §18).
 */

import type { WeightEntry } from './entities'
import type { DateISO, TrendDirection, TrendRange } from './types'
import { calendarDaysBetween, subtractDays } from '../lib/dates'

/** Trend threshold in pounds (PRD §5.3). */
export const TREND_THRESHOLD_LB = 0.25

/** Number of days in the rolling window, inclusive of the anchor day. */
export const WINDOW_DAYS = 7

export interface SeriesPoint {
  date: DateISO
  weight: number
  /** 7-day trailing average as of this date. */
  average: number
}

/**
 * Arithmetic mean of all weigh-ins in `[onDate - 6 days, onDate]`, using only
 * the entries that exist. Returns `null` when the window has no weigh-ins.
 */
export function sevenDayAverage(entries: WeightEntry[], onDate: DateISO): number | null {
  const start = subtractDays(onDate, WINDOW_DAYS - 1)
  const inWindow = entries.filter((e) => e.date >= start && e.date <= onDate)
  if (inWindow.length === 0) return null
  const sum = inWindow.reduce((acc, e) => acc + e.weight, 0)
  return sum / inWindow.length
}

/**
 * Change in the 7-day average versus the 7-day average 7 days earlier (PRD §4,
 * §5.3). Returns `null` if either window is empty.
 */
export function trendDelta(entries: WeightEntry[], onDate: DateISO): number | null {
  const current = sevenDayAverage(entries, onDate)
  const prior = sevenDayAverage(entries, subtractDays(onDate, WINDOW_DAYS))
  if (current === null || prior === null) return null
  return current - prior
}

/** Map a numeric change to a direction label using the ±0.25 lb threshold (PRD §5.3). */
export function trendLabel(delta: number | null): TrendDirection {
  if (delta === null) return 'flat'
  if (delta <= -TREND_THRESHOLD_LB) return 'down'
  if (delta >= TREND_THRESHOLD_LB) return 'up'
  return 'flat'
}

/** Number of days spanned by a chart range, or `null` for "all". */
function rangeDays(range: TrendRange): number | null {
  switch (range) {
    case '30d':
      return 30
    case '90d':
      return 90
    case '6m':
      return 182
    case '1y':
      return 365
    case 'all':
      return null
  }
}

/**
 * Build the chart series (PRD §5.3): one point per day that has a weigh-in,
 * sorted chronologically, each carrying its 7-day trailing average. The range is
 * measured back from the most recent weigh-in.
 */
export function movingAverageSeries(entries: WeightEntry[], range: TrendRange): SeriesPoint[] {
  if (entries.length === 0) return []

  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const latest = sorted[sorted.length - 1].date

  const days = rangeDays(range)
  const visible =
    days === null
      ? sorted
      : sorted.filter((e) => calendarDaysBetween(e.date, latest) <= days - 1)

  return visible.map((e) => ({
    date: e.date,
    weight: e.weight,
    // Average over the full entry set so the window can reach across the
    // range boundary rather than being truncated by it.
    average: sevenDayAverage(sorted, e.date) ?? e.weight,
  }))
}
