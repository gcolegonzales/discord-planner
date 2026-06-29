/**
 * /busy-time command — mark a time-of-day range as busy across one or more days.
 *
 * Options:
 *   event       (string, required)           — event ID
 *   from_date   (string YYYY-MM-DD, required) — start date of busy range
 *   to_date     (string YYYY-MM-DD, optional) — end date; defaults to from_date
 *   start_time  (string HH:MM, required)     — start of the daily busy window
 *   end_time    (string HH:MM, required)     — end of the daily busy window
 *
 * The busy window applies to every day in [from_date, to_date].
 *
 * Flow:
 *   1. Defer reply (ephemeral).
 *   2. Look up the event.
 *   3. Verify caller is a participant (else prompt to Accept).
 *   4. Validate via validateTimeRange (clamping dates to event window).
 *   5. Store a busy_entry of kind time_range.
 *   6. Call refreshResults.
 *   7. Reply ephemerally; note if times fall outside the bookable window.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { randomUUID } from 'crypto';
import type { CommandModule } from '../router';
import { getDb } from '../../db/singleton';
import * as repo from '../../db/repo';
import { validateTimeRange } from '../../domain/validate';
import { refreshResults } from '../../ui/results';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

const data = new SlashCommandBuilder()
  .setName('busy-time')
  .setDescription('Mark a specific time window as busy (repeated across a date range)')
  .addStringOption((opt) =>
    opt
      .setName('event')
      .setDescription('Event ID (from the event message)')
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('from_date')
      .setDescription('Date the busy window starts (YYYY-MM-DD)')
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('start_time')
      .setDescription('Start of the busy window in 24-hour format (HH:MM, e.g. 14:00)')
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('end_time')
      .setDescription('End of the busy window in 24-hour format (HH:MM, e.g. 17:30)')
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('to_date')
      .setDescription(
        'Last date the busy window applies (YYYY-MM-DD, inclusive). Omit to apply only to from_date.',
      )
      .setRequired(false),
  );

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const eventId = interaction.options.getString('event', true).trim();
  const fromDateRaw = interaction.options.getString('from_date', true).trim();
  const toDateRaw = interaction.options.getString('to_date')?.trim() ?? undefined;
  const startTimeRaw = interaction.options.getString('start_time', true).trim();
  const endTimeRaw = interaction.options.getString('end_time', true).trim();

  const db = getDb();

  // Verify event exists
  const event = repo.getEvent(db, eventId);
  if (!event) {
    await interaction.followUp({
      content: '❌ Event not found. Check the event ID.',
      ephemeral: true,
    });
    return;
  }

  // Verify caller is a participant (acting user = interaction.user.id)
  const userId = interaction.user.id;
  const participants = repo.listParticipants(db, eventId);
  const isParticipant = participants.some((p) => p.user_id === userId);

  if (!isParticipant) {
    await interaction.followUp({
      content:
        '❌ You are not a participant in this event. Click **Accept** on the event message first.',
      ephemeral: true,
    });
    return;
  }

  // Validate & clamp
  const validation = validateTimeRange(
    { fromDate: fromDateRaw, toDate: toDateRaw, startTime: startTimeRaw, endTime: endTimeRaw },
    event.start_date,
    event.end_date,
  );

  if (!validation.ok) {
    await interaction.followUp({
      content: `❌ ${validation.error}`,
      ephemeral: true,
    });
    return;
  }

  const { fromDate, toDate, startTime, endTime, outsideBookableWindow } = validation.value;

  // Persist
  repo.addBusyEntry(db, {
    id: randomUUID(),
    event_id: eventId,
    user_id: userId,
    kind: 'time_range',
    start_date: fromDate,
    end_date: toDate,
    start_time: startTime,
    end_time: endTime,
  });

  // Refresh results (no-op currently — on-demand display)
  await refreshResults(interaction.client, event);

  // Format summary in event timezone
  const tz = event.timezone;
  const fromLabel = DateTime.fromISO(fromDate, { zone: tz }).toFormat('MMM d');
  const toLabel = DateTime.fromISO(toDate, { zone: tz }).toFormat('MMM d');
  const dateRangeLabel = fromDate === toDate ? fromLabel : `${fromLabel}–${toLabel}`;

  const lines: string[] = [
    `✅ Marked busy: **${startTime}–${endTime}** on **${dateRangeLabel}**.`,
  ];

  if (outsideBookableWindow) {
    lines.push(
      '⚠️ Note: Part of this window falls outside the bookable hours (10:00–24:00), so it will not affect availability results.',
    );
  }

  lines.push('Use **/results** or the Results button to see the updated availability.');

  await interaction.followUp({
    content: lines.join('\n'),
    ephemeral: true,
  });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const command: CommandModule = {
  data: data.toJSON(),
  execute,
};
