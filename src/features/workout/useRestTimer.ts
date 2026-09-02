/**
 * Rest-timer hook for the focused logging view. Counts down in real time using
 * a wall-clock end time (robust to tab throttling), supports skip and ±adjust,
 * and vibrates once when it reaches zero (ignored silently where unsupported).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface RestTimer {
  /** Whether a countdown is currently active. */
  running: boolean
  /** Seconds remaining (0 when finished/idle). */
  remaining: number
  /** Start (or restart) a countdown of `seconds`. */
  start: (seconds: number) => void
  /** Add seconds to a running (or finished) countdown. */
  add: (seconds: number) => void
  /** Stop and clear the countdown. */
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
  // Absolute end time (ms epoch). null = idle.
  const [endAt, setEndAt] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)
  const firedRef = useRef(false)

  const clearEnd = useCallback(() => {
    setEndAt(null)
    setRemaining(0)
  }, [])

  const start = useCallback((seconds: number) => {
    if (seconds <= 0) return
    firedRef.current = false
    setEndAt(Date.now() + seconds * 1000)
    setRemaining(seconds)
  }, [])

  const add = useCallback((seconds: number) => {
    setEndAt((prev) => {
      const base = prev ?? Date.now()
      const next = Math.max(Date.now(), base + seconds * 1000)
      firedRef.current = false
      setRemaining(Math.max(0, Math.round((next - Date.now()) / 1000)))
      return next
    })
  }, [])

  const skip = useCallback(() => {
    clearEnd()
  }, [clearEnd])

  useEffect(() => {
    if (endAt === null) return
    const tick = () => {
      const left = Math.max(0, Math.round((endAt - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true
        vibrate([200, 100, 200])
        setEndAt(null)
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [endAt])

  return { running: endAt !== null, remaining, start, add, skip }
}

/** Format seconds as m:ss. */
export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
