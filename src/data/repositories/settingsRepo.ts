/**
 * App settings persistence — a single row keyed `'app'` (architecture §7). Reads
 * lazily create the row with defaults so callers always get a value.
 */

import type { HealthDB } from '../db'
import { db as defaultDb } from '../db'
import type { AfterExerciseBehavior, AppSettings } from '../../domain/entities'
import { nowTimestamp } from '../../lib/dates'

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  afterExercise: 'list',
  updatedAt: '',
}

/** Read settings, creating the default row on first access. */
export async function getSettings(db: HealthDB = defaultDb): Promise<AppSettings> {
  const existing = await db.settings.get('app')
  if (existing) return existing
  const created: AppSettings = { ...DEFAULT_SETTINGS, updatedAt: nowTimestamp() }
  await db.settings.put(created)
  return created
}

/** Update the "after exercise" behavior preference. */
export async function setAfterExercise(
  behavior: AfterExerciseBehavior,
  db: HealthDB = defaultDb,
): Promise<void> {
  await db.settings.put({
    ...(await getSettings(db)),
    afterExercise: behavior,
    updatedAt: nowTimestamp(),
  })
}
