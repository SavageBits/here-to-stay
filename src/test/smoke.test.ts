import { describe, expect, it } from 'vitest'

// Smoke test: verifies the Vitest toolchain is wired up.
// Replaced by real domain tests in Phase 2.
describe('toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2)
  })
})
