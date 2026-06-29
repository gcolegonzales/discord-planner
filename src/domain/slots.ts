/**
 * Pure slot grid + busy-overlap test — no discord.js, no DB, no Date.now().
 * See spec/decisions/0002-timezone-and-slot-model.md and FEAT-availability-engine-1.
 *
 * The grid covers the daily window 10:00 (inclusive) → 24:00 (exclusive) in
 * fixed 30-minute steps, for every date in the inclusive [startDate, endDate]
 * range, in the event's IANA timezone.
 */

import { DateTime } from 'luxon';
import { DAY_START_MIN, DAY_END_MIN, SLOT_MINUTES } from './constants';
import type { BusyEntry } from './types';

/** One 30-minute slot on a specific calendar date in the event zone. */
export interface Slot {
  /** Calendar date in the event zone, YYYY-MM-DD. */
  date: string;
  /** Wall-clock start, minutes since midnight (always >= DAY_START_MIN). */
  startMin: number;
  /** Wall-clock end, minutes since midnight (always <= DAY_END_MIN). */
  endMin: number;
  /** Absolute instant of the slot start, as epoch milliseconds (UTC). */
  startInstant: number;
  /** Absolute instant of the slot end, as epoch milliseconds (UTC). */
  endInstant: number;
}

/**
 * Split a YYYY-MM-DD string into numeric parts. The caller is responsible for
 * passing well-formed dates (the validators upstream guarantee this); we keep
 * this defensive against obviously malformed input.
 */
function splitDate(date: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) {
    throw new Error(`Invalid date string "${date}" (expected YYYY-MM-DD).`);
  }
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  };
}

/**
 * Compute the absolute instant (epoch ms) of a wall-clock minute-of-day on a
 * given calendar date in the given zone.
 *
 * We build the instant from `{ year, month, day, hour, minute }` in-zone so the
 * UTC offset is resolved by luxon per the zone's DST rules at that wall time —
 * NOT by adding fixed milliseconds to midnight. This is what makes the grid
 * DST-correct (see the DST note on buildSlots).
 *
 * For minuteOfDay === 1440 (24:00) we represent it as 00:00 of the next day,
 * which is the correct absolute instant for "end of day" and keeps luxon happy
 * (it has no hour 24).
 */
function instantFor(
  parts: { year: number; month: number; day: number },
  minuteOfDay: number,
  zone: string,
): number {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;

  let dt: DateTime;
  if (hour >= 24) {
    // 24:00 → 00:00 next day (luxon rolls the date for us via the overflow,
    // but we add a day explicitly to be unambiguous).
    dt = DateTime.fromObject(
      { year: parts.year, month: parts.month, day: parts.day, hour: 0, minute },
      { zone },
    ).plus({ days: 1 });
  } else {
    dt = DateTime.fromObject(
      { year: parts.year, month: parts.month, day: parts.day, hour, minute },
      { zone },
    );
  }

  if (!dt.isValid) {
    throw new Error(
      `Could not build instant for ${parts.year}-${parts.month}-${parts.day} ` +
        `${hour}:${minute} in zone "${zone}": ${dt.invalidReason ?? 'unknown'}.`,
    );
  }
  return dt.toMillis();
}

