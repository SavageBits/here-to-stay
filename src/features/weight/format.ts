/** Display helpers for weight values and trend labels (PRD §5.3). */

import type { TrendDirection } from '../../domain/types'

/** Round to one decimal for display without trailing noise. */
export function fmtWeight(value: number | null): string {
  if (value === null) return '—'
  return value.toFixed(1)
}

/** Signed delta, e.g. "+0.4" / "-1.2" / "0.0". */
export function fmtDelta(delta: number | null): string {
  if (delta === null) return '—'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}`
}

export const DIRECTION_LABEL: Record<TrendDirection, string> = {
  down: 'Trending down',
  flat: 'Roughly flat',
  up: 'Trending up',
}

export const DIRECTION_ICON: Record<TrendDirection, string> = {
  down: '↓',
  flat: '→',
  up: '↑',
}
