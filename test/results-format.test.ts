/**
 * Unit tests for pure formatting helpers in src/ui/results.ts.
 * These are asserting tests — they verify exact output strings.
 */

import { describe, it, expect } from 'vitest';
import {
  formatMinutes,
  formatDate,
  formatWindowFull,
  freeCountToGlyph,
  buildDayBar,
  buildHeatmap,
} from '../src/ui/results';
import type { RankedWindow, DayAvailability } from '../src/domain/matching';

// ---------------------------------------------------------------------------
// formatMinutes
// ---------------------------------------------------------------------------

describe('formatMinutes', () => {
  it('formats midnight (0 min) as 12:00 AM', () => {
    expect(formatMinutes(0)).toBe('12:00 AM');
  });

  it('formats noon (720 min) as 12:00 PM', () => {
    expect(formatMinutes(720)).toBe('12:00 PM');
  });

  it('formats 10:00 (600 min) as 10:00 AM', () => {
    expect(formatMinutes(600)).toBe('10:00 AM');
  });

  it('formats 14:30 (870 min) as 2:30 PM', () => {
    expect(formatMinutes(870)).toBe('2:30 PM');
  });

  it('formats 17:00 (1020 min) as 5:00 PM', () => {
    expect(formatMinutes(1020)).toBe('5:00 PM');
  });

  it('formats 23:30 (1410 min) as 11:30 PM', () => {
    expect(formatMinutes(1410)).toBe('11:30 PM');
  });

  it('formats 13:00 (780 min) as 1:00 PM', () => {
    expect(formatMinutes(780)).toBe('1:00 PM');
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('formats 2024-07-01 in UTC as Mon Jul 1', () => {
    expect(formatDate('2024-07-01', 'UTC')).toBe('Mon Jul 1');
  });

  it('formats 2024-12-25 in UTC as Wed Dec 25', () => {
    expect(formatDate('2024-12-25', 'UTC')).toBe('Wed Dec 25');
  });

  it('respects timezone (America/New_York shifts by -4 or -5)', () => {
    // 2024-07-01 in America/New_York is still Mon Jul 1
    expect(formatDate('2024-07-01', 'America/New_York')).toBe('Mon Jul 1');
  });
});

// ---------------------------------------------------------------------------
// formatWindowFull
// ---------------------------------------------------------------------------

describe('formatWindowFull', () => {
  const tz = 'UTC';

  it('shows "all N free" when everyone is free', () => {
    const window: RankedWindow = {
      date: '2024-07-02',
      startMin: 840,  // 14:00
      endMin: 1020,   // 17:00
      freeCount: 3,
      freeUserIds: ['u1', 'u2', 'u3'],
      totalParticipants: 3,
    };
    const result = formatWindowFull(window, tz, ['u1', 'u2', 'u3']);
    expect(result).toContain('✅ all 3 free');
    expect(result).toContain('**Tue Jul 2**');
    expect(result).toContain('2:00–5:00 PM');
  });

  it('shows missing participant mentions when not all free', () => {
    const window: RankedWindow = {
      date: '2024-07-01',
      startMin: 600,  // 10:00
      endMin: 660,    // 11:00
      freeCount: 2,
      freeUserIds: ['u1', 'u2'],
      totalParticipants: 3,
    };
    const result = formatWindowFull(window, tz, ['u1', 'u2', 'u3']);
    expect(result).toContain('2/3 free');
    expect(result).toContain('missing <@u3>');
  });

  it('collapses AM/PM when same period', () => {
    const window: RankedWindow = {
      date: '2024-07-01',
      startMin: 600,  // 10:00 AM
      endMin: 660,    // 11:00 AM
      freeCount: 1,
      freeUserIds: ['u1'],
      totalParticipants: 1,
    };
    const result = formatWindowFull(window, tz, ['u1']);
    expect(result).toContain('10:00–11:00 AM');
  });

  it('shows AM–PM when period differs', () => {
    const window: RankedWindow = {
      date: '2024-07-01',
      startMin: 660,  // 11:00 AM
      endMin: 780,    // 1:00 PM
      freeCount: 1,
      freeUserIds: ['u1'],
      totalParticipants: 1,
    };
    const result = formatWindowFull(window, tz, ['u1']);
    expect(result).toContain('11:00 AM–1:00 PM');
  });

  it('shows "no participants" when totalParticipants is 0', () => {
    const window: RankedWindow = {
      date: '2024-07-01',
      startMin: 600,
      endMin: 660,
      freeCount: 0,
      freeUserIds: [],
      totalParticipants: 0,
    };
    const result = formatWindowFull(window, tz, []);
    expect(result).toContain('no participants');
  });
});

// ---------------------------------------------------------------------------
// freeCountToGlyph
// ---------------------------------------------------------------------------

describe('freeCountToGlyph', () => {
  it('returns ⬜ for 0 participants', () => {
    expect(freeCountToGlyph(0, 0)).toBe('⬜');
  });

  it('returns ⬛ when no one is free', () => {
    expect(freeCountToGlyph(0, 5)).toBe('⬛');
  });

  it('returns ✅ when all are free', () => {
    expect(freeCountToGlyph(5, 5)).toBe('✅');
  });

  it('returns 🟥 for <50% free (1/5)', () => {
    expect(freeCountToGlyph(1, 5)).toBe('🟥');
  });

  it('returns 🟥 for <50% free (2/5)', () => {
    expect(freeCountToGlyph(2, 5)).toBe('🟥');
  });

  it('returns 🟨 for exactly 50% (2/4)', () => {
    expect(freeCountToGlyph(2, 4)).toBe('🟨');
  });

  it('returns 🟨 for 50–74% (3/5 = 60%)', () => {
    expect(freeCountToGlyph(3, 5)).toBe('🟨');
  });

  it('returns 🟩 for 75–99% (3/4 = 75%)', () => {
    expect(freeCountToGlyph(3, 4)).toBe('🟩');
  });

  it('returns 🟩 for 4/5 = 80%', () => {
    expect(freeCountToGlyph(4, 5)).toBe('🟩');
  });

  it('returns ✅ for 1/1', () => {
    expect(freeCountToGlyph(1, 1)).toBe('✅');
  });
});

// ---------------------------------------------------------------------------
// buildDayBar
// ---------------------------------------------------------------------------

describe('buildDayBar', () => {
  it('returns ⬜ for empty freeCounts', () => {
    expect(buildDayBar([], 3)).toBe('⬜');
  });

  it('groups slots into 4-slot buckets', () => {
    // 8 slots → 2 groups
    const freeCounts = [5, 5, 5, 5, 0, 0, 0, 0];
    const result = buildDayBar(freeCounts, 5);
    // Group 0: all 5 free → ✅
    // Group 1: all 0 free → ⬛
    expect(result).toBe('✅⬛');
  });

  it('picks the best (max) freeCount in each group', () => {
    // Group of 4: [0, 0, 3, 0] → best=3, 3/5 = 60% → 🟨
    const freeCounts = [0, 0, 3, 0];
    const result = buildDayBar(freeCounts, 5);
    expect(result).toBe('🟨');
  });

  it('handles a partial last group', () => {
    // 5 slots → group of 4 + group of 1
    const freeCounts = [5, 5, 5, 5, 3];
    const result = buildDayBar(freeCounts, 5);
    // Group 0: best=5 → ✅
    // Group 1: best=3 → 🟨 (3/5=60%)
    expect(result).toBe('✅🟨');
  });
});

// ---------------------------------------------------------------------------
// buildHeatmap
// ---------------------------------------------------------------------------

describe('buildHeatmap', () => {
  it('returns "No date data." for empty perDay', () => {
    expect(buildHeatmap([], 3, 'UTC')).toBe('No date data.');
  });

  it('includes the legend', () => {
    const perDay: DayAvailability[] = [
      { date: '2024-07-01', freeCounts: [3, 3, 3, 3] },
    ];
    const result = buildHeatmap(perDay, 3, 'UTC');
    expect(result).toContain('⬛=none');
    expect(result).toContain('✅=all');
  });

  it('includes a date label for each day', () => {
    const perDay: DayAvailability[] = [
      { date: '2024-07-01', freeCounts: [3, 3] },
      { date: '2024-07-02', freeCounts: [0, 0] },
    ];
    const result = buildHeatmap(perDay, 3, 'UTC');
    expect(result).toContain('Mon Jul 1');
    expect(result).toContain('Tue Jul 2');
  });

  it('stays within FIELD_MAX (1024 chars) for a 31-day event', () => {
    // 31 days, each with 28 slots (normal day: 28 slots of 30 min from 10:00-24:00)
    const perDay: DayAvailability[] = Array.from({ length: 31 }, (_, i) => {
      const d = new Date(2024, 6, i + 1);
      const dateStr = d.toISOString().slice(0, 10);
      return {
        date: dateStr,
        freeCounts: Array(28).fill(3) as number[],
      };
    });
    const result = buildHeatmap(perDay, 5, 'UTC');
    expect(result.length).toBeLessThanOrEqual(1024);
  });
});
