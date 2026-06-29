/**
 * Shared domain types — no discord.js imports here.
 */

export type BusyKind = 'date' | 'date_range' | 'time_range';

export interface Event {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  timezone: string;   // IANA
  creator_id: string;
  created_at: string; // ISO timestamp
}

export interface Participant {
  event_id: string;
  user_id: string;
  accepted_at: string; // ISO timestamp
}

export interface BusyEntry {
  id: string;
  event_id: string;
  user_id: string;
  kind: BusyKind;
  start_date: string;        // YYYY-MM-DD
  end_date: string;          // YYYY-MM-DD (same as start_date for single date)
  start_time: string | null; // HH:MM, null for whole-day
  end_time: string | null;   // HH:MM, null for whole-day
  created_at: string;        // ISO timestamp
}
