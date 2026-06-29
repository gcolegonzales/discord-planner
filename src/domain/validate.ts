/**
 * Pure validators — no discord.js, no I/O, no config globals.
 * All external limits (e.g. maxDays) are passed in so these stay testable.
 */

import { DateTime, IANAZone } from 'luxon';

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a YYYY-MM-DD string into a Luxon DateTime (UTC-zone, time 00:00:00).
 * Returns null if the string is not a valid calendar date.
 */
function parseDate(raw: string): DateTime | null {
  // Luxon's fromISO will accept "2024-07-01"
  const dt = DateTime.fromISO(raw, { zone: 'utc' });
  if (!dt.isValid) return null;
  // Reject strings that aren't exactly YYYY-MM-DD (e.g. "2024-7-1")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return dt;
}

/**
 * Parse a HH:MM 24-hour time string.
 * Returns null if invalid.
 */
function parseTime(raw: string): { hour: number; minute: number } | null {
  if (!/^\d{2}:\d{2}$/.test(raw)) return null;
  const [h, m] = raw.split(':').map(Number);
  if (h === undefined || m === undefined) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { hour: h, minute: m };
}

/** Compare two YYYY-MM-DD strings lexicographically (safe because format is fixed-width). */
function dateLE(a: string, b: string): boolean {
  return a <= b;
}

/** Clamp a date string into [lo, hi]. */
function clampDate(date: string, lo: string, hi: string): string {
  if (date < lo) return lo;
  if (date > hi) return hi;
  return date;
}

// ---------------------------------------------------------------------------
// validateEventInput
// ---------------------------------------------------------------------------

export interface EventInput {
  title: string;
  start: string;
  end: string;
  timezone: string;
}

export interface EventInputOptions {
  maxDays: number;
}

export interface ValidatedEventInput {
  title: string;
  start: string; // YYYY-MM-DD (verified)
  end: string;   // YYYY-MM-DD (verified)
  timezone: string; // verified IANA
  spanDays: number; // inclusive day count
}

/**
 * Validate the inputs for creating an event.
 *
 * Rules:
 * - title: 1–100 characters (non-empty after trim)
 * - start/end: valid YYYY-MM-DD calendar dates
 * - start <= end
 * - inclusive span (end - start + 1 days) <= maxDays
 * - timezone: valid IANA zone (luxon)
 */
export function validateEventInput(
  input: EventInput,
  options: EventInputOptions,
): ValidationResult<ValidatedEventInput> {
  const title = input.title.trim();
  if (title.length === 0) {
    return { ok: false, error: 'Title must not be empty.' };
  }
  if (title.length > 100) {
    return { ok: false, error: 'Title must be 100 characters or fewer.' };
  }

  const startDt = parseDate(input.start);
  if (!startDt) {
    return { ok: false, error: `Start date "${input.start}" is not a valid YYYY-MM-DD date.` };
  }

  const endDt = parseDate(input.end);
  if (!endDt) {
    return { ok: false, error: `End date "${input.end}" is not a valid YYYY-MM-DD date.` };
  }

  if (!dateLE(input.start, input.end)) {
    return { ok: false, error: `Start date (${input.start}) must be on or before end date (${input.end}).` };
  }

  // Inclusive span: endDt - startDt + 1 days
  const spanDays = Math.round(endDt.diff(startDt, 'days').days) + 1;
  if (spanDays > options.maxDays) {
    return {
      ok: false,
      error: `Event span (${spanDays} days) exceeds the maximum of ${options.maxDays} days.`,
    };
  }

  if (!IANAZone.isValidZone(input.timezone)) {
    return { ok: false, error: `"${input.timezone}" is not a valid IANA timezone.` };
  }

  return {
    ok: true,
    value: {
      title,
      start: input.start,
      end: input.end,
      timezone: input.timezone,
      spanDays,
    },
  };
}

// ---------------------------------------------------------------------------
// validateDateRange
// ---------------------------------------------------------------------------

export interface ValidatedDateRange {
  from: string; // YYYY-MM-DD, clamped
  to: string;   // YYYY-MM-DD, clamped
  kind: 'date' | 'date_range';
}

/**
 * Validate and clamp a whole-day busy range.
 *
 * @param from       - YYYY-MM-DD required
 * @param to         - YYYY-MM-DD optional; defaults to `from` (single date)
 * @param eventStart - YYYY-MM-DD event window start (inclusive)
 * @param eventEnd   - YYYY-MM-DD event window end (inclusive)
 *
 * Rules:
 * - from/to must parse as YYYY-MM-DD
 * - from <= to
 * - clamp [from, to] to [eventStart, eventEnd]
 * - if entirely outside the event window, return an error
 */
