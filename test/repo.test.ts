import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase } from '../src/db/connection';
import {
  createEvent,
  getEvent,
  setEventMessageId,
  deleteEvent,
  addParticipant,
  removeParticipant,
  listParticipants,
  addBusyEntry,
  listBusyEntries,
  removeBusyEntry,
  clearBusyEntries,
} from '../src/db/repo';
import type Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeDb(): Database.Database {
  return openDatabase(':memory:');
}

function sampleEvent(overrides: Partial<Parameters<typeof createEvent>[1]> = {}): Parameters<typeof createEvent>[1] {
  return {
    id: 'evt-1',
    guild_id: 'guild-1',
    channel_id: 'chan-1',
    title: 'Team sync',
    start_date: '2024-07-01',
    end_date: '2024-07-07',
    timezone: 'America/New_York',
    creator_id: 'user-creator',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

describe('createEvent / getEvent', () => {
  it('creates an event and retrieves it by id', () => {
    const db = makeDb();
    const evt = createEvent(db, sampleEvent());

    expect(evt.id).toBe('evt-1');
    expect(evt.title).toBe('Team sync');
    expect(evt.start_date).toBe('2024-07-01');
    expect(evt.end_date).toBe('2024-07-07');
    expect(evt.timezone).toBe('America/New_York');
    expect(evt.message_id).toBeNull();
    expect(evt.created_at).toBeTruthy();

    const fetched = getEvent(db, 'evt-1');
    expect(fetched).toEqual(evt);
  });

  it('returns undefined for a missing event', () => {
    const db = makeDb();
    expect(getEvent(db, 'no-such-event')).toBeUndefined();
  });

  it('stores guild_id, channel_id, creator_id correctly', () => {
    const db = makeDb();
    createEvent(db, sampleEvent());
    const evt = getEvent(db, 'evt-1');
    expect(evt?.guild_id).toBe('guild-1');
    expect(evt?.channel_id).toBe('chan-1');
    expect(evt?.creator_id).toBe('user-creator');
  });
});

describe('setEventMessageId', () => {
  it('sets message_id on an existing event', () => {
    const db = makeDb();
    createEvent(db, sampleEvent());
    setEventMessageId(db, 'evt-1', 'msg-abc');
    const evt = getEvent(db, 'evt-1');
    expect(evt?.message_id).toBe('msg-abc');
  });

  it('can overwrite an existing message_id', () => {
    const db = makeDb();
    createEvent(db, sampleEvent());
    setEventMessageId(db, 'evt-1', 'msg-1');
    setEventMessageId(db, 'evt-1', 'msg-2');
    expect(getEvent(db, 'evt-1')?.message_id).toBe('msg-2');
  });
});

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

describe('addParticipant / listParticipants / removeParticipant', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
    createEvent(db, sampleEvent());
  });

  it('adds a participant and lists them', () => {
    addParticipant(db, 'evt-1', 'user-A');
    const participants = listParticipants(db, 'evt-1');
    expect(participants).toHaveLength(1);
    expect(participants[0].user_id).toBe('user-A');
    expect(participants[0].event_id).toBe('evt-1');
    expect(participants[0].accepted_at).toBeTruthy();
  });

  it('is idempotent — adding the same user twice does not duplicate', () => {
    addParticipant(db, 'evt-1', 'user-A');
    addParticipant(db, 'evt-1', 'user-A');
    expect(listParticipants(db, 'evt-1')).toHaveLength(1);
  });

  it('lists multiple participants', () => {
    addParticipant(db, 'evt-1', 'user-A');
    addParticipant(db, 'evt-1', 'user-B');
    addParticipant(db, 'evt-1', 'user-C');
    expect(listParticipants(db, 'evt-1')).toHaveLength(3);
  });

  it('removes a participant', () => {
    addParticipant(db, 'evt-1', 'user-A');
    addParticipant(db, 'evt-1', 'user-B');
    removeParticipant(db, 'evt-1', 'user-A');
    const remaining = listParticipants(db, 'evt-1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].user_id).toBe('user-B');
  });

  it('lists zero participants when none added', () => {
    expect(listParticipants(db, 'evt-1')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Busy entries
// ---------------------------------------------------------------------------

describe('addBusyEntry / listBusyEntries / removeBusyEntry / clearBusyEntries', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
    createEvent(db, sampleEvent());
    addParticipant(db, 'evt-1', 'user-A');
    addParticipant(db, 'evt-1', 'user-B');
  });

  it('adds a single-date busy entry and lists it', () => {
    const entry = addBusyEntry(db, {
      id: 'be-1',
      event_id: 'evt-1',
      user_id: 'user-A',
      kind: 'date',
      start_date: '2024-07-03',
      end_date: '2024-07-03',
    });

    expect(entry.id).toBe('be-1');
    expect(entry.kind).toBe('date');
    expect(entry.start_date).toBe('2024-07-03');
    expect(entry.end_date).toBe('2024-07-03');
    expect(entry.start_time).toBeNull();
    expect(entry.end_time).toBeNull();

    const list = listBusyEntries(db, 'evt-1');
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(entry);
  });

  it('adds a date_range busy entry', () => {
    addBusyEntry(db, {
      id: 'be-2',
      event_id: 'evt-1',
      user_id: 'user-A',
      kind: 'date_range',
      start_date: '2024-07-02',
      end_date: '2024-07-04',
    });

    const list = listBusyEntries(db, 'evt-1');
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('date_range');
  });

  it('adds a time_range busy entry with times', () => {
    const entry = addBusyEntry(db, {
      id: 'be-3',
      event_id: 'evt-1',
      user_id: 'user-A',
      kind: 'time_range',
      start_date: '2024-07-01',
      end_date: '2024-07-01',
      start_time: '09:00',
      end_time: '11:00',
    });

    expect(entry.start_time).toBe('09:00');
    expect(entry.end_time).toBe('11:00');
  });

  it('listBusyEntries filtered by userId returns only that user\'s entries', () => {
    addBusyEntry(db, { id: 'be-A1', event_id: 'evt-1', user_id: 'user-A', kind: 'date', start_date: '2024-07-01', end_date: '2024-07-01' });
    addBusyEntry(db, { id: 'be-A2', event_id: 'evt-1', user_id: 'user-A', kind: 'date', start_date: '2024-07-02', end_date: '2024-07-02' });
    addBusyEntry(db, { id: 'be-B1', event_id: 'evt-1', user_id: 'user-B', kind: 'date', start_date: '2024-07-03', end_date: '2024-07-03' });

    const aEntries = listBusyEntries(db, 'evt-1', 'user-A');
    expect(aEntries).toHaveLength(2);
    expect(aEntries.every(e => e.user_id === 'user-A')).toBe(true);

    const bEntries = listBusyEntries(db, 'evt-1', 'user-B');
    expect(bEntries).toHaveLength(1);
    expect(bEntries[0].user_id).toBe('user-B');
  });

  it('listBusyEntries without userId returns all entries for the event', () => {
    addBusyEntry(db, { id: 'be-A1', event_id: 'evt-1', user_id: 'user-A', kind: 'date', start_date: '2024-07-01', end_date: '2024-07-01' });
    addBusyEntry(db, { id: 'be-B1', event_id: 'evt-1', user_id: 'user-B', kind: 'date', start_date: '2024-07-02', end_date: '2024-07-02' });

    expect(listBusyEntries(db, 'evt-1')).toHaveLength(2);
  });

  it('removeBusyEntry removes a specific entry by id', () => {
    addBusyEntry(db, { id: 'be-1', event_id: 'evt-1', user_id: 'user-A', kind: 'date', start_date: '2024-07-01', end_date: '2024-07-01' });
    addBusyEntry(db, { id: 'be-2', event_id: 'evt-1', user_id: 'user-A', kind: 'date', start_date: '2024-07-02', end_date: '2024-07-02' });

    removeBusyEntry(db, 'be-1');

    const list = listBusyEntries(db, 'evt-1');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('be-2');
  });

  it('clearBusyEntries removes all entries for a (event, user) pair', () => {
    addBusyEntry(db, { id: 'be-A1', event_id: 'evt-1', user_id: 'user-A', kind: 'date', start_date: '2024-07-01', end_date: '2024-07-01' });
    addBusyEntry(db, { id: 'be-A2', event_id: 'evt-1', user_id: 'user-A', kind: 'date', start_date: '2024-07-02', end_date: '2024-07-02' });
    addBusyEntry(db, { id: 'be-B1', event_id: 'evt-1', user_id: 'user-B', kind: 'date', start_date: '2024-07-03', end_date: '2024-07-03' });

    clearBusyEntries(db, 'evt-1', 'user-A');

    expect(listBusyEntries(db, 'evt-1', 'user-A')).toHaveLength(0);
    // user-B's entries are untouched
    expect(listBusyEntries(db, 'evt-1', 'user-B')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Cascade: removing participant clears their busy entries
// ---------------------------------------------------------------------------

describe('cascade: removeParticipant clears busy entries', () => {
  it('deletes all busy entries for the removed participant', () => {
    const db = makeDb();
    createEvent(db, sampleEvent());
    addParticipant(db, 'evt-1', 'user-A');
    addParticipant(db, 'evt-1', 'user-B');

    addBusyEntry(db, { id: 'be-A1', event_id: 'evt-1', user_id: 'user-A', kind: 'date', start_date: '2024-07-01', end_date: '2024-07-01' });
    addBusyEntry(db, { id: 'be-A2', event_id: 'evt-1', user_id: 'user-A', kind: 'date_range', start_date: '2024-07-02', end_date: '2024-07-04' });
    addBusyEntry(db, { id: 'be-B1', event_id: 'evt-1', user_id: 'user-B', kind: 'date', start_date: '2024-07-05', end_date: '2024-07-05' });

    removeParticipant(db, 'evt-1', 'user-A');

    // user-A's entries are gone
    expect(listBusyEntries(db, 'evt-1', 'user-A')).toHaveLength(0);
    // user-B's entries survive
    expect(listBusyEntries(db, 'evt-1', 'user-B')).toHaveLength(1);
    // participant list no longer includes user-A
    const participants = listParticipants(db, 'evt-1');
    expect(participants).toHaveLength(1);
    expect(participants[0].user_id).toBe('user-B');
  });
});

// ---------------------------------------------------------------------------
// Cascade: deleting an event clears participants + busy entries
// ---------------------------------------------------------------------------

describe('cascade: deleteEvent clears participants and busy entries', () => {
  it('removes all participants and busy entries when the event is deleted', () => {
    const db = makeDb();
    createEvent(db, sampleEvent());
    addParticipant(db, 'evt-1', 'user-A');
    addParticipant(db, 'evt-1', 'user-B');
    addBusyEntry(db, { id: 'be-1', event_id: 'evt-1', user_id: 'user-A', kind: 'date', start_date: '2024-07-01', end_date: '2024-07-01' });
    addBusyEntry(db, { id: 'be-2', event_id: 'evt-1', user_id: 'user-B', kind: 'date', start_date: '2024-07-02', end_date: '2024-07-02' });

    deleteEvent(db, 'evt-1');

    expect(getEvent(db, 'evt-1')).toBeUndefined();
    // These tables should be empty due to CASCADE
    expect(listParticipants(db, 'evt-1')).toHaveLength(0);
    expect(listBusyEntries(db, 'evt-1')).toHaveLength(0);
  });

  it('only deletes the targeted event, leaving others intact', () => {
    const db = makeDb();
    createEvent(db, sampleEvent({ id: 'evt-1' }));
    createEvent(db, sampleEvent({ id: 'evt-2' }));
    addParticipant(db, 'evt-1', 'user-A');
    addParticipant(db, 'evt-2', 'user-B');

    deleteEvent(db, 'evt-1');

    expect(getEvent(db, 'evt-1')).toBeUndefined();
    expect(getEvent(db, 'evt-2')).toBeDefined();
    expect(listParticipants(db, 'evt-2')).toHaveLength(1);
  });
});
