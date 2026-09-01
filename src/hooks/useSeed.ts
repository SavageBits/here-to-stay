/**
 * Run first-launch seeding once on app start (architecture §5.4), then a
 * one-time data repair that merges any duplicate exercises created before
 * add-by-name de-duplication existed. Returns `true` once startup is done.
 */

import { useEffect, useState } from 'react'
import { seedIfEmpty } from '../data/seed'
import { mergeDuplicateExercises } from '../data/repositories/exerciseRepo'
import { requestPersistentStorage } from '../lib/persistStorage'

export function useSeed(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Ask the browser to keep our IndexedDB from being evicted (best-effort;
    // independent of seeding, so failures here don't block startup).
    requestPersistentStorage().catch(() => {})

    seedIfEmpty()
      .then(() => mergeDuplicateExercises())
      .then((removed) => {
        if (removed > 0) console.info(`Merged ${removed} duplicate exercise(s).`)
      })
      .catch((err) => console.error('Startup failed', err))
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return ready
}
