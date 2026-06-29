import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { buildSlots, isBusyEntryOverlappingSlot, type Slot } from '../src/domain/slots';
import {
  DAY_START_MIN,
  DAY_END_MIN,
  SLOT_MINUTES,
  SLOTS_PER_NORMAL_DAY,
} from '../src/domain/constants';
import type { BusyEntry } from '../src/domain/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(partial: Partial<BusyEntry>): BusyEntry {
  return {
    id: 'e1',
    event_id: 'ev1',
    user_id: 'u1',
    kind: 'date',
    start_date: '2024-07-01',
    end_date: '2024-07-01',
    start_time: null,
    end_time: null,
    created_at: '2024-06-01T00:00:00.000Z',
    ...partial,
  };
}

/** Find the slot on `date` starting at minute-of-day `startMin`. */
function slotAt(slots: Slot[], date: string, startMin: number): Slot {
  const s = slots.find((x) => x.date === date && x.startMin === startMin);
  if (!s) throw new Error(`no slot ${date} @ ${startMin}`);
  return s;
}

// ---------------------------------------------------------------------------
// buildSlots — basic grid shape
// ---------------------------------------------------------------------------

describe('buildSlots — normal day', () => {
  const slots = buildSlots('2024-07-01', '2024-07-01', 'America/New_York');

  it('produces exactly 28 slots on a normal day', () => {
    expect(slots).toHaveLength(28);
    expect(SLOTS_PER_NORMAL_DAY).toBe(28);
  });

  it('first slot is 10:00–10:30, last is 23:30–24:00; nothing before 10:00', () => {
    expect(slots[0].startMin).toBe(DAY_START_MIN); // 600 = 10:00
    expect(slots[0].endMin).toBe(DAY_START_MIN + SLOT_MINUTES); // 630
    expect(slots[slots.length - 1].startMin).toBe(DAY_END_MIN - SLOT_MINUTES); // 1410 = 23:30
    expect(slots[slots.length - 1].endMin).toBe(DAY_END_MIN); // 1440 = 24:00
    for (const s of slots) {
      expect(s.startMin).toBeGreaterThanOrEqual(DAY_START_MIN);
      expect(s.endMin).toBeLessThanOrEqual(DAY_END_MIN);
    }
  });

  it('slots are contiguous 30-min steps in order', () => {
    for (let i = 0; i < slots.length; i++) {
      expect(slots[i].startMin).toBe(DAY_START_MIN + i * SLOT_MINUTES);
      expect(slots[i].endMin - slots[i].startMin).toBe(SLOT_MINUTES);
    }
  });

  it('startInstant matches the wall-clock 10:00 in the event zone', () => {
    const expected = DateTime.fromObject(
      { year: 2024, month: 7, day: 1, hour: 10, minute: 0 },
      { zone: 'America/New_York' },
    ).toMillis();
    expect(slots[0].startInstant).toBe(expected);
  });

  it('last slot endInstant equals 00:00 of the next day (24:00)', () => {
    const expected = DateTime.fromObject(
      { year: 2024, month: 7, day: 2, hour: 0, minute: 0 },
      { zone: 'America/New_York' },
    ).toMillis();
    expect(slots[slots.length - 1].endInstant).toBe(expected);
  });

  it('on a normal day each slot spans exactly 30 real minutes', () => {
    const THIRTY_MIN_MS = 30 * 60 * 1000;
    for (const s of slots) {
      expect(s.endInstant - s.startInstant).toBe(THIRTY_MIN_MS);
    }
  });
});

// ---------------------------------------------------------------------------
// buildSlots — multi-day range
// ---------------------------------------------------------------------------

