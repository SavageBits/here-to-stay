/**
 * Shared domain types and enums.
 *
 * Pure types only — no React, no Dexie, no I/O. See docs/architecture.md §4.
 */

/** The two alternating workout templates (PRD §6). */
export type WorkoutType = 'A' | 'B'

/** Status of a workout session (PRD §15 WorkoutSession). */
export type WorkoutStatus = 'in_progress' | 'completed'

/**
 * A calendar date with no time component, formatted `YYYY-MM-DD` in the user's
 * local timezone. Used to key weigh-ins one-per-day (PRD §5.1, §15). See
 * `lib/dates.ts` for construction/parsing helpers.
 */
export type DateISO = string

/**
 * A full timestamp, formatted as an ISO-8601 string (`new Date().toISOString()`).
 * Used for `createdAt` / `updatedAt` and session start/complete times.
 */
export type Timestamp = string

/** Trend direction for the 7-day weight average (PRD §5.3). */
export type TrendDirection = 'down' | 'flat' | 'up'

/**
 * The result of a single set as consumed by the progression algorithm.
 * A `null` weight means bodyweight / non-weighted (PRD §8.2, §16.14).
 */
export interface SetResult {
  weight: number | null
  reps: number
}

/** Selectable ranges for the weight trend chart (PRD §5.3). */
export type TrendRange = '30d' | '90d' | '6m' | '1y' | 'all'
