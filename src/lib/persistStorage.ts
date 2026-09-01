/**
 * Request persistent storage so the browser won't evict our IndexedDB under
 * disk pressure or (on installed iOS PWAs) after inactivity. Best-effort: not
 * all browsers grant or even expose this. Safe to call on every startup.
 *
 * See the data-loss notes in docs/architecture.md §7.
 */

export interface PersistenceState {
  /** Whether the API exists in this browser. */
  supported: boolean
  /** Whether storage is currently granted persistent (exempt from eviction). */
  persisted: boolean
}

/** Current persistence state without requesting a change. */
export async function getPersistence(): Promise<PersistenceState> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    return { supported: false, persisted: false }
  }
  return { supported: true, persisted: await navigator.storage.persisted() }
}

/**
 * Ask the browser to make storage persistent. Returns the resulting state.
 * Idempotent — if already persisted, it just reports so.
 */
export async function requestPersistentStorage(): Promise<PersistenceState> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return { supported: false, persisted: false }
  }
  if (await navigator.storage.persisted()) {
    return { supported: true, persisted: true }
  }
  const persisted = await navigator.storage.persist()
  return { supported: true, persisted }
}
