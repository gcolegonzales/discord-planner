/**
 * Unit tests for pure formatting helpers in src/ui/busyList.ts.
 */

import { describe, it, expect } from 'vitest';
import { formatBusyEntry, encodeRemoveId, encodeClearId } from '../src/ui/busyList';
import type { BusyEntry } from '../src/domain/types';

// ---------------------------------------------------------------------------
// formatBusyEntry
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<BusyEntry> = {}): BusyEntry {
  return {
    id: 'entry-1',
    event_id: 'event-1',
    user_id: 'user-1',
    kind: 'date',
    start_date: '2024-07-01',
    end_date: '2024-07-01',
    start_time: null,
    end_time: null,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('formatBusyEntry', () => {
  const tz = 'UTC';

  it('formats a single date', () => {
    const entry = makeEntry({ kind: 'date', start_date: '2024-07-01', end_date: '2024-07-01' });
    expect(formatBusyEntry(entry, tz)).toBe('Mon Jul 1');
  });

  it('formats a date range', () => {
    const entry = makeEntry({
      kind: 'date_range',
      start_date: '2024-07-08',
      end_date: '2024-07-12',
    });
    expect(formatBusyEntry(entry, tz)).toBe('Mon Jul 8 – Fri Jul 12');
  });

  it('formats a time range on a single day', () => {
    const entry = makeEntry({
      kind: 'time_range',
      start_date: '2024-07-03',
      end_date: '2024-07-03',
      start_time: '14:00',
      end_time: '17:00',
    });
    expect(formatBusyEntry(entry, tz)).toBe('Wed Jul 3, 14:00–17:00');
  });

  it('formats a time range spanning multiple days', () => {
    const entry = makeEntry({
      kind: 'time_range',
      start_date: '2024-07-08',
      end_date: '2024-07-12',
      start_time: '09:00',
      end_time: '12:00',
    });
    expect(formatBusyEntry(entry, tz)).toBe('Mon Jul 8 – Fri Jul 12, 09:00–12:00');
  });

  it('uses the provided timezone', () => {
    // 2024-07-01 in America/New_York is still Mon Jul 1 (no date shift)
    const entry = makeEntry({ kind: 'date', start_date: '2024-07-01', end_date: '2024-07-01' });
    expect(formatBusyEntry(entry, 'America/New_York')).toBe('Mon Jul 1');
  });
});

// ---------------------------------------------------------------------------
// encodeRemoveId / encodeClearId
// ---------------------------------------------------------------------------

describe('encodeRemoveId', () => {
  it('encodes to the expected format', () => {
    expect(encodeRemoveId('event-abc', 'entry-xyz')).toBe('evt:rmbusy:event-abc:entry-xyz');
  });

  it('handles UUID event and entry ids', () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440000';
    const entryId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    expect(encodeRemoveId(eventId, entryId)).toBe(`evt:rmbusy:${eventId}:${entryId}`);
  });
});

describe('encodeClearId', () => {
  it('encodes to the expected format', () => {
    expect(encodeClearId('event-abc')).toBe('evt:clrbusy:event-abc');
  });
});
