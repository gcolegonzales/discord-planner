import { describe, it, expect } from 'vitest';
import {
  validateEventInput,
  validateDateRange,
  validateTimeRange,
} from '../src/domain/validate';

// ---------------------------------------------------------------------------
// validateEventInput
// ---------------------------------------------------------------------------

describe('validateEventInput', () => {
  const opts = { maxDays: 31 };
  const base = {
    title: 'Team sync',
    start: '2024-07-01',
    end: '2024-07-07',
    timezone: 'America/New_York',
  };

  it('accepts a valid input and returns the correct spanDays', () => {
    const result = validateEventInput(base, opts);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.title).toBe('Team sync');
    expect(result.value.start).toBe('2024-07-01');
    expect(result.value.end).toBe('2024-07-07');
    expect(result.value.spanDays).toBe(7); // Jul 1–7 inclusive
    expect(result.value.timezone).toBe('America/New_York');
  });

  it('accepts a single-day event (span = 1)', () => {
    const result = validateEventInput({ ...base, start: '2024-07-01', end: '2024-07-01' }, opts);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.spanDays).toBe(1);
  });

  it('accepts an event exactly at the maxDays limit', () => {
    // 31-day span: Jul 1 – Jul 31
    const result = validateEventInput({ ...base, start: '2024-07-01', end: '2024-07-31' }, opts);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.spanDays).toBe(31);
  });

  it('rejects a span that exceeds maxDays', () => {
    // 32 days: Jul 1 – Aug 1
    const result = validateEventInput({ ...base, start: '2024-07-01', end: '2024-08-01' }, opts);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/exceed/i);
    expect(result.error).toContain('31');
  });

  it('respects a custom maxDays passed in', () => {
    // With maxDays=3, a 4-day span should fail
    const result = validateEventInput(
      { ...base, start: '2024-07-01', end: '2024-07-04' },
      { maxDays: 3 },
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/3 days/i);
  });

  it('rejects an empty title', () => {
    const result = validateEventInput({ ...base, title: '' }, opts);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/empty/i);
  });

  it('rejects a title over 100 characters', () => {
    const result = validateEventInput({ ...base, title: 'a'.repeat(101) }, opts);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/100/);
  });

  it('accepts a title of exactly 100 characters', () => {
    const result = validateEventInput({ ...base, title: 'a'.repeat(100) }, opts);
    expect(result.ok).toBe(true);
  });

  it('trims leading/trailing whitespace from title', () => {
    const result = validateEventInput({ ...base, title: '  Sync  ' }, opts);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.title).toBe('Sync');
  });

  it('rejects a whitespace-only title', () => {
    const result = validateEventInput({ ...base, title: '   ' }, opts);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/empty/i);
  });

  it('rejects a malformed start date', () => {
    const result = validateEventInput({ ...base, start: '2024-7-1' }, opts);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/start date/i);
  });

  it('rejects a malformed end date', () => {
    const result = validateEventInput({ ...base, end: 'not-a-date' }, opts);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/end date/i);
  });

  it('rejects start > end', () => {
    const result = validateEventInput(
      { ...base, start: '2024-07-10', end: '2024-07-05' },
      opts,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/on or before/i);
  });

  it('rejects an invalid IANA timezone', () => {
    const result = validateEventInput({ ...base, timezone: 'Invalid/Zone' }, opts);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/IANA/i);
  });

  it('rejects a clearly invalid timezone string', () => {
    const result = validateEventInput({ ...base, timezone: 'Not/A/Real/Zone' }, opts);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/IANA/i);
  });

  it('accepts common IANA zones', () => {
    for (const tz of ['America/Chicago', 'Europe/London', 'Asia/Tokyo', 'UTC']) {
      const result = validateEventInput({ ...base, timezone: tz }, opts);
      expect(result.ok).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// validateDateRange
// ---------------------------------------------------------------------------

describe('validateDateRange', () => {
  const EVT_START = '2024-07-01';
  const EVT_END   = '2024-07-31';

  it('accepts a single date within the event window', () => {
    const result = validateDateRange('2024-07-10', undefined, EVT_START, EVT_END);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.from).toBe('2024-07-10');
    expect(result.value.to).toBe('2024-07-10');
    expect(result.value.kind).toBe('date');
  });

  it('accepts a date range within the event window', () => {
    const result = validateDateRange('2024-07-05', '2024-07-10', EVT_START, EVT_END);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.from).toBe('2024-07-05');
    expect(result.value.to).toBe('2024-07-10');
    expect(result.value.kind).toBe('date_range');
  });

  it('clamps a range that starts before the event window', () => {
    const result = validateDateRange('2024-06-25', '2024-07-05', EVT_START, EVT_END);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.from).toBe(EVT_START);
    expect(result.value.to).toBe('2024-07-05');
  });

  it('clamps a range that ends after the event window', () => {
    const result = validateDateRange('2024-07-25', '2024-08-10', EVT_START, EVT_END);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.from).toBe('2024-07-25');
    expect(result.value.to).toBe(EVT_END);
  });

  it('clamps a range that spans the entire event window', () => {
    const result = validateDateRange('2024-06-01', '2024-08-31', EVT_START, EVT_END);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.from).toBe(EVT_START);
    expect(result.value.to).toBe(EVT_END);
  });

  it('rejects a range entirely before the event window', () => {
    const result = validateDateRange('2024-06-01', '2024-06-30', EVT_START, EVT_END);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/outside/i);
  });

  it('rejects a range entirely after the event window', () => {
    const result = validateDateRange('2024-08-01', '2024-08-15', EVT_START, EVT_END);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/outside/i);
  });

  it('rejects from > to', () => {
    const result = validateDateRange('2024-07-15', '2024-07-10', EVT_START, EVT_END);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/on or before/i);
  });

  it('rejects a malformed from date', () => {
    const result = validateDateRange('bad-date', undefined, EVT_START, EVT_END);
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed to date', () => {
    const result = validateDateRange('2024-07-01', 'bad-date', EVT_START, EVT_END);
    expect(result.ok).toBe(false);
  });

  it('accepts event boundary dates as a single-day entry', () => {
    const start = validateDateRange(EVT_START, undefined, EVT_START, EVT_END);
    expect(start.ok).toBe(true);
    const end = validateDateRange(EVT_END, undefined, EVT_START, EVT_END);
    expect(end.ok).toBe(true);
  });

  it('produces kind=date when from equals to after clamping', () => {
    // Range starts before and ends on the first day of the event
    const result = validateDateRange('2024-06-25', '2024-07-01', EVT_START, EVT_END);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.kind).toBe('date');
    expect(result.value.from).toBe(EVT_START);
    expect(result.value.to).toBe(EVT_START);
  });
});

