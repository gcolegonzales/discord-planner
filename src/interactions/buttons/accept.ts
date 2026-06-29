/**
 * Accept button handler — prefix 'evt:accept'
 *
 * Adds the acting user as a participant (idempotent).
 * - Already a participant → ephemeral note, no change.
 * - Not a participant   → addParticipant, updateEventMessage, ephemeral confirm.
 *
 * The acting user is ALWAYS interaction.user.id — never from the customId.
 */

import type { ButtonInteraction } from 'discord.js';
import type { ButtonModule } from '../router';
import { decode } from '../customId';
import { getDb } from '../../db/singleton';
import * as repo from '../../db/repo';
import { updateEventMessage } from '../../ui/eventMessage';

const PREFIX = 'evt:accept';

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

  // Check if already a participant
  const participants = repo.listParticipants(db, eventId);
  const alreadyIn = participants.some((p) => p.user_id === userId);

  if (alreadyIn) {
    await interaction.reply({
      content: "You're already participating in this event. 👍",
      ephemeral: true,
    });
    return;
  }

  // Add participant
  repo.addParticipant(db, eventId, userId);

  // Update the event message in the channel
  await updateEventMessage(interaction.client, event);

  await interaction.reply({
    content: `✅ You've joined **${event.title}**! Set your busy times to help find the best window.`,
    ephemeral: true,
  });
}

export const button: ButtonModule = { prefix: PREFIX, execute };
