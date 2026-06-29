/**
 * Results display — builds an embed from computeAvailability output.
 *
 * Exports:
 *   buildResultsEmbed(event, participants, busyEntries) → EmbedBuilder
 *   buildResultsEmbedFromDb(event)                      → EmbedBuilder  (fetches data from DB)
 *   refreshResults(client, event)                       → Promise<void>  (no-op; display is on-demand)
 *
 * The embed contains:
 *   1. A ranked list of top windows (at most MAX_RESULT_WINDOWS).
 *   2. A compact per-day availability heatmap bar.
 *
 * All times/dates are shown in the event timezone via luxon.
 */

import { EmbedBuilder, type Client } from 'discord.js';
import { DateTime } from 'luxon';
import { computeAvailability } from '../domain/matching';
import { MAX_RESULT_WINDOWS } from '../domain/constants';
import type { Event, Participant, BusyEntry } from '../domain/types';
import type { RankedWindow, DayAvailability } from '../domain/matching';
import * as repo from '../db/repo';
import { getDb } from '../db/singleton';

// ---------------------------------------------------------------------------
// Embed limits
// ---------------------------------------------------------------------------

// Discord field value max is 1024 chars.
const FIELD_MAX = 1024;

// ---------------------------------------------------------------------------
// Pure formatting helpers (unit-tested)
// ---------------------------------------------------------------------------

/**
 * Format minutes-since-midnight as a 12-hour clock string, e.g. "2:00 PM".
 */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m === 0 ? '00' : m.toString().padStart(2, '0');
  return `${h12}:${mm} ${period}`;
}

/**
 * Format a YYYY-MM-DD date as a human-readable string in the given IANA timezone,
 * e.g. "Tue Jul 1".
 */
export function formatDate(dateStr: string, timezone: string): string {
  const dt = DateTime.fromISO(dateStr, { zone: timezone });
  return dt.toFormat('EEE MMM d');
}

/**
 * Format a RankedWindow into a single embed line, using the full participant
 * list to name missing attendees.
 *
 * Examples:
 *   "**Tue Jul 1** · 2:00–5:00 PM · ✅ all 5 free"
 *   "**Tue Jul 1** · 2:00–5:00 PM · 4/5 free — missing <@123>"
 */
export function formatWindowFull(
  window: RankedWindow,
  timezone: string,
  allParticipantIds: string[],
): string {
  const dateLabel = formatDate(window.date, timezone);
  const start = formatMinutes(window.startMin);
  const end = formatMinutes(window.endMin);

  // Collapse the AM/PM on start when same period as end
  // e.g. "2:00–5:00 PM" vs "11:00 AM–1:00 PM"
  const startPeriod = window.startMin < 720 ? 'AM' : 'PM';
  const endPeriod = window.endMin <= 720 ? 'AM' : 'PM';
  let timeLabel: string;
  if (startPeriod === endPeriod) {
    const startNum = start.replace(` ${startPeriod}`, '');
    timeLabel = `${startNum}–${end}`;
  } else {
    timeLabel = `${start}–${end}`;
  }

  let freeLabel: string;
  if (window.totalParticipants === 0) {
    freeLabel = 'no participants';
  } else if (window.freeCount === window.totalParticipants) {
    freeLabel = `✅ all ${window.freeCount} free`;
  } else {
    const freeSet = new Set(window.freeUserIds);
    const busyIds = allParticipantIds.filter((id) => !freeSet.has(id));
    const mentions = busyIds.map((id) => `<@${id}>`).join(', ');
    freeLabel = `${window.freeCount}/${window.totalParticipants} free — missing ${mentions}`;
  }

  return `**${dateLabel}** · ${timeLabel} · ${freeLabel}`;
}

// ---------------------------------------------------------------------------
// Heatmap helpers (unit-tested)
// ---------------------------------------------------------------------------

/**
 * Map a free count to a block/emoji glyph.
 *
 * Levels (based on fraction free):
 *   no participants → ⬜ (unknown)
 *   0%              → ⬛ (none free)
 *   1–49%           → 🟥 (low)
 *   50–74%          → 🟨 (medium)
 *   75–99%          → 🟩 (high)
 *   100%            → ✅ (all free)
 */
export function freeCountToGlyph(freeCount: number, totalParticipants: number): string {
  if (totalParticipants === 0) return '⬜';
  if (freeCount === 0) return '⬛';
  if (freeCount === totalParticipants) return '✅';
  const fraction = freeCount / totalParticipants;
  if (fraction < 0.5) return '🟥';
  if (fraction < 0.75) return '🟨';
  return '🟩';
}

