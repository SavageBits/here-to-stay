/**
 * Calendar-day helpers (architecture §7).
 *
 * Weigh-ins are keyed by local calendar date (`YYYY-MM-DD`) so "one weigh-in per
 * day" and the rolling 7-day window (PRD §5.1–5.2) are computed on whole days,
 * independent of time-of-day and timezone drift within a day.
 */

import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import type { DateISO, Timestamp } from '../domain/types'

/** Format a `Date` as a local `YYYY-MM-DD` calendar-date string. */
export function toDateISO(date: Date): DateISO {
  return format(date, 'yyyy-MM-dd')
}

/** The user's current local calendar date as `YYYY-MM-DD`. */
export function today(now: Date = new Date()): DateISO {
  return toDateISO(now)
}

/** Parse a `YYYY-MM-DD` string to a `Date` at local midnight. */
export function fromDateISO(date: DateISO): Date {
  return parseISO(date)
}

/** Return the calendar date `n` days before the given date (as `YYYY-MM-DD`). */
export function subtractDays(date: DateISO, n: number): DateISO {
  return toDateISO(subDays(fromDateISO(date), n))
}

/**
 * Whole calendar days from `from` to `to` (positive when `to` is later).
 * Ignores time-of-day.
 */
export function calendarDaysBetween(from: DateISO, to: DateISO): number {
  return differenceInCalendarDays(fromDateISO(to), fromDateISO(from))
}

/** Whether `date` falls within the inclusive `[start, end]` calendar range. */
export function isWithinRange(date: DateISO, start: DateISO, end: DateISO): boolean {
  return date >= start && date <= end
}

/** Current instant as an ISO-8601 timestamp, for `createdAt` / `updatedAt`. */
export function nowTimestamp(now: Date = new Date()): Timestamp {
  return now.toISOString()
}
