/**
 * Busy-list renderer.
 *
 * buildBusyListPayload(event, entries) → { content, components }
 *   Renders the caller's busy entries for an event as a textual list and
 *   provides Remove buttons (one per entry, up to 20) plus a Clear all button.
 *
 * Pure formatting helpers are exported for unit testing.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type APIActionRowComponent,
  type APIButtonComponent,
} from 'discord.js';
import { DateTime } from 'luxon';
import type { BusyEntry, Event } from '../domain/types';

// ---------------------------------------------------------------------------
// Pure formatting helpers (unit-tested)
// ---------------------------------------------------------------------------

/**
 * Format a single BusyEntry as a human-readable string in the event timezone.
 *
 * Kinds:
 *   date        → "Mon Jul 1" (whole day)
 *   date_range  → "Mon Jul 1 – Thu Jul 4" (inclusive)
 *   time_range  → "Mon Jul 1 – Thu Jul 4, 14:00–17:00" (or single-day variant)
 */
export function formatBusyEntry(entry: BusyEntry, timezone: string): string {
  const tz = timezone;
  const fromDt = DateTime.fromISO(entry.start_date, { zone: tz });
  const toDt = DateTime.fromISO(entry.end_date, { zone: tz });

  const fromLabel = fromDt.toFormat('EEE MMM d');
  const toLabel = toDt.toFormat('EEE MMM d');

  if (entry.kind === 'date') {
    return fromLabel;
  }

  if (entry.kind === 'date_range') {
    return `${fromLabel} – ${toLabel}`;
  }

  // time_range
  const timeRange = `${entry.start_time ?? '?'}–${entry.end_time ?? '?'}`;
  if (entry.start_date === entry.end_date) {
    return `${fromLabel}, ${timeRange}`;
  }
  return `${fromLabel} – ${toLabel}, ${timeRange}`;
}

// ---------------------------------------------------------------------------
// Button builder helpers
// ---------------------------------------------------------------------------

/**
 * Build a customId for a "Remove entry" button.
 * Format: evt:rmbusy:<eventId>:<entryId>
 */
export function encodeRemoveId(eventId: string, entryId: string): string {
  return `evt:rmbusy:${eventId}:${entryId}`;
}

/**
 * Build a customId for the "Clear all" button.
 * Format: evt:clrbusy:<eventId>
 */
export function encodeClearId(eventId: string): string {
  return `evt:clrbusy:${eventId}`;
}

// ---------------------------------------------------------------------------
// Payload builder
// ---------------------------------------------------------------------------

/** Maximum busy entries we show Remove buttons for (Discord: 5 rows × 4 buttons, leaving 1 per row for layout). */
const MAX_REMOVE_BUTTONS = 20;

export interface BusyListPayload {
  content: string;
  components: APIActionRowComponent<APIButtonComponent>[];
}

/**
 * Build the ephemeral busy-list message payload.
 *
 * Layout:
 *   - Text list of entries (numbered)
 *   - Action rows of Remove buttons (up to MAX_REMOVE_BUTTONS entries, 5 per row)
 *   - Final row: Clear all button (and a note if entries were truncated)
 */
export function buildBusyListPayload(event: Event, entries: BusyEntry[]): BusyListPayload {
  if (entries.length === 0) {
    return {
      content: 'You have no busy times set for this event.',
      components: [],
    };
  }

  const tz = event.timezone;

  // Text list — show all entries, numbered
  const listLines = entries.map((e, i) => `**${i + 1}.** ${formatBusyEntry(e, tz)}`);
  const content = [
    `## Your busy times for **${event.title}**`,
    '',
    ...listLines,
    '',
    'Use the buttons below to remove individual entries or clear all.',
  ].join('\n');

  // Remove buttons — up to MAX_REMOVE_BUTTONS, 5 per action row
  const buttonRows: APIActionRowComponent<APIButtonComponent>[] = [];
  const visible = entries.slice(0, MAX_REMOVE_BUTTONS);
  const ROW_SIZE = 5;

  for (let i = 0; i < visible.length; i += ROW_SIZE) {
    const rowEntries = visible.slice(i, i + ROW_SIZE);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      rowEntries.map((e, offset) => {
        const label = `Remove ${i + offset + 1}`;
        return new ButtonBuilder()
          .setCustomId(encodeRemoveId(event.id, e.id))
          .setLabel(label)
          .setStyle(ButtonStyle.Danger);
      }),
    );
    buttonRows.push(row.toJSON());
  }

  // Clear all button row
  const clearRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(encodeClearId(event.id))
      .setLabel('🗑️ Clear all')
      .setStyle(ButtonStyle.Danger),
  );
  buttonRows.push(clearRow.toJSON());

  return {
    content,
    components: buttonRows,
  };
}
