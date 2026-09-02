/**
 * Rest-timer hook for the focused logging view. Counts down in real time using
 * a wall-clock end time (robust to tab throttling), supports skip and ±adjust,
 * and vibrates once when it reaches zero (ignored silently where unsupported).
 *
 * At zero the timer enters a `finished` state (not hidden) so the UI can show a
 * "rest complete" cue that persists until the user records the next set or
 * dismisses it — it never silently disappears mid-view.
 */

import { useCallback, useEffect, useState } from 'react'

export type RestPhase = 'idle' | 'running' | 'finished'

export interface RestTimer {
  phase: RestPhase
  /** Convenience: phase === 'running'. */
  running: boolean
  /** Convenience: phase === 'finished'. */
  finished: boolean
  /** Seconds remaining (0 once finished/idle). */
  remaining: number
  /** Start (or restart) a countdown of `seconds`. */
  start: (seconds: number) => void
  /** Add seconds to a running or just-finished countdown (resumes running). */
  add: (seconds: number) => void
  /** Stop and clear the countdown / dismiss the finished state. */
  skip: () => void
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern)
    } catch {
      // Not supported / blocked — ignore.
    }
  }
}

export function useRestTimer(): RestTimer {
  const [phase, setPhase] = useState<RestPhase>('idle')
  // Absolute end time (ms epoch) while running.
  const [endAt, setEndAt] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)

  const start = useCallback((seconds: number) => {
    if (seconds <= 0) return
    setEndAt(Date.now() + seconds * 1000)
    setRemaining(seconds)
    setPhase('running')
  }, [])

  const add = useCallback((seconds: number) => {
    setEndAt((prev) => {
      // Base off the current end (running) or now (finished/idle) so adding time
      // after it rings resumes the countdown.
      const base = prev ?? Date.now()
      const next = Math.max(Date.now(), base + seconds * 1000)
      const left = Math.max(0, Math.round((next - Date.now()) / 1000))
      setRemaining(left)
      setPhase(left > 0 ? 'running' : 'finished')
      return left > 0 ? next : null
    })
  }, [])

  const skip = useCallback(() => {
    setEndAt(null)
    setRemaining(0)
    setPhase('idle')
  }, [])

  useEffect(() => {
    if (endAt === null) return
    const tick = () => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        vibrate([200, 100, 200])
        setEndAt(null)
        setPhase('finished') // stay visible in the finished state
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [endAt])

  return {
    phase,
    running: phase === 'running',
    finished: phase === 'finished',
    remaining,
    start,
    add,
    skip,
  }
}

/** Format seconds as m:ss. */
export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
