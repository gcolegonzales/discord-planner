/**
 * /plan command — create a scheduling event.
 *
 * Options:
 *   title     (string, required)
 *   start     (string YYYY-MM-DD, required)
 *   end       (string YYYY-MM-DD, required)
 *   timezone  (string IANA, optional → DEFAULT_TIMEZONE)
 *
 * Flow:
 *   1. Defer the reply (ephemeral) to satisfy the 3-second ack window.
 *   2. Validate inputs via validateEventInput.
 *   3. On failure: follow-up with an ephemeral error message; no DB write.
 *   4. On success:
 *      a. Create the event row (repo.createEvent).
 *      b. Post the event message (buildEventMessage) in the channel.
 *      c. Store the posted message id (repo.setEventMessageId).
 *      d. Follow-up ephemerally with a confirmation link.
 */

import { SlashCommandBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { randomUUID } from 'crypto';
import type { CommandModule } from '../router';
import { loadConfig } from '../../config';
import { validateEventInput } from '../../domain/validate';
import { getDb } from '../../db/singleton';
import * as repo from '../../db/repo';
import { buildEventMessage } from '../../ui/eventMessage';

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

const data = new SlashCommandBuilder()
  .setName('plan')
  .setDescription('Create a scheduling event and post it in this channel')
  .addStringOption((opt) =>
    opt.setName('title').setDescription('Event title (max 100 characters)').setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('start')
      .setDescription('Start date (YYYY-MM-DD)')
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('end')
      .setDescription('End date (YYYY-MM-DD)')
      .setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName('timezone')
      .setDescription('IANA timezone (e.g. America/New_York). Defaults to server default.')
      .setRequired(false),
  );

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  // Acknowledge immediately (work may take > 3 s for Discord API round-trips)
  await interaction.deferReply({ ephemeral: true });

  const config = loadConfig();

  const title = interaction.options.getString('title', true);
  const start = interaction.options.getString('start', true);
  const end = interaction.options.getString('end', true);
  const timezone = interaction.options.getString('timezone') ?? config.defaultTimezone;

  // Validate
  const result = validateEventInput(
    { title, start, end, timezone },
    { maxDays: config.maxEventDays },
  );

  if (!result.ok) {
    await interaction.followUp({
      content: `❌ ${result.error}`,
      ephemeral: true,
    });
    return;
  }

  const validated = result.value;

  // Ensure we're in a guild text channel
  const channel = interaction.channel;
  if (
    !channel ||
    !(
      channel.type === ChannelType.GuildText ||
      channel.type === ChannelType.GuildAnnouncement ||
      channel.type === ChannelType.PublicThread ||
      channel.type === ChannelType.PrivateThread
    )
  ) {
    await interaction.followUp({
      content: '❌ This command can only be used in a text channel.',
      ephemeral: true,
    });
    return;
  }

  const db = getDb();
  const eventId = randomUUID();

  // Create the event row (no message_id yet)
  const event = repo.createEvent(db, {
    id: eventId,
    guild_id: interaction.guildId ?? '',
    channel_id: channel.id,
    title: validated.title,
    start_date: validated.start,
    end_date: validated.end,
    timezone: validated.timezone,
    creator_id: interaction.user.id,
  });

  // Post the event message in the channel
  const payload = buildEventMessage(event, []);
  const posted = await channel.send({
    embeds: payload.embeds,
    components: payload.components,
  });

  // Store the message id
  repo.setEventMessageId(db, eventId, posted.id);

  // Confirm to the creator
  await interaction.followUp({
    content: `✅ Event created! [Jump to message](${posted.url})`,
    ephemeral: true,
  });
}

// ---------------------------------------------------------------------------
// Export (auto-discovered by loader)
// ---------------------------------------------------------------------------

// SlashCommandBuilder.addStringOption returns SlashCommandOptionsOnlyBuilder,
// which lacks addSubcommand(Group). Serialise to JSON (the CommandModule union
// allows RESTPostAPIChatInputApplicationCommandsJSONBody) so the type resolves.
export const command: CommandModule = {
  data: data.toJSON(),
  execute,
};
