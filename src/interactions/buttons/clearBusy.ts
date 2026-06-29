/**
 * Clear all busy entries button handler — prefix 'evt:clrbusy'
 *
 * CustomId format: evt:clrbusy:<eventId>
 *
 * Clears ALL of the caller's busy entries for the event, refreshes results,
 * and re-renders the ephemeral busy-list (update in place).
 *
 * The acting user is ALWAYS interaction.user.id — never from the customId.
 */

import type { ButtonInteraction } from 'discord.js';
import type { ButtonModule } from '../router';
import { getDb } from '../../db/singleton';
import * as repo from '../../db/repo';
import { refreshResults } from '../../ui/results';
import { buildBusyListPayload } from '../../ui/busyList';

const PREFIX = 'evt:clrbusy';

/** Parse customId of format evt:clrbusy:<eventId> */
function parseCustomId(customId: string): { eventId: string } | null {
  if (!customId.startsWith(`${PREFIX}:`)) return null;
  const eventId = customId.slice(PREFIX.length + 1);
  if (!eventId) return null;
  return { eventId };
}

async function execute(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);
  if (!parsed) {
    await interaction.reply({
      content: '❌ Malformed button id.',
      ephemeral: true,
    });
    return;
  }

  const { eventId } = parsed;
  const userId = interaction.user.id;
  const db = getDb();

  const event = repo.getEvent(db, eventId);
  if (!event) {
    await interaction.update({
      content: '❌ This event no longer exists.',
      components: [],
    });
    return;
  }

  // Clear all entries for this user
  repo.clearBusyEntries(db, eventId, userId);

  // Refresh results
  await refreshResults(interaction.client, event);

  // Re-render the (now empty) busy list
  const payload = buildBusyListPayload(event, []);

  await interaction.update({
    content: payload.content,
    components: payload.components,
  });
}

export const button: ButtonModule = { prefix: PREFIX, execute };
