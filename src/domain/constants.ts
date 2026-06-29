/**
 * Core slot/availability constants — see spec/decisions/0002-timezone-and-slot-model.md.
 *
 * The daily bookable window is 10:00 (inclusive) → 24:00 (exclusive), divided
 * into fixed 30-minute slots. These are encoded as constants on purpose:
 * changing them is a real, re-spec'd change, not a runtime knob.
 */

/** Start of the daily window, in minutes since midnight (10:00). */
export const DAY_START_MIN = 600;

/** End of the daily window, in minutes since midnight (24:00 = end of day). */
export const DAY_END_MIN = 1440;

/** Slot length in minutes. */
export const SLOT_MINUTES = 30;

/**
 * Number of slots on a normal (non-DST-transition) day:
 * (1440 − 600) / 30 = 28.
 */
export const SLOTS_PER_NORMAL_DAY = (DAY_END_MIN - DAY_START_MIN) / SLOT_MINUTES;

/** Default number of ranked windows returned by the matching engine. */
export const MAX_RESULT_WINDOWS = 5;
