/**
 * /busy-dates command — mark whole days as busy.
 *
 * Options:
 *   event  (string, required) — event ID
 *   from   (string YYYY-MM-DD, required) — start of busy range
 *   to     (string YYYY-MM-DD, optional) — end of busy range; defaults to `from`
 *
 * Flow:
 *   1. Defer reply (ephemeral).
 *   2. Look up the event.
 *   3. Verify the acting user is a participant (else prompt to Accept).
 *   4. Validate/clamp the date range via validateDateRange.
 *   5. Store as a busy_entry (kind: date | date_range).
 *   6. Call refreshResults.
 *   7. Reply ephemerally with a summary.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { randomUUID } from 'crypto';
import type { CommandModule } from '../router';
import { getDb } from '../../db/singleton';
import * as repo from '../../db/repo';
import { validateDateRange } from '../../domain/validate';
import { refreshResults } from '../../ui/results';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

const data = new SlashCommandBuilder()
  .setName('busy-dates')
  .setDescription('Mark whole days as busy for a scheduling event')
  .addStringOption((opt) =>
    opt
      .setName('event')
      .setDescription('Event ID (from the event message)')
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('from')
      .setDescription('Start of busy range (YYYY-MM-DD)')
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('to')
      .setDescription('End of busy range (YYYY-MM-DD, inclusive). Omit for a single day.')
      .setRequired(false),
  );

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const eventId = interaction.options.getString('event', true).trim();
  const fromRaw = interaction.options.getString('from', true).trim();
  const toRaw = interaction.options.getString('to')?.trim() ?? undefined;

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
  const validation = validateDateRange(fromRaw, toRaw, event.start_date, event.end_date);
  if (!validation.ok) {
    await interaction.followUp({
      content: `❌ ${validation.error}`,
      ephemeral: true,
    });
    return;
  }

  const { from, to, kind } = validation.value;

  // Persist
  repo.addBusyEntry(db, {
    id: randomUUID(),
    event_id: eventId,
    user_id: userId,
    kind,
    start_date: from,
    end_date: to,
    start_time: null,
    end_time: null,
  });

  // Refresh results (no-op currently — on-demand display)
  await refreshResults(interaction.client, event);

  // Format summary using the event timezone
  const tz = event.timezone;
  const fromLabel = DateTime.fromISO(from, { zone: tz }).toFormat('MMM d');
  const toLabel = DateTime.fromISO(to, { zone: tz }).toFormat('MMM d');
  const rangeLabel = from === to ? fromLabel : `${fromLabel}–${toLabel}`;

  await interaction.followUp({
    content: `✅ Marked busy: **${rangeLabel}** (whole day${from === to ? '' : 's'}). Use **/results** or the Results button to see the updated availability.`,
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