export function validateDateRange(
  from: string,
  to: string | undefined,
  eventStart: string,
  eventEnd: string,
): ValidationResult<ValidatedDateRange> {
  const rawTo = to ?? from;

  if (!parseDate(from)) {
    return { ok: false, error: `"${from}" is not a valid YYYY-MM-DD date.` };
  }
  if (!parseDate(rawTo)) {
    return { ok: false, error: `"${rawTo}" is not a valid YYYY-MM-DD date.` };
  }

  if (!dateLE(from, rawTo)) {
    return { ok: false, error: `From date (${from}) must be on or before to date (${rawTo}).` };
  }

  // Check entirely outside event window
  if (rawTo < eventStart || from > eventEnd) {
    return {
      ok: false,
      error: `Date range ${from}–${rawTo} is entirely outside the event window (${eventStart}–${eventEnd}).`,
    };
  }

  // Clamp to event window
  const clampedFrom = clampDate(from, eventStart, eventEnd);
  const clampedTo   = clampDate(rawTo, eventStart, eventEnd);

  const kind: 'date' | 'date_range' = clampedFrom === clampedTo ? 'date' : 'date_range';

  return {
    ok: true,
    value: { from: clampedFrom, to: clampedTo, kind },
  };
}

// ---------------------------------------------------------------------------
// validateTimeRange
// ---------------------------------------------------------------------------

export interface TimeRangeInput {
  fromDate: string;
  toDate?: string;
  startTime: string; // HH:MM 24h
  endTime: string;   // HH:MM 24h
}

export interface ValidatedTimeRange {
  fromDate: string; // YYYY-MM-DD, clamped
  toDate: string;   // YYYY-MM-DD, clamped
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  /** True when either time falls outside the 10:00–24:00 bookable window. */
  outsideBookableWindow: boolean;
}

/** Minutes since midnight for a parsed time. */
function toMinutes(t: { hour: number; minute: number }): number {
  return t.hour * 60 + t.minute;
}

/**
 * Validate and clamp a time-range busy entry.
 *
 * Rules:
 * - fromDate/toDate must be valid YYYY-MM-DD; toDate defaults to fromDate
 * - fromDate <= toDate
 * - date span clamped to event window; entirely-outside → error
 * - startTime/endTime must be valid HH:MM 24h
 * - startTime < endTime (strictly)
 * - note (not error) if times fall outside 10:00–24:00
 */
export function validateTimeRange(
  input: TimeRangeInput,
  eventStart: string,
  eventEnd: string,
): ValidationResult<ValidatedTimeRange> {
  const rawToDate = input.toDate ?? input.fromDate;

  if (!parseDate(input.fromDate)) {
    return { ok: false, error: `"${input.fromDate}" is not a valid YYYY-MM-DD date.` };
  }
  if (!parseDate(rawToDate)) {
    return { ok: false, error: `"${rawToDate}" is not a valid YYYY-MM-DD date.` };
  }
  if (!dateLE(input.fromDate, rawToDate)) {
    return {
      ok: false,
      error: `From date (${input.fromDate}) must be on or before to date (${rawToDate}).`,
    };
  }

  // Check entirely outside event window
  if (rawToDate < eventStart || input.fromDate > eventEnd) {
    return {
      ok: false,
      error: `Date range ${input.fromDate}–${rawToDate} is entirely outside the event window (${eventStart}–${eventEnd}).`,
    };
  }

  // Clamp dates to event window
  const clampedFrom = clampDate(input.fromDate, eventStart, eventEnd);
  const clampedTo   = clampDate(rawToDate, eventStart, eventEnd);

  const startT = parseTime(input.startTime);
  if (!startT) {
    return { ok: false, error: `Start time "${input.startTime}" is not a valid HH:MM 24-hour time.` };
  }
  const endT = parseTime(input.endTime);
  if (!endT) {
    return { ok: false, error: `End time "${input.endTime}" is not a valid HH:MM 24-hour time.` };
  }

  if (toMinutes(startT) >= toMinutes(endT)) {
    return {
      ok: false,
      error: `Start time (${input.startTime}) must be strictly before end time (${input.endTime}).`,
    };
  }

  // Bookable window: 10:00–24:00 (1440 min)
  const WINDOW_START_MIN = 10 * 60; // 600
  const WINDOW_END_MIN   = 24 * 60; // 1440 (midnight = end of day)
  const outsideBookableWindow =
    toMinutes(startT) < WINDOW_START_MIN || toMinutes(endT) > WINDOW_END_MIN;

  return {
    ok: true,
    value: {
      fromDate: clampedFrom,
      toDate: clampedTo,
      startTime: input.startTime,
      endTime: input.endTime,
      outsideBookableWindow,
    },
  };
}