describe('buildSlots — multi-day range', () => {
  const slots = buildSlots('2024-07-01', '2024-07-03', 'America/Chicago');

  it('covers 3 days × 28 slots = 84 slots', () => {
    expect(slots).toHaveLength(84);
  });

  it('emits each distinct date once, in order, with 28 slots each', () => {
    const dates = [...new Set(slots.map((s) => s.date))];
    expect(dates).toEqual(['2024-07-01', '2024-07-02', '2024-07-03']);
    for (const d of dates) {
      expect(slots.filter((s) => s.date === d)).toHaveLength(28);
    }
  });

  it('is globally ordered by date then startMin', () => {
    for (let i = 1; i < slots.length; i++) {
      const prev = slots[i - 1];
      const cur = slots[i];
      const prevKey = prev.date + String(prev.startMin).padStart(5, '0');
      const curKey = cur.date + String(cur.startMin).padStart(5, '0');
      expect(curKey >= prevKey).toBe(true);
    }
  });

  it('throws when endDate is before startDate', () => {
    expect(() => buildSlots('2024-07-03', '2024-07-01', 'America/Chicago')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// buildSlots — DST spring-forward (America/New_York, 2024-03-10)
// ---------------------------------------------------------------------------

describe('buildSlots — US DST spring-forward 2024-03-10', () => {
  // On 2024-03-10 clocks jump 02:00 -> 03:00 in America/New_York. The transition
  // is at 02:00, OUTSIDE the 10:00–24:00 window, so the window is unaffected:
  // still 28 wall-clock slots, each a normal 30 real minutes.
  const slots = buildSlots('2024-03-10', '2024-03-10', 'America/New_York');

  it('still has 28 slots (transition is before the window)', () => {
    expect(slots).toHaveLength(28);
  });

  it('every slot spans exactly 30 real minutes (transition outside window)', () => {
    const THIRTY_MIN_MS = 30 * 60 * 1000;
    for (const s of slots) {
      expect(s.endInstant - s.startInstant).toBe(THIRTY_MIN_MS);
    }
  });

  it('10:00 slot instant uses the post-transition EDT offset (UTC-4)', () => {
    const dt = DateTime.fromMillis(slots[0].startInstant, { zone: 'America/New_York' });
    expect(dt.toFormat('HH:mm')).toBe('10:00');
    expect(dt.offset).toBe(-240); // EDT = UTC-4
  });

  it('a full 10:00->24:00 day measures 14 real hours (no fixed-ms drift bug)', () => {
    const first = slots[0].startInstant;
    const last = slots[slots.length - 1].endInstant;
    expect(last - first).toBe(14 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// isBusyEntryOverlappingSlot — date / date_range
// ---------------------------------------------------------------------------

describe('isBusyEntryOverlappingSlot — whole-day kinds', () => {
  const slots = buildSlots('2024-07-01', '2024-07-03', 'UTC');
  const morning = slotAt(slots, '2024-07-02', DAY_START_MIN);
  const evening = slotAt(slots, '2024-07-02', DAY_END_MIN - SLOT_MINUTES);

  it('"date" entry blocks every slot on that day, none on other days', () => {
    const entry = makeEntry({ kind: 'date', start_date: '2024-07-02', end_date: '2024-07-02' });
    expect(isBusyEntryOverlappingSlot(entry, morning)).toBe(true);
    expect(isBusyEntryOverlappingSlot(entry, evening)).toBe(true);
    expect(isBusyEntryOverlappingSlot(entry, slotAt(slots, '2024-07-01', DAY_START_MIN))).toBe(false);
    expect(isBusyEntryOverlappingSlot(entry, slotAt(slots, '2024-07-03', DAY_START_MIN))).toBe(false);
  });

  it('"date_range" blocks all slots on every day within the inclusive span', () => {
    const entry = makeEntry({
      kind: 'date_range',
      start_date: '2024-07-01',
      end_date: '2024-07-02',
    });
    expect(isBusyEntryOverlappingSlot(entry, slotAt(slots, '2024-07-01', DAY_START_MIN))).toBe(true);
    expect(isBusyEntryOverlappingSlot(entry, slotAt(slots, '2024-07-02', DAY_END_MIN - SLOT_MINUTES))).toBe(true);
    // day 3 is outside the span
    expect(isBusyEntryOverlappingSlot(entry, slotAt(slots, '2024-07-03', DAY_START_MIN))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isBusyEntryOverlappingSlot — time_range with exact boundaries
// ---------------------------------------------------------------------------

describe('isBusyEntryOverlappingSlot — time_range', () => {
  const slots = buildSlots('2024-07-01', '2024-07-01', 'UTC');
  // 14:00–15:00 busy entry → minutes [840, 900).
  const entry = makeEntry({
    kind: 'time_range',
    start_date: '2024-07-01',
    end_date: '2024-07-01',
    start_time: '14:00',
    end_time: '15:00',
  });

  it('slots fully inside the interval are busy', () => {
    expect(isBusyEntryOverlappingSlot(entry, slotAt(slots, '2024-07-01', 840))).toBe(true); // 14:00–14:30
    expect(isBusyEntryOverlappingSlot(entry, slotAt(slots, '2024-07-01', 870))).toBe(true); // 14:30–15:00
  });

  it('slot ending exactly at the entry start is NOT busy (half-open)', () => {
    // 13:30–14:00 → [810,840); entry starts at 840 → touches start, no overlap.
    expect(isBusyEntryOverlappingSlot(entry, slotAt(slots, '2024-07-01', 810))).toBe(false);
  });

  it('slot starting exactly at the entry end is NOT busy (touching-end rule)', () => {
    // 15:00–15:30 → [900,930); entry ends at 900 → touches end, no overlap.
    expect(isBusyEntryOverlappingSlot(entry, slotAt(slots, '2024-07-01', 900))).toBe(false);
  });

  it('a partial overlap on either edge counts as busy', () => {
    const wide = makeEntry({
      kind: 'time_range',
      start_time: '14:15',
      end_time: '14:45',
    });
    // 14:00–14:30 overlaps [855,885) on its right edge.
    expect(isBusyEntryOverlappingSlot(wide, slotAt(slots, '2024-07-01', 840))).toBe(true);
    // 14:30–15:00 overlaps on its left edge.
    expect(isBusyEntryOverlappingSlot(wide, slotAt(slots, '2024-07-01', 870))).toBe(true);
  });

  it('time_range does not apply to slots outside its date span', () => {
    const multi = buildSlots('2024-07-01', '2024-07-02', 'UTC');
    const otherDay = slotAt(multi, '2024-07-02', 840);
    expect(isBusyEntryOverlappingSlot(entry, otherDay)).toBe(false);
  });

  it('time_range spanning multiple dates applies on each date in span', () => {
    const multi = buildSlots('2024-07-01', '2024-07-02', 'UTC');
    const spanning = makeEntry({
      kind: 'time_range',
      start_date: '2024-07-01',
      end_date: '2024-07-02',
      start_time: '14:00',
      end_time: '15:00',
    });
    expect(isBusyEntryOverlappingSlot(spanning, slotAt(multi, '2024-07-01', 840))).toBe(true);
    expect(isBusyEntryOverlappingSlot(spanning, slotAt(multi, '2024-07-02', 840))).toBe(true);
    expect(isBusyEntryOverlappingSlot(spanning, slotAt(multi, '2024-07-02', 810))).toBe(false);
  });

  it('null times never overlap (defensive)', () => {
    const nullTimes = makeEntry({ kind: 'time_range', start_time: null, end_time: null });
    expect(isBusyEntryOverlappingSlot(nullTimes, slotAt(slots, '2024-07-01', 840))).toBe(false);
  });
});
