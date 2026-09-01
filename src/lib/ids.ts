/**
 * Stable unique identifiers for entities (architecture §7).
 *
 * Uses the platform `crypto.randomUUID()` — available in all modern browsers
 * and in jsdom / Node 19+ used by tests.
 */
export function newId(): string {
  return crypto.randomUUID()
}
