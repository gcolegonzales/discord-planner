---
id: FEAT-event-lifecycle-1
title: /plan create-event command & validation
epic: event-lifecycle
status: ready
depends_on: [FEAT-foundation-2, FEAT-event-lifecycle-2]
model_hint: sonnet
---

## Summary
The `/plan` slash command that creates a planning event: validate the inputs, persist the event, post the event message in the channel, and confirm to the creator.

## User stories
- As an organizer, I want to start an event with a title, date range, and timezone in one command.

## Acceptance criteria
- [ ] `/plan` is registered with options: `title` (string, required), `start` (string `YYYY-MM-DD`, required), `end` (string `YYYY-MM-DD`, required), `timezone` (string IANA, optional → `DEFAULT_TIMEZONE`).
- [ ] Validation lives in pure, unit-tested `src/domain/validate.ts`: `start`/`end` parse as `YYYY-MM-DD`; `start <= end`; span ≤ `MAX_EVENT_DAYS` (default 31, inclusive); `timezone` is a valid IANA zone (luxon); `title` non-empty and ≤ 100 chars. Each failure returns a specific message.
- [ ] Invalid input → **ephemeral** reply naming the problem; no event row created.
- [ ] Valid input → create the event row, post the event message (FEAT-event-lifecycle-2) in the channel, store its `message_id`, and reply ephemerally with a confirmation linking to the message.
- [ ] The handler defers the reply if work may exceed Discord's 3s ack window.

## Constraints / non-goals
- Creating the event does not add the creator as a participant automatically (they Accept like everyone else) unless trivially desired — keep them out of the participant list until they Accept.

## Affected areas
- `src/interactions/commands/plan.ts`, `src/domain/validate.ts`, `src/deploy-commands.ts` (register `/plan`)
- `test/validate.test.ts`

## Dependencies
- FEAT-foundation-2 (persistence), FEAT-event-lifecycle-2 (event message to post).

## Open questions
- None.
