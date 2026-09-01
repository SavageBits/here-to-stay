import '@testing-library/jest-dom'
// Provide a global IndexedDB for component tests that touch the real `db`
// singleton (e.g. the first-run seed). Repository unit tests use their own
// isolated instances via data/testDb.ts instead.
import 'fake-indexeddb/auto'

import { beforeEach } from 'vitest'
import { db } from '../data/db'

// Reset the shared `db` singleton before every test so component test files
// (which all use the same instance) never leak state into one another —
// e.g. an in-progress session or a seeded exercise from a prior test.
// Repository tests use isolated databases via makeTestDb() and are unaffected.
beforeEach(async () => {
  if (db.isOpen()) {
    await Promise.all(db.tables.map((t) => t.clear()))
  }
})
