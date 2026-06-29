/**
 * /results command — show the availability results embed ephemerally.
 *
 * Options:
 *   event  (string, required) — the event ID
 *
 * Flow:
 *   1. Defer reply (ephemeral).
 *   2. Look up the event by ID.
 *   3. Build results embed from current DB data.
 *   4. Follow up ephemerally with the embed.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { CommandModule } from '../router';
import { getDb } from '../../db/singleton';
import * as repo from '../../db/repo';
import { buildResultsEmbedFromDb } from '../../ui/results';

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

const data = new SlashCommandBuilder()
  .setName('results')
  .setDescription('Show the current availability results for an event (only visible to you)')
  .addStringOption((opt) =>
    opt
      .setName('event')
      .setDescription('Event ID (from the event message)')
      .setRequired(true),
  );

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const eventId = interaction.options.getString('event', true).trim();
  const db = getDb();

  const event = repo.getEvent(db, eventId);
  if (!event) {
    await interaction.followUp({
      content: '❌ Event not found. Check the event ID.',
      ephemeral: true,
    });
    return;
  }

  const embed = buildResultsEmbedFromDb(event);

  await interaction.followUp({
    embeds: [embed.toJSON()],
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
