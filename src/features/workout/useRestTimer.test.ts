import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatRest, useRestTimer } from './useRestTimer'

/**
 * The rest timer counts down from a wall-clock end time, supports skip and
 * ±adjust, and stops at zero. Uses fake timers + a controlled Date.now.
 */

let now = 0
beforeEach(() => {
  now = 1_000_000
  vi.useFakeTimers()
  vi.setSystemTime(now)
  // navigator.vibrate is optional; stub so the finish branch doesn't throw.
  Object.defineProperty(globalThis.navigator, 'vibrate', { value: vi.fn(), configurable: true })
})

afterEach(() => {
  vi.useRealTimers()
})

function advance(seconds: number) {
  act(() => {
    vi.advanceTimersByTime(seconds * 1000)
  })
}

describe('useRestTimer', () => {
  it('starts a countdown and ticks down', () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => result.current.start(60))
    expect(result.current.running).toBe(true)
    expect(result.current.remaining).toBe(60)

    advance(10)
    expect(result.current.remaining).toBe(50)
  })

  it('reaches zero, vibrates, and enters the finished state (not hidden)', () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => result.current.start(5))
    advance(5)
    expect(result.current.remaining).toBe(0)
    expect(result.current.running).toBe(false)
    expect(result.current.finished).toBe(true)
    expect(result.current.phase).toBe('finished')
    expect(navigator.vibrate).toHaveBeenCalled()
  })

  it('stays finished until dismissed (skip clears it to idle)', () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => result.current.start(3))
    advance(3)
    expect(result.current.finished).toBe(true)
    // Time passing further does not hide it.
    advance(30)
    expect(result.current.finished).toBe(true)
    act(() => result.current.skip())
    expect(result.current.phase).toBe('idle')
    expect(result.current.finished).toBe(false)
  })

  it('adding time after finish resumes running', () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => result.current.start(3))
    advance(3)
    expect(result.current.finished).toBe(true)
    act(() => result.current.add(30))
    expect(result.current.running).toBe(true)
    expect(result.current.remaining).toBe(30)
  })

  it('skip stops the countdown immediately', () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => result.current.start(60))
    act(() => result.current.skip())
    expect(result.current.running).toBe(false)
    expect(result.current.remaining).toBe(0)
  })

  it('add(+15) extends and add(-15) shortens the remaining time', () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => result.current.start(60))
    advance(10) // 50 left
    act(() => result.current.add(15))
    expect(result.current.remaining).toBe(65)
    act(() => result.current.add(-30))
    expect(result.current.remaining).toBe(35)
  })

  it('start(0) is a no-op', () => {
    const { result } = renderHook(() => useRestTimer())
    act(() => result.current.start(0))
    expect(result.current.running).toBe(false)
  })
})

describe('formatRest', () => {
  it('formats m:ss', () => {
    expect(formatRest(0)).toBe('0:00')
    expect(formatRest(9)).toBe('0:09')
    expect(formatRest(75)).toBe('1:15')
    expect(formatRest(600)).toBe('10:00')
  })
})
