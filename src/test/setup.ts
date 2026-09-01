import '@testing-library/jest-dom'
// Provide a global IndexedDB for component tests that touch the real `db`
// singleton (e.g. the first-run seed). Repository unit tests use their own
// isolated instances via data/testDb.ts instead.
import 'fake-indexeddb/auto'
