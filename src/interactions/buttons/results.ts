/**
 * Results button handler — prefix 'evt:results'
 *
 * Shows the availability results embed ephemerally for the current event.
 * The acting user is ALWAYS interaction.user.id — never from the customId.
 */

import type { ButtonInteraction } from 'discord.js';
import type { ButtonModule } from '../router';
import { decode } from '../customId';
import { getDb } from '../../db/singleton';
import * as repo from '../../db/repo';
import { buildResultsEmbedFromDb } from '../../ui/results';

const PREFIX = 'evt:results';

async function execute(interaction: ButtonInteraction): Promise<void> {
  const decoded = decode(interaction.customId);
  if (!decoded) {
    await interaction.reply({
      content: '❌ Malformed button id. This button may be outdated.',
      ephemeral: true,
    });
    return;
  }

  const { eventId } = decoded;
  const db = getDb();

  const event = repo.getEvent(db, eventId);
  if (!event) {
    await interaction.reply({
      content: '❌ This event no longer exists.',
      ephemeral: true,
    });
    return;
  }

  const embed = buildResultsEmbedFromDb(event);

  await interaction.reply({
    embeds: [embed.toJSON()],
    ephemeral: true,
  });
}

export const button: ButtonModule = { prefix: PREFIX, execute };
