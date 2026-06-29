---
id: FEAT-event-lifecycle-3
title: Participation (Accept / Leave)
epic: event-lifecycle
status: ready
depends_on: [FEAT-event-lifecycle-1, FEAT-event-lifecycle-2]
model_hint: sonnet
---

## Summary
The Accept and Leave button behaviors: opting into an event as a participant and opting out (which also clears the user's busy entries). The event message updates to reflect the current roster.

## User stories
- As a member, I want to click Accept to join an event and Leave to drop out.

## Acceptance criteria
- [ ] **Accept** (`evt:accept:<id>`) adds the clicking user as a participant. Idempotent: an already-joined user gets an ephemeral "you're already in" and no duplicate row.
- [ ] **Leave** (`evt:leave:<id>`) removes the user and cascades — their busy entries for that event are deleted. A non-participant gets an ephemeral "you're not in this event."
- [ ] After Accept or Leave, the event message participant list + count update immediately (via FEAT-event-lifecycle-2's update function), and the user gets an ephemeral confirmation.
- [ ] Only participants' busy entries count toward results (enforced because Leave clears them and input features require participation).

## Constraints / non-goals
- No role/permission gating in v1 (anyone in the channel may Accept).

## Affected areas
- `src/interactions/buttons/accept.ts`, `src/interactions/buttons/leave.ts`

## Dependencies
- FEAT-event-lifecycle-1 (event exists), FEAT-event-lifecycle-2 (message update).

## Open questions
- None.
