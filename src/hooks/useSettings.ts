/** Reactive app settings via a Dexie live query (architecture §6). */

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import type { AppSettings } from '../domain/entities'
import { DEFAULT_SETTINGS } from '../data/repositories/settingsRepo'

/** Current settings; falls back to defaults until the row loads/exists. */
export function useSettings(): AppSettings {
  const settings = useLiveQuery(() => db.settings.get('app'), [])
  return settings ?? DEFAULT_SETTINGS
}
