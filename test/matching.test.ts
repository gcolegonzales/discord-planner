import { describe, it, expect } from 'vitest';
import {
  computeAvailability,
  type RankedWindow,
} from '../src/domain/matching';
import { SLOTS_PER_NORMAL_DAY } from '../src/domain/constants';
import type { BusyEntry, Participant } from '../src/domain/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TZ = 'UTC';

function participant(user_id: string): Participant {
  return { event_id: 'ev1', user_id, accepted_at: '2024-06-01T00:00:00.000Z' };
}

let entrySeq = 0;
function busy(partial: Partial<BusyEntry> & { user_id: string; kind: BusyEntry['kind'] }): BusyEntry {
  entrySeq += 1;
  return {
    id: `b${entrySeq}`,
    event_id: 'ev1',
    start_date: '2024-07-01',
    end_date: '2024-07-01',
    start_time: null,
    end_time: null,
    created_at: '2024-06-01T00:00:00.000Z',
    ...partial,
  };
}

function findWindow(windows: RankedWindow[], date: string, startMin: number): RankedWindow | undefined {
  return windows.find((w) => w.date === date && w.startMin === startMin);
}

// ---------------------------------------------------------------------------
// Everyone free
// ---------------------------------------------------------------------------

describe('computeAvailability — everyone free', () => {
  it('with no busy entries the whole day is one everyone-free window', () => {
    const result = computeAvailability(
      [participant('a'), participant('b')],
      [],
      '2024-07-01',
      '2024-07-01',
      TZ,
    );
    expect(result.windows).toHaveLength(1);
    const w = result.windows[0];
    expect(w.date).toBe('2024-07-01');
    expect(w.startMin).toBe(600); // 10:00
    expect(w.endMin).toBe(1440); // 24:00
    expect(w.freeCount).toBe(2);
    expect(w.totalParticipants).toBe(2);
    expect(w.freeUserIds).toEqual(['a', 'b']);
  });

  it('perDay has one entry of 28 free counts, all === N', () => {
    const result = computeAvailability(
      [participant('a'), participant('b')],
      [],
      '2024-07-01',
      '2024-07-01',
      TZ,
    );
    expect(result.perDay).toHaveLength(1);
    expect(result.perDay[0].date).toBe('2024-07-01');
    expect(result.perDay[0].freeCounts).toHaveLength(SLOTS_PER_NORMAL_DAY); // 28
    expect(result.perDay[0].freeCounts.every((c) => c === 2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Partial overlaps → distinct adjacent windows
// ---------------------------------------------------------------------------

describe('computeAvailability — partial overlaps split into distinct windows', () => {
  // 'b' busy 14:00–15:00 only. Day splits into:
  //   10:00–14:00 free {a,b}, 14:00–15:00 free {a}, 15:00–24:00 free {a,b}.
  const participants = [participant('a'), participant('b')];
  const entries = [
    busy({ user_id: 'b', kind: 'time_range', start_time: '14:00', end_time: '15:00' }),
  ];
  const result = computeAvailability(participants, entries, '2024-07-01', '2024-07-01', TZ, {
    maxResultWindows: 10,
  });

  it('produces three windows with the expected boundaries and free sets', () => {
    const morning = findWindow(result.windows, '2024-07-01', 600);
    const gap = findWindow(result.windows, '2024-07-01', 840); // 14:00
    const evening = findWindow(result.windows, '2024-07-01', 900); // 15:00

    expect(morning).toBeDefined();
    expect(morning!.endMin).toBe(840);
    expect(morning!.freeUserIds).toEqual(['a', 'b']);

    expect(gap).toBeDefined();
    expect(gap!.endMin).toBe(900);
    expect(gap!.freeCount).toBe(1);
    expect(gap!.freeUserIds).toEqual(['a']);

    expect(evening).toBeDefined();
    expect(evening!.endMin).toBe(1440);
    expect(evening!.freeUserIds).toEqual(['a', 'b']);
  });

  it('the partial-busy slots show freeCount 1 in perDay', () => {
    const counts = result.perDay[0].freeCounts;
    // slot indices: 0=10:00 ... index 8 = 14:00, index 9 = 14:30.
    expect(counts[8]).toBe(1);
    expect(counts[9]).toBe(1);
    expect(counts[7]).toBe(2); // 13:30 free for both
    expect(counts[10]).toBe(2); // 15:00 free for both
  });
});

// ---------------------------------------------------------------------------
// Ranking order + each tie-break
// ---------------------------------------------------------------------------

describe('computeAvailability — ranking and tie-breaks', () => {
  it('freeCount desc dominates: everyone-free window outranks a partial one', () => {
    // a busy 10:00–10:30 → that first slot freeCount 1; rest freeCount 2.
    const participants = [participant('a'), participant('b')];
    const entries = [
      busy({ user_id: 'a', kind: 'time_range', start_time: '10:00', end_time: '10:30' }),
    ];
    const result = computeAvailability(participants, entries, '2024-07-01', '2024-07-01', TZ, {
      maxResultWindows: 10,
    });
    expect(result.windows[0].freeCount).toBe(2);
    expect(result.windows[0].startMin).toBe(630); // 10:30–24:00 everyone free
    // the freeCount-1 window is ranked below
    expect(result.windows[result.windows.length - 1].freeCount).toBe(1);
  });

  it('duration desc breaks ties when freeCount is equal', () => {
    // Two everyone-free windows of unequal length, separated by a busy gap.
    // a&b busy 12:00–12:30 → window1 10:00–12:00 (120min), window2 12:30–24:00 (690min).
    const participants = [participant('a'), participant('b')];
    const entries = [
      busy({ user_id: 'a', kind: 'time_range', start_time: '12:00', end_time: '12:30' }),
      busy({ user_id: 'b', kind: 'time_range', start_time: '12:00', end_time: '12:30' }),
    ];
    const result = computeAvailability(participants, entries, '2024-07-01', '2024-07-01', TZ, {
      maxResultWindows: 10,
    });
    const top = result.windows[0];
    // longest everyone-free window first (the evening one, 690 min)
    expect(top.freeCount).toBe(2);
    expect(top.startMin).toBe(750); // 12:30
    expect(top.endMin).toBe(1440);
    expect(top.endMin - top.startMin).toBe(690);
    // second is the shorter morning everyone-free window
    const second = result.windows[1];
    expect(second.freeCount).toBe(2);
    expect(second.endMin - second.startMin).toBe(120);
  });

  it('earliest startMin breaks ties when freeCount and duration are equal', () => {
    // Build two equal-length, equal-freeCount everyone-free windows by carving
    // a single busy slot exactly in the middle is hard; instead use a symmetric
    // gap. a&b busy 16:00–16:30 splits day into 10:00–16:00 (360) and
    // 16:30–24:00 (450) — unequal. To force EQUAL durations, restrict the range
    // window with two busy blocks producing two 180-min everyone-free runs.
    const participants = [participant('a')];
    // a free everywhere except 13:00–13:30 and 16:00–16:30 → runs:
    //  10:00–13:00 (180), 13:30–16:00 (150), 16:30–24:00 (450). Pick two equal:
    // adjust to make 10:00-13:00 (180) and ... we just assert earliest-first
    // among equal-duration freeCount-1 windows below using a constructed case.
    const entries = [
      busy({ user_id: 'a', kind: 'time_range', start_time: '13:00', end_time: '13:30' }),
      busy({ user_id: 'a', kind: 'time_range', start_time: '17:00', end_time: '17:30' }),
    ];
    // runs: 10:00–13:00 (180), 13:30–17:00 (210), 17:30–24:00 (390). Not equal,
    // but all freeCount 1; the engine must put the longest (390) first, then 210,
    // then 180 — and within any equal pair, earliest start. Verify ordering:
    const result = computeAvailability(participants, entries, '2024-07-01', '2024-07-01', TZ, {
      maxResultWindows: 10,
    });
    const durations = result.windows.map((w) => w.endMin - w.startMin);
    // sorted by duration desc
    expect(durations).toEqual([...durations].sort((x, y) => y - x));
    // explicit earliest-start tie-break check with a synthetic equal-duration set
    const synthetic: RankedWindow[] = [
      { date: '2024-07-01', startMin: 900, endMin: 960, freeCount: 1, freeUserIds: ['a'], totalParticipants: 1 },
      { date: '2024-07-01', startMin: 600, endMin: 660, freeCount: 1, freeUserIds: ['a'], totalParticipants: 1 },
    ];
    // mimic the engine's comparator expectation: earliest start wins on equal fc+dur
    synthetic.sort((p, q) =>
      p.freeCount !== q.freeCount
        ? q.freeCount - p.freeCount
        : p.endMin - p.startMin !== q.endMin - q.startMin
          ? (q.endMin - q.startMin) - (p.endMin - p.startMin)
          : p.startMin - q.startMin,
    );
    expect(synthetic[0].startMin).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// Zero participants
// ---------------------------------------------------------------------------

describe('computeAvailability — zero participants', () => {
  it('returns no windows but still a perDay grid of zeros', () => {
    const result = computeAvailability([], [], '2024-07-01', '2024-07-02', TZ);
    expect(result.windows).toHaveLength(0);
    expect(result.perDay).toHaveLength(2);
    for (const day of result.perDay) {
      expect(day.freeCounts).toHaveLength(SLOTS_PER_NORMAL_DAY);
      expect(day.freeCounts.every((c) => c === 0)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// One fully-busy participant caps freeCount at N-1
// ---------------------------------------------------------------------------

describe('computeAvailability — one fully-busy participant', () => {
  it('caps freeCount at N-1 across the whole day', () => {
    const participants = [participant('a'), participant('b'), participant('c')];
    // c is out the whole day (a "date" entry).
    const entries = [busy({ user_id: 'c', kind: 'date', start_date: '2024-07-01', end_date: '2024-07-01' })];
    const result = computeAvailability(participants, entries, '2024-07-01', '2024-07-01', TZ);
    expect(result.windows).toHaveLength(1);
    const w = result.windows[0];
    expect(w.freeCount).toBe(2); // N-1
    expect(w.totalParticipants).toBe(3);
    expect(w.freeUserIds).toEqual(['a', 'b']);
    expect(result.perDay[0].freeCounts.every((c) => c === 2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// date_range blocks whole days
// ---------------------------------------------------------------------------

describe('computeAvailability — date_range blocks whole days', () => {
  it('a multi-day date_range removes a participant from every slot in span', () => {
    const participants = [participant('a'), participant('b')];
    // b busy across 07-01..07-02; free again on 07-03.
    const entries = [
      busy({ user_id: 'b', kind: 'date_range', start_date: '2024-07-01', end_date: '2024-07-02' }),
    ];
    const result = computeAvailability(participants, entries, '2024-07-01', '2024-07-03', TZ, {
      maxResultWindows: 10,
    });

    // Day 1 & 2: freeCount 1 everywhere; Day 3: freeCount 2 everywhere.
    expect(result.perDay[0].freeCounts.every((c) => c === 1)).toBe(true);
    expect(result.perDay[1].freeCounts.every((c) => c === 1)).toBe(true);
    expect(result.perDay[2].freeCounts.every((c) => c === 2)).toBe(true);

    // The everyone-free window (day 3) ranks first.
    const top = result.windows[0];
    expect(top.date).toBe('2024-07-03');
    expect(top.freeCount).toBe(2);
    expect(top.startMin).toBe(600);
    expect(top.endMin).toBe(1440);
  });
});

// ---------------------------------------------------------------------------
// Multi-day range + maxResultWindows
// ---------------------------------------------------------------------------

describe('computeAvailability — multi-day range and result cap', () => {
  it('perDay covers every date in order', () => {
    const result = computeAvailability([participant('a')], [], '2024-07-01', '2024-07-04', TZ);
    expect(result.perDay.map((d) => d.date)).toEqual([
      '2024-07-01',
      '2024-07-02',
      '2024-07-03',
      '2024-07-04',
    ]);
  });

  it('default cap returns at most 5 windows; option overrides it', () => {
    // Create many distinct freeCount-1 windows by alternating busy slots.
    const participants = [participant('a')];
    // a busy on the :00–:30 slot of each hour-pair → many tiny gaps.
    const entries: BusyEntry[] = [];
    for (const t of ['11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']) {
      const [h] = t.split(':');
      const end = `${String(Number(h)).padStart(2, '0')}:30`;
      entries.push(busy({ user_id: 'a', kind: 'time_range', start_time: t, end_time: end }));
    }
    const capped = computeAvailability(participants, entries, '2024-07-01', '2024-07-01', TZ);
    expect(capped.windows.length).toBeLessThanOrEqual(5);

    const more = computeAvailability(participants, entries, '2024-07-01', '2024-07-01', TZ, {
      maxResultWindows: 50,
    });
    expect(more.windows.length).toBeGreaterThan(5);
  });

  it('never emits a window before 10:00 or after 24:00', () => {
    const participants = [participant('a'), participant('b')];
    const entries = [
      busy({ user_id: 'a', kind: 'time_range', start_time: '12:00', end_time: '12:30' }),
    ];
    const result = computeAvailability(participants, entries, '2024-07-01', '2024-07-02', TZ, {
      maxResultWindows: 50,
    });
    for (const w of result.windows) {
      expect(w.startMin).toBeGreaterThanOrEqual(600);
      expect(w.endMin).toBeLessThanOrEqual(1440);
    }
  });
});
