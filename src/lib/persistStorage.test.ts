import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPersistence, requestPersistentStorage } from './persistStorage'

/**
 * persistStorage wraps the navigator.storage API defensively — it must not throw
 * when the API is missing, and should report/request persistence when present.
 */

const original = globalThis.navigator

afterEach(() => {
  Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true })
  vi.restoreAllMocks()
})

function setNavigator(storage: unknown) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { storage },
    configurable: true,
  })
}

describe('getPersistence', () => {
  it('reports unsupported when the API is absent', async () => {
    setNavigator(undefined)
    expect(await getPersistence()).toEqual({ supported: false, persisted: false })
  })

  it('reports the current persisted state when supported', async () => {
    setNavigator({ persisted: () => Promise.resolve(true) })
    expect(await getPersistence()).toEqual({ supported: true, persisted: true })
  })
})

describe('requestPersistentStorage', () => {
  it('returns unsupported when persist() is unavailable', async () => {
    setNavigator(undefined)
    expect(await requestPersistentStorage()).toEqual({ supported: false, persisted: false })
  })

  it('does not re-request when already persisted', async () => {
    const persist = vi.fn(() => Promise.resolve(false))
    setNavigator({ persisted: () => Promise.resolve(true), persist })
    const result = await requestPersistentStorage()
    expect(result).toEqual({ supported: true, persisted: true })
    expect(persist).not.toHaveBeenCalled()
  })

  it('requests persistence when not yet granted', async () => {
    const persist = vi.fn(() => Promise.resolve(true))
    setNavigator({ persisted: () => Promise.resolve(false), persist })
    const result = await requestPersistentStorage()
    expect(persist).toHaveBeenCalledOnce()
    expect(result).toEqual({ supported: true, persisted: true })
  })
})