/**
 * Build a compact heatmap bar for one day from its per-slot free counts.
 *
 * Groups consecutive slots into 4-slot (2h) buckets, picking the best
 * (highest freeCount) in each to stay within embed limits for a 31-day event:
 *   31 days × 7 glyphs/day × ~2 bytes/glyph ≈ fits within FIELD_MAX.
 */
export function buildDayBar(freeCounts: number[], totalParticipants: number): string {
  if (freeCounts.length === 0) return '⬜';

  const GROUP_SIZE = 4;
  const glyphs: string[] = [];
  for (let i = 0; i < freeCounts.length; i += GROUP_SIZE) {
    const group = freeCounts.slice(i, i + GROUP_SIZE);
    const best = Math.max(...group);
    glyphs.push(freeCountToGlyph(best, totalParticipants));
  }
  return glyphs.join('');
}

/**
 * Build the full heatmap section text from perDay data.
 * Each line: "`Mon Jul 1` ✅🟩🟩🟥⬛⬛⬛"
 * Truncates to fit FIELD_MAX.
 */
export function buildHeatmap(
  perDay: DayAvailability[],
  totalParticipants: number,
  timezone: string,
): string {
  if (perDay.length === 0) return 'No date data.';

  const lines = perDay.map((day) => {
    const label = formatDate(day.date, timezone);
    const bar = buildDayBar(day.freeCounts, totalParticipants);
    return `\`${label}\` ${bar}`;
  });

  const legend = '\n⬛=none  🟥=low  🟨=half  🟩=high  ✅=all';

  // Join lines; trim from end if needed to fit FIELD_MAX
  let body = lines.join('\n');
  if (body.length + legend.length + 1 > FIELD_MAX) {
    while (lines.length > 1 && lines.join('\n').length + legend.length + 5 > FIELD_MAX) {
      lines.pop();
    }
    body = lines.join('\n') + '\n…';
  }

  return body + legend;
}

// ---------------------------------------------------------------------------
// Main embed builder
// ---------------------------------------------------------------------------

/**
 * Build the results embed from pre-fetched data.
 */
export function buildResultsEmbed(
  event: Event,
  participants: Participant[],
  busyEntries: BusyEntry[],
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`📅 Availability: ${event.title}`)
    .setColor(0x57f287); // green

  if (participants.length === 0) {
    embed.setDescription('No participants yet.');
    return embed;
  }

  const allParticipantIds = participants.map((p) => p.user_id);

  const result = computeAvailability(
    participants,
    busyEntries,
    event.start_date,
    event.end_date,
    event.timezone,
    { maxResultWindows: MAX_RESULT_WINDOWS },
  );

  const { windows, perDay } = result;

  // ----- Windows field -----------------------------------------------------
  let windowsText: string;
  if (windows.length === 0) {
    windowsText = '_No time slots with any participant free yet._';
  } else {
    const lines = windows.map((w) => formatWindowFull(w, event.timezone, allParticipantIds));
    windowsText = lines.join('\n');
  }

  embed.addFields({
    name: `🏆 Best windows (top ${Math.min(windows.length || 1, MAX_RESULT_WINDOWS)})`,
    value: truncate(windowsText, FIELD_MAX),
    inline: false,
  });

  // ----- Heatmap field -----------------------------------------------------
  const heatmapText = buildHeatmap(perDay, participants.length, event.timezone);

  embed.addFields({
    name: '📊 Daily availability',
    value: truncate(heatmapText, FIELD_MAX),
    inline: false,
  });

  embed.setFooter({
    text: `${event.start_date} – ${event.end_date} · ${event.timezone} · ${participants.length} participant(s)`,
  });

  return embed;
}

/**
 * Fetch all needed data from the DB and build the results embed for an event.
 */
export function buildResultsEmbedFromDb(event: Event): EmbedBuilder {
  const db = getDb();
  const participants = repo.listParticipants(db, event.id);
  const busyEntries = repo.listBusyEntries(db, event.id);
  return buildResultsEmbed(event, participants, busyEntries);
}

// ---------------------------------------------------------------------------
// refreshResults — called by input handlers after availability changes
// ---------------------------------------------------------------------------

/**
 * Recompute and cache results for an event after a busy-entry change.
 * Currently results are computed fresh on each /results or Results button click,
 * so this is a no-op placeholder for future caching.
 */
export async function refreshResults(_client: Client, _event: Event): Promise<void> {
  // Results are computed on-demand — no caching layer yet.
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}
