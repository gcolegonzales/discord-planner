/**
 * Event message builder and live-update helper.
 *
 * buildEventMessage(event, participants) → { embeds, components }
 *   Constructs the embed (title, dates, timezone, creator, roster) and
 *   an action row of 5 buttons (Accept, Set busy times, My busy times,
 *   Results, Leave), each with a customId encoded via customId.encode.
 *
 * updateEventMessage(client, event)
 *   Fetches the channel + message by event.message_id and edits it with
 *   the current repo state.  No-ops if the message is missing (deleted).
 *   Never reposts.
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
  type APIEmbed,
  type APIActionRowComponent,
  type APIButtonComponent,
} from 'discord.js';
import type { Event, Participant } from '../domain/types';
import { encode } from '../interactions/customId';
import { getDb } from '../db/singleton';
import * as repo from '../db/repo';

// ---------------------------------------------------------------------------
// Embed limits (Discord's hard limits)
// ---------------------------------------------------------------------------

const EMBED_DESCRIPTION_MAX = 4096;
const EMBED_FIELD_VALUE_MAX = 1024;

// ---------------------------------------------------------------------------
// buildEventMessage
// ---------------------------------------------------------------------------

export interface EventMessagePayload {
  embeds: APIEmbed[];
  components: APIActionRowComponent<APIButtonComponent>[];
}

/**
 * Build the embed + button row for an event.
 */
export function buildEventMessage(
  event: Event,
  participants: Participant[],
): EventMessagePayload {
  const embed = buildEmbed(event, participants);
  const row = buildButtonRow(event.id);

  return {
    embeds: [embed.toJSON()],
    components: [row.toJSON()],
  };
}

// ---------------------------------------------------------------------------
// Embed builder
// ---------------------------------------------------------------------------

function buildEmbed(event: Event, participants: Participant[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(truncate(event.title, 256))
    .setColor(0x5865f2); // Discord blurple

  // Date range + timezone
  embed.addFields({
    name: 'When',
    value: `${event.start_date} – ${event.end_date}`,
    inline: true,
  });
  embed.addFields({
    name: 'Timezone',
    value: event.timezone,
    inline: true,
  });
  embed.addFields({
    name: 'Organiser',
    value: `<@${event.creator_id}>`,
    inline: true,
  });

  // Participant list
  const rosterText = buildRosterText(participants);
  embed.addFields({
    name: `Participants (${participants.length})`,
    value: truncate(rosterText, EMBED_FIELD_VALUE_MAX),
    inline: false,
  });

  embed.setFooter({
    text: 'Click Accept to join · Set busy times to mark conflicts · Results to see best windows',
  });

  return embed;
}

/**
 * Build the roster field value.
 * Empty list → "No one yet — click **Accept** to join."
 */
function buildRosterText(participants: Participant[]): string {
  if (participants.length === 0) {
    return 'No one yet — click **Accept** to join.';
  }
  return participants.map((p) => `<@${p.user_id}>`).join('\n');
}

// ---------------------------------------------------------------------------
// Button row
// ---------------------------------------------------------------------------

function buildButtonRow(
  eventId: string,
): ActionRowBuilder<ButtonBuilder> {
  const accept = new ButtonBuilder()
    .setCustomId(encode('accept', eventId))
    .setLabel('Accept')
    .setStyle(ButtonStyle.Success);

  const setBusy = new ButtonBuilder()
    .setCustomId(encode('setbusy', eventId))
    .setLabel('Set busy times')
    .setStyle(ButtonStyle.Primary);

  const myBusy = new ButtonBuilder()
    .setCustomId(encode('mybusy', eventId))
    .setLabel('My busy times')
    .setStyle(ButtonStyle.Secondary);

  const results = new ButtonBuilder()
    .setCustomId(encode('results', eventId))
    .setLabel('Results')
    .setStyle(ButtonStyle.Secondary);

  const leave = new ButtonBuilder()
    .setCustomId(encode('leave', eventId))
    .setLabel('Leave')
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    accept,
    setBusy,
    myBusy,
    results,
    leave,
  );
}

// ---------------------------------------------------------------------------
// updateEventMessage
// ---------------------------------------------------------------------------

/**
 * Re-render the event message and edit it in place.
 *
 * Fetches current participants from the DB, builds a fresh payload, then
 * edits the existing Discord message.  If the message or channel no longer
 * exists (deleted), this is a no-op.
 *
 * NEVER reposts.
 */
export async function updateEventMessage(client: Client, event: Event): Promise<void> {
  if (!event.message_id) return;

  let channel;
  try {
    channel = await client.channels.fetch(event.channel_id);
  } catch {
    // Channel deleted or bot lacks access — silently ignore
    return;
  }

  if (!channel || !channel.isTextBased()) return;

  let message;
  try {
    message = await channel.messages.fetch(event.message_id);
  } catch {
    // Message deleted — silently ignore
    return;
  }

  const db = getDb();
  const participants = repo.listParticipants(db, event.id);
  const payload = buildEventMessage(event, participants);

  try {
    await message.edit({
      embeds: payload.embeds,
      components: payload.components,
    });
  } catch {
    // Edit failed (permissions revoked, etc.) — silently ignore
    return;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

// Suppress unused variable warning — EMBED_DESCRIPTION_MAX is kept as
// documentation of the Discord limit and used defensively elsewhere.
void (EMBED_DESCRIPTION_MAX as number);
