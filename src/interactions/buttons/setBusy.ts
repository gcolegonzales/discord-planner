/**
 * Set busy times button handler — prefix 'evt:setbusy'
 *
 * Ephemeral entry point that tells the user how to add busy dates/times.
 * Points them to /busy-dates (whole-day blocks) and /busy-time (time ranges).
 *
 * The acting user is ALWAYS interaction.user.id — never from the customId.
 */

import type { ButtonInteraction } from 'discord.js';
import type { ButtonModule } from '../router';
import { decode } from '../customId';

const PREFIX = 'evt:setbusy';

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

  await interaction.reply({
    content: [
      '## Set your busy times',
      '',
      'Use one of these commands to mark when you are unavailable:',
      '',
      `**Whole days:**`,
      `\`/busy-dates event:${eventId} from:YYYY-MM-DD\``,
      `\`/busy-dates event:${eventId} from:YYYY-MM-DD to:YYYY-MM-DD\``,
      '',
      `**Specific time window:**`,
      `\`/busy-time event:${eventId} from_date:YYYY-MM-DD start_time:HH:MM end_time:HH:MM\``,
      '',
      'You must have clicked **Accept** before you can add busy times.',
      'To see or remove your entries, click **My busy times**.',
    ].join('\n'),
    ephemeral: true,
  });
}

export const button: ButtonModule = { prefix: PREFIX, execute };
