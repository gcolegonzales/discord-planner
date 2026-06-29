/**
 * Remove busy entry button handler — prefix 'evt:rmbusy'
 *
 * CustomId format: evt:rmbusy:<eventId>:<entryId>
 *
 * Removes one of the caller's busy entries, refreshes results,
 * and re-renders the ephemeral busy-list (update in place).
 *
 * The acting user is ALWAYS interaction.user.id — never from the customId.
 * A user can only remove their OWN entries (verified by fetching back from DB).
 */

import type { ButtonInteraction } from 'discord.js';
import type { ButtonModule } from '../router';
import { getDb } from '../../db/singleton';
import * as repo from '../../db/repo';
import { refreshResults } from '../../ui/results';
import { buildBusyListPayload } from '../../ui/busyList';

const PREFIX = 'evt:rmbusy';

/** Parse customId of format evt:rmbusy:<eventId>:<entryId> */
function parseCustomId(customId: string): { eventId: string; entryId: string } | null {
  if (!customId.startsWith(`${PREFIX}:`)) return null;
  const rest = customId.slice(PREFIX.length + 1);
  const colonIdx = rest.indexOf(':');
  if (colonIdx === -1) return null;
  const eventId = rest.slice(0, colonIdx);
  const entryId = rest.slice(colonIdx + 1);
  if (!eventId || !entryId) return null;
  return { eventId, entryId };
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

  const { eventId, entryId } = parsed;
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

  // Verify the entry belongs to the acting user before deleting
  const userEntries = repo.listBusyEntries(db, eventId, userId);
  const entryBelongsToUser = userEntries.some((e) => e.id === entryId);

  if (!entryBelongsToUser) {
    await interaction.reply({
      content: '❌ Entry not found or does not belong to you.',
      ephemeral: true,
    });
    return;
  }

  // Delete the entry
  repo.removeBusyEntry(db, entryId);

  // Refresh results
  await refreshResults(interaction.client, event);

  // Re-render the busy list (update in place)
  const freshEntries = repo.listBusyEntries(db, eventId, userId);
  const payload = buildBusyListPayload(event, freshEntries);

  await interaction.update({
    content: payload.content,
    components: payload.components,
  });
}

export const button: ButtonModule = { prefix: PREFIX, execute };
