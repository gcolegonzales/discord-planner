/**
 * Data-access layer — the ONLY file with SQL.
 * All functions are synchronous (better-sqlite3).
 */

import Database from 'better-sqlite3';
import type { Event, Participant, BusyEntry, BusyKind } from '../domain/types';

// ---------------------------------------------------------------------------
// Row shapes returned by better-sqlite3 (untyped by default, we narrow them)
// ---------------------------------------------------------------------------

interface EventRow {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  title: string;
  start_date: string;
  end_date: string;
  timezone: string;
  creator_id: string;
  created_at: string;
}

interface ParticipantRow {
  event_id: string;
  user_id: string;
  accepted_at: string;
}

interface BusyEntryRow {
  id: string;
  event_id: string;
  user_id: string;
  kind: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    guild_id: row.guild_id,
    channel_id: row.channel_id,
    message_id: row.message_id,
    title: row.title,
    start_date: row.start_date,
    end_date: row.end_date,
    timezone: row.timezone,
    creator_id: row.creator_id,
    created_at: row.created_at,
  };
}

function rowToParticipant(row: ParticipantRow): Participant {
  return {
    event_id: row.event_id,
    user_id: row.user_id,
    accepted_at: row.accepted_at,
  };
}

function rowToBusyEntry(row: BusyEntryRow): BusyEntry {
  return {
    id: row.id,
    event_id: row.event_id,
    user_id: row.user_id,
    kind: row.kind as BusyKind,
    start_date: row.start_date,
    end_date: row.end_date,
    start_time: row.start_time,
    end_time: row.end_time,
    created_at: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface CreateEventInput {
  id: string;
  guild_id: string;
  channel_id: string;
  title: string;
  start_date: string;
  end_date: string;
  timezone: string;
  creator_id: string;
}

export function createEvent(db: Database.Database, input: CreateEventInput): Event {
  const now = new Date().toISOString();
  db.prepare<[string, string, string, string, string, string, string, string, string]>(`
    INSERT INTO events (id, guild_id, channel_id, message_id, title, start_date, end_date, timezone, creator_id, created_at)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.guild_id,
    input.channel_id,
    input.title,
    input.start_date,
    input.end_date,
    input.timezone,
    input.creator_id,
    now,
  );
  return getEvent(db, input.id) as Event;
}

export function getEvent(db: Database.Database, eventId: string): Event | undefined {
  const row = db.prepare<[string], EventRow>(
    'SELECT * FROM events WHERE id = ?',
  ).get(eventId);
  return row ? rowToEvent(row) : undefined;
}

export function setEventMessageId(
  db: Database.Database,
  eventId: string,
  messageId: string,
): void {
  db.prepare<[string, string]>(
    'UPDATE events SET message_id = ? WHERE id = ?',
  ).run(messageId, eventId);
}

export function deleteEvent(db: Database.Database, eventId: string): void {
  db.prepare<[string]>('DELETE FROM events WHERE id = ?').run(eventId);
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export function addParticipant(
  db: Database.Database,
  eventId: string,
  userId: string,
): Participant {
  const now = new Date().toISOString();
  db.prepare<[string, string, string]>(`
    INSERT OR IGNORE INTO participants (event_id, user_id, accepted_at)
    VALUES (?, ?, ?)
  `).run(eventId, userId, now);
  return getParticipantRow(db, eventId, userId) as Participant;
}

function getParticipantRow(
  db: Database.Database,
  eventId: string,
  userId: string,
): Participant | undefined {
  const row = db.prepare<[string, string], ParticipantRow>(
    'SELECT * FROM participants WHERE event_id = ? AND user_id = ?',
  ).get(eventId, userId);
  return row ? rowToParticipant(row) : undefined;
}

export function removeParticipant(
  db: Database.Database,
  eventId: string,
  userId: string,
): void {
  // Cascade in the DB handles their busy_entries deletion
  db.prepare<[string, string]>(
    'DELETE FROM participants WHERE event_id = ? AND user_id = ?',
  ).run(eventId, userId);
  // Also explicitly clear busy entries keyed by (event_id, user_id)
  // because busy_entries FK is to events (not participants), so cascade
  // won't fire on participant delete. We do it manually.
  clearBusyEntries(db, eventId, userId);
}

export function listParticipants(
  db: Database.Database,
  eventId: string,
): Participant[] {
  const rows = db.prepare<[string], ParticipantRow>(
    'SELECT * FROM participants WHERE event_id = ?',
  ).all(eventId);
  return rows.map(rowToParticipant);
}

// ---------------------------------------------------------------------------
// Busy entries
// ---------------------------------------------------------------------------

export interface AddBusyEntryInput {
  id: string;
  event_id: string;
  user_id: string;
  kind: BusyKind;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
}

export function addBusyEntry(
  db: Database.Database,
  input: AddBusyEntryInput,
): BusyEntry {
  const now = new Date().toISOString();
  db.prepare<[string, string, string, string, string, string, string | null, string | null, string]>(`
    INSERT INTO busy_entries (id, event_id, user_id, kind, start_date, end_date, start_time, end_time, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id,
    input.event_id,
    input.user_id,
    input.kind,
    input.start_date,
    input.end_date,
    input.start_time ?? null,
    input.end_time ?? null,
    now,
  );
  const row = db.prepare<[string], BusyEntryRow>(
    'SELECT * FROM busy_entries WHERE id = ?',
  ).get(input.id);
  return rowToBusyEntry(row as BusyEntryRow);
}

export function listBusyEntries(
  db: Database.Database,
  eventId: string,
  userId?: string,
): BusyEntry[] {
  if (userId !== undefined) {
    const rows = db.prepare<[string, string], BusyEntryRow>(
      'SELECT * FROM busy_entries WHERE event_id = ? AND user_id = ?',
    ).all(eventId, userId);
    return rows.map(rowToBusyEntry);
  }
  const rows = db.prepare<[string], BusyEntryRow>(
    'SELECT * FROM busy_entries WHERE event_id = ?',
  ).all(eventId);
  return rows.map(rowToBusyEntry);
}

export function removeBusyEntry(db: Database.Database, entryId: string): void {
  db.prepare<[string]>('DELETE FROM busy_entries WHERE id = ?').run(entryId);
}

export function clearBusyEntries(
  db: Database.Database,
  eventId: string,
  userId: string,
): void {
  db.prepare<[string, string]>(
    'DELETE FROM busy_entries WHERE event_id = ? AND user_id = ?',
  ).run(eventId, userId);
}