/**
 * Build the ordered slot grid for the inclusive date range [startDate, endDate]
 * in `timezone`.
 *
 * Each date contributes 30-minute slots covering 10:00 → 24:00:
 *   10:00–10:30, 10:30–11:00, …, 23:30–24:00 — 28 slots on a normal day.
 * No slot ever starts before 10:00 (the hard rule).
 *
 * DST behavior
 * ------------
 * Slots are defined by WALL-CLOCK time in the event zone, and each slot's
 * absolute instant is resolved by luxon for that wall time on that date. We do
 * NOT advance instants by a fixed 30 minutes of real time. Consequences on a
 * DST-transition date whose transition falls inside the 10:00–24:00 window:
 *  - Spring-forward (e.g. America/New_York, clocks jump 02:00→03:00): the
 *    transition is at 02:00, OUTSIDE our window, so the window is unaffected
 *    and still yields 28 wall-clock slots; their real-world durations are all a
 *    normal 30 min.
 *  - A hypothetical transition INSIDE 10:00–24:00 (zones do exist where DST
 *    flips at, say, midnight or noon) would make a particular wall-clock time
 *    either non-existent or ambiguous. luxon resolves non-existent wall times
 *    forward and ambiguous wall times to the earlier offset; the slot COUNT
 *    stays 28 (we always emit one slot per wall-clock 30-min step) but the
 *    real-world gap between consecutive slot instants on that day differs by an
 *    hour across the transition. Freeness is computed from wall-clock minutes,
 *    so overlap semantics are unaffected; only the absolute instants shift.
 */
export function buildSlots(
  startDate: string,
  endDate: string,
  timezone: string,
): Slot[] {
  if (endDate < startDate) {
    throw new Error(
      `endDate (${endDate}) must be on or after startDate (${startDate}).`,
    );
  }

  const slots: Slot[] = [];

  // Iterate dates in-zone so the date sequence is calendar-correct regardless
  // of DST. We start at noon to avoid any midnight-DST edge while stepping days.
  let cursor = DateTime.fromObject(
    { ...splitDate(startDate), hour: 12 },
    { zone: timezone },
  );
  const last = DateTime.fromObject(
    { ...splitDate(endDate), hour: 12 },
    { zone: timezone },
  );
  if (!cursor.isValid || !last.isValid) {
    throw new Error(`Invalid date(s)/zone: ${startDate}..${endDate} @ ${timezone}.`);
  }
  const lastIso = last.toISODate();

  while (cursor.isValid && cursor.toISODate() <= lastIso) {
    const date = cursor.toISODate();
    const parts = splitDate(date);

    for (let s = DAY_START_MIN; s < DAY_END_MIN; s += SLOT_MINUTES) {
      const e = s + SLOT_MINUTES;
      slots.push({
        date,
        startMin: s,
        endMin: e,
        startInstant: instantFor(parts, s, timezone),
        endInstant: instantFor(parts, e, timezone),
      });
    }

    cursor = cursor.plus({ days: 1 });
  }

  return slots;
}

/**
 * Does a busy entry overlap a slot?
 *
 *  - `date` / `date_range`: busy for ALL slots whose `date` falls within the
 *    entry's [start_date, end_date] day span (inclusive). Times are ignored.
 *  - `time_range`: busy for slots on applicable dates (date within the entry's
 *    day span) whose half-open clock interval [startMin, endMin) overlaps the
 *    entry's half-open interval [start_time, end_time). A slot that only touches
 *    the entry's END (slot.startMin === entry.endMin) is NOT busy.
 *
 * Date comparison is lexicographic, which is correct for fixed-width YYYY-MM-DD.
 */
export function isBusyEntryOverlappingSlot(entry: BusyEntry, slot: Slot): boolean {
  // Date span gate (applies to every kind).
  const withinDays = slot.date >= entry.start_date && slot.date <= entry.end_date;
  if (!withinDays) return false;

  if (entry.kind === 'date' || entry.kind === 'date_range') {
    return true;
  }

  // time_range: need both times; if absent, treat as no overlap (defensive).
  if (entry.start_time === null || entry.end_time === null) {
    return false;
  }
  const entryStart = timeToMinutes(entry.start_time);
  const entryEnd = timeToMinutes(entry.end_time);

  // Half-open overlap: [slot.startMin, slot.endMin) ∩ [entryStart, entryEnd) ≠ ∅.
  return slot.startMin < entryEnd && entryStart < slot.endMin;
}

/** Parse HH:MM into minutes since midnight. */
function timeToMinutes(hhmm: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) {
    throw new Error(`Invalid time string "${hhmm}" (expected HH:MM).`);
  }
  return Number(m[1]) * 60 + Number(m[2]);
}
