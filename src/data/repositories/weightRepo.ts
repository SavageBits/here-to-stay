/**
 * Weigh-in persistence (PRD §5.1). Enforces one primary entry per calendar day
 * via upsert-by-date, backed by the `&date` unique index in db.ts.
 */

import type { HealthDB } from '../db'
import { db as defaultDb } from '../db'
import type { WeightEntry } from '../../domain/entities'
import type { DateISO } from '../../domain/types'
import { newId } from '../../lib/ids'
import { nowTimestamp, subtractDays, today } from '../../lib/dates'

/**
 * Record or replace the weigh-in for a calendar day. If an entry already exists
 * for `date`, its weight is updated (PRD §5.1 — one primary entry per day).
 */
export async function upsertWeight(
  date: DateISO,
  weight: number,
  db: HealthDB = defaultDb,
): Promise<WeightEntry> {
  return db.transaction('rw', db.weightEntries, async () => {
    const existing = await db.weightEntries.where('date').equals(date).first()
    const ts = nowTimestamp()
    if (existing) {
      const updated: WeightEntry = { ...existing, weight, updatedAt: ts }
      await db.weightEntries.put(updated)
      return updated
    }
    const entry: WeightEntry = {
      id: newId(),
      date,
      weight,
      createdAt: ts,
      updatedAt: ts,
    }
    await db.weightEntries.add(entry)
    return entry
  })
}

/** Edit an existing weigh-in by id (weight and/or date). */
export async function updateWeight(
  id: string,
  changes: Partial<Pick<WeightEntry, 'weight' | 'date'>>,
  db: HealthDB = defaultDb,
): Promise<void> {
  await db.weightEntries.update(id, { ...changes, updatedAt: nowTimestamp() })
}

/** Delete a weigh-in by id (PRD §5.1). */
export async function deleteWeight(id: string, db: HealthDB = defaultDb): Promise<void> {
  await db.weightEntries.delete(id)
}

/** The weigh-in for a given calendar day, if any. */
export async function getWeightByDate(
  date: DateISO,
  db: HealthDB = defaultDb,
): Promise<WeightEntry | undefined> {
  return db.weightEntries.where('date').equals(date).first()
}

/** All weigh-ins in the inclusive `[start, end]` date range, oldest first. */
export async function listWeightsInRange(
  start: DateISO,
  end: DateISO,
  db: HealthDB = defaultDb,
): Promise<WeightEntry[]> {
  return db.weightEntries.where('date').between(start, end, true, true).sortBy('date')
}

/** Every weigh-in, oldest first. */
export async function listAllWeights(db: HealthDB = defaultDb): Promise<WeightEntry[]> {
  return db.weightEntries.orderBy('date').toArray()
}

/** The most recent weigh-in, if any (PRD §4 dashboard). */
export async function latestWeight(db: HealthDB = defaultDb): Promise<WeightEntry | undefined> {
  return db.weightEntries.orderBy('date').last()
}

/** Weigh-ins from the trailing `days` window ending today, for the average. */
export async function recentWeights(
  days: number,
  db: HealthDB = defaultDb,
): Promise<WeightEntry[]> {
  const end = today()
  const start = subtractDays(end, days - 1)
  return listWeightsInRange(start, end, db)
}