// ---------------------------------------------------------------------------
// validateTimeRange
// ---------------------------------------------------------------------------

describe('validateTimeRange', () => {
  const EVT_START = '2024-07-01';
  const EVT_END   = '2024-07-31';

  const baseInput = {
    fromDate: '2024-07-10',
    toDate: '2024-07-10',
    startTime: '10:00',
    endTime: '12:00',
  };

  it('accepts a valid time range within the event window', () => {
    const result = validateTimeRange(baseInput, EVT_START, EVT_END);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.fromDate).toBe('2024-07-10');
    expect(result.value.toDate).toBe('2024-07-10');
    expect(result.value.startTime).toBe('10:00');
    expect(result.value.endTime).toBe('12:00');
    expect(result.value.outsideBookableWindow).toBe(false);
  });

  it('defaults toDate to fromDate when omitted', () => {
    const result = validateTimeRange(
      { fromDate: '2024-07-10', startTime: '10:00', endTime: '12:00' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.toDate).toBe('2024-07-10');
  });

  it('rejects startTime >= endTime', () => {
    const result = validateTimeRange(
      { ...baseInput, startTime: '12:00', endTime: '12:00' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/strictly before/i);
  });

  it('rejects startTime > endTime', () => {
    const result = validateTimeRange(
      { ...baseInput, startTime: '14:00', endTime: '10:00' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed startTime', () => {
    const result = validateTimeRange(
      { ...baseInput, startTime: '9:00' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/start time/i);
  });

  it('rejects a malformed endTime', () => {
    const result = validateTimeRange(
      { ...baseInput, endTime: '25:00' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/end time/i);
  });

  it('rejects a malformed fromDate', () => {
    const result = validateTimeRange(
      { ...baseInput, fromDate: 'bad' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(false);
  });

  it('clamps date range that extends beyond the event window', () => {
    const result = validateTimeRange(
      { fromDate: '2024-07-28', toDate: '2024-08-05', startTime: '10:00', endTime: '12:00' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.fromDate).toBe('2024-07-28');
    expect(result.value.toDate).toBe(EVT_END);
  });

  it('rejects a date range entirely outside the event window', () => {
    const result = validateTimeRange(
      { fromDate: '2024-08-01', toDate: '2024-08-05', startTime: '10:00', endTime: '12:00' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/outside/i);
  });

  it('flags outsideBookableWindow=true when startTime is before 10:00', () => {
    const result = validateTimeRange(
      { ...baseInput, startTime: '09:00', endTime: '11:00' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.outsideBookableWindow).toBe(true);
  });

  it('flags outsideBookableWindow=false for a time exactly at 10:00', () => {
    const result = validateTimeRange(
      { ...baseInput, startTime: '10:00', endTime: '23:00' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.outsideBookableWindow).toBe(false);
  });

  it('does not error when times are outside bookable window — only flags the note', () => {
    // Early morning time — accepted but noted
    const result = validateTimeRange(
      { ...baseInput, startTime: '07:00', endTime: '08:30' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.outsideBookableWindow).toBe(true);
  });

  it('accepts times that span the full bookable window (10:00–23:59)', () => {
    const result = validateTimeRange(
      { ...baseInput, startTime: '10:00', endTime: '23:59' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.outsideBookableWindow).toBe(false);
  });

  it('rejects fromDate > toDate', () => {
    const result = validateTimeRange(
      { fromDate: '2024-07-20', toDate: '2024-07-10', startTime: '10:00', endTime: '12:00' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error();
    expect(result.error).toMatch(/on or before/i);
  });

  it('accepts a multi-day time range, clamped to event window', () => {
    const result = validateTimeRange(
      { fromDate: '2024-07-05', toDate: '2024-07-08', startTime: '14:00', endTime: '16:00' },
      EVT_START,
      EVT_END,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error();
    expect(result.value.fromDate).toBe('2024-07-05');
    expect(result.value.toDate).toBe('2024-07-08');
  });
});
