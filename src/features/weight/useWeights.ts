/**
 * Reactive weight-data hooks built on Dexie live queries — components re-render
 * automatically when weigh-ins change (architecture §6).
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import type { WeightEntry } from '../../domain/entities'
import { sevenDayAverage, trendDelta, trendLabel } from '../../domain/weightStats'
import type { TrendDirection } from '../../domain/types'
import { today } from '../../lib/dates'

/** All weigh-ins, oldest first. `undefined` while the first query is loading. */
export function useAllWeights(): WeightEntry[] | undefined {
  return useLiveQuery(() => db.weightEntries.orderBy('date').toArray(), [])
}

export interface WeightSummary {
  latest: WeightEntry | null
  todayEntry: WeightEntry | null
  average: number | null
  delta: number | null
  direction: TrendDirection
}

/**
 * Dashboard/weight summary as of today (PRD §4, §5.3): most recent weigh-in,
 * today's entry if any, the 7-day average, and the trend vs 7 days ago.
 */
export function useWeightSummary(): WeightSummary | undefined {
  return useLiveQuery(async () => {
    const entries = await db.weightEntries.orderBy('date').toArray()
    const onDate = today()
    const delta = trendDelta(entries, onDate)
    const todayEntry = entries.find((e) => e.date === onDate) ?? null
    return {
      latest: entries.length ? entries[entries.length - 1] : null,
      todayEntry,
      average: sevenDayAverage(entries, onDate),
      delta,
      direction: trendLabel(delta),
    }
  }, [])
}
