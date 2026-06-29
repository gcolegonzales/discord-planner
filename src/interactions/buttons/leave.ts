/**
 * Leave button handler — prefix 'evt:leave'
 *
 * Removes the acting user as a participant and cascades their busy entries.
 * - Not a participant → ephemeral note, no change.
 * - Is a participant  → removeParticipant (cascades busy entries), updateEventMessage, ephemeral confirm.
 *
 * The acting user is ALWAYS interaction.user.id — never from the customId.
 */

import type { ButtonInteraction } from 'discord.js';
import type { ButtonModule } from '../router';
import { decode } from '../customId';
import { getDb } from '../../db/singleton';
import * as repo from '../../db/repo';
import { updateEventMessage } from '../../ui/eventMessage';

const PREFIX = 'evt:leave';

async function execute(interaction: ButtonInteraction): Promise<void> {
  // Decode eventId from the customId (acting user is always interaction.user.id)
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

  // Verify the event exists
  const event = repo.getEvent(db, eventId);
  if (!event) {
    await interaction.reply({
      content: '❌ This event no longer exists.',
      ephemeral: true,
    });
    return;
  }

  // Check if currently a participant
  const participants = repo.listParticipants(db, eventId);
  const isIn = participants.some((p) => p.user_id === userId);

  if (!isIn) {
    await interaction.reply({
      content: "You're not currently participating in this event.",
      ephemeral: true,
    });
    return;
  }

  // Remove participant + cascade busy entries
  repo.removeParticipant(db, eventId, userId);

  // Update the event message in the channel
  await updateEventMessage(interaction.client, event);

  await interaction.reply({
    content: `✅ You've left **${event.title}**. Your busy times have been cleared.`,
    ephemeral: true,
  });
}

export const button: ButtonModule = { prefix: PREFIX, execute };
