/**
 * Run first-launch seeding once on app start (architecture §5.4).
 * Returns `true` once seeding has completed (or was already done).
 */

import { useEffect, useState } from 'react'
import { seedIfEmpty } from '../data/seed'

export function useSeed(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    seedIfEmpty()
      .catch((err) => console.error('Seeding failed', err))
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return ready
}
