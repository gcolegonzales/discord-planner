/**
 * CustomId helpers for Discord button interactions.
 *
 * Format: `evt:<action>:<eventId>`
 *
 * Actions: accept | setbusy | mybusy | results | leave
 *
 * - encode(action, eventId) → string
 * - decode(customId)        → { action, eventId } | null
 */

/** The set of valid actions encoded in a button customId. */
export type CustomIdAction = 'accept' | 'setbusy' | 'mybusy' | 'results' | 'leave';

const VALID_ACTIONS = new Set<CustomIdAction>(['accept', 'setbusy', 'mybusy', 'results', 'leave']);

/** The prefix all event-related customIds start with. */
const EVT_PREFIX = 'evt';

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

/**
 * Encode an action and event id into a Discord button customId.
 * @example encode('accept', 'abc123') → 'evt:accept:abc123'
 */
export function encode(action: CustomIdAction, eventId: string): string {
  return `${EVT_PREFIX}:${action}:${eventId}`;
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

export interface DecodedCustomId {
  action: CustomIdAction;
  eventId: string;
}

/**
 * Decode a customId back into `{ action, eventId }`.
 *
 * Returns `null` when:
 * - the string does not start with `evt:`
 * - fewer than 3 colon-delimited segments
 * - the action segment is not a recognised action
 * - the eventId segment is empty
 *
 * Note: the eventId itself may contain colons; everything after the second
 * colon is treated as the eventId.
 */
export function decode(customId: string): DecodedCustomId | null {
  // Must start with 'evt:'
  if (!customId.startsWith(`${EVT_PREFIX}:`)) return null;

  // Everything after 'evt:' — split on the FIRST colon only to get action,
  // then the remainder is the eventId (which may itself contain colons).
  const rest = customId.slice(EVT_PREFIX.length + 1); // strip 'evt:'
  const colonIdx = rest.indexOf(':');
  if (colonIdx === -1) return null; // no second colon → no eventId

  const action = rest.slice(0, colonIdx);
  const eventId = rest.slice(colonIdx + 1);

  if (!VALID_ACTIONS.has(action as CustomIdAction)) return null;
  if (eventId.length === 0) return null;

  return { action: action as CustomIdAction, eventId };
}
