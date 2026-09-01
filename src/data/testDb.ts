/**
 * Test-only helper: build an isolated in-memory HealthDB backed by
 * fake-indexeddb. Each call uses a unique database name and its own IndexedDB
 * factory so tests never share state. Not imported by application code.
 */

import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { HealthDB } from './db'

let counter = 0

/** Create and open a fresh, isolated database for a single test. */
export async function makeTestDb(): Promise<HealthDB> {
  counter += 1
  const db = new HealthDB(`test-${counter}`, {
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  })
  await db.open()
  return db
}
