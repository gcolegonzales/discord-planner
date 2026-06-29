---
id: FEAT-event-lifecycle-2
title: Event message (embed + action buttons) with live update
epic: event-lifecycle
status: ready
depends_on: [FEAT-foundation-2]
model_hint: sonnet
---

## Summary
The bot's in-channel event message: an embed summarizing the event and its participants, an action-button row, and a function that edits the message in place so it always reflects current state. Other features post and update this message.

## User stories
- As a participant, I want one message I can act on (accept, add busy times, see results) and that stays current.

## Acceptance criteria
- [ ] `src/ui/eventMessage.ts` builds an embed showing: title, date range (`start_date`–`end_date`), timezone, creator, the participant list (mentions), participant count, and a short usage footer.
- [ ] An action row of buttons with stable customIds that encode the event id: **Accept** (`evt:accept:<id>`), **Set busy times** (`evt:setbusy:<id>`), **My busy times** (`evt:mybusy:<id>`), **Results** (`evt:results:<id>`), **Leave** (`evt:leave:<id>`).
- [ ] `updateEventMessage(client, event)` re-renders and **edits** the existing message (by `message_id`) from current event + participant state — never reposts. Safe to call after any change; no-ops cleanly if the message was deleted.
- [ ] Empty participant list renders "No one yet — click **Accept** to join."
- [ ] `src/interactions/customId.ts` encode/decode helpers round-trip `(action, eventId)` and reject malformed ids; covered by unit tests.

## Constraints / non-goals
- Rendering/util only — button *behavior* lives in the participation/input/results features. Respect embed length/field limits.

## Affected areas
- `src/ui/eventMessage.ts`, `src/interactions/customId.ts`
- `test/customId.test.ts`

## Dependencies
- FEAT-foundation-2 (event + participant data/types).

## Open questions
- None.
