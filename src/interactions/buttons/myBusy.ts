/**
 * My busy times button handler — prefix 'evt:mybusy'
 *
 * Shows an ephemeral list of the caller's busy entries for the event.
 * Each entry has a Remove button; there is also a Clear all button.
 *
 * The acting user is ALWAYS interaction.user.id — never from the customId.
 */

import type { ButtonInteraction } from 'discord.js';
import type { ButtonModule } from '../router';
import { decode } from '../customId';
import { getDb } from '../../db/singleton';
import * as repo from '../../db/repo';
import { buildBusyListPayload } from '../../ui/busyList';

const PREFIX = 'evt:mybusy';

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
  const userId = interaction.user.id;
  const db = getDb();

  const event = repo.getEvent(db, eventId);
  if (!event) {
    await interaction.reply({
      content: '❌ This event no longer exists.',
      ephemeral: true,
    });
    return;
  }

  const entries = repo.listBusyEntries(db, eventId, userId);
  const payload = buildBusyListPayload(event, entries);

  await interaction.reply({
    content: payload.content,
    components: payload.components,
    ephemeral: true,
  });
}

export const button: ButtonModule = { prefix: PREFIX, execute };
