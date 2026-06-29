---
id: FEAT-availability-input-3
title: Manage my busy times (view / remove / clear)
epic: availability-input
status: ready
depends_on: [FEAT-availability-input-1, FEAT-availability-input-2]
model_hint: sonnet
---

## Summary
Let a participant review the busy entries they've added for an event and remove one or clear them all, via an ephemeral message. Changes refresh results.

## User stories
- As a participant, I want to see and fix the busy times I entered without bothering anyone else.

## Acceptance criteria
- [ ] The **My busy times** button (`evt:mybusy:<id>`) and/or `/mybusy` shows an **ephemeral** list of the caller's busy entries for the event, each rendered human-readably (single date / date range / time range with times), in the event timezone.
- [ ] Each entry has a **Remove** control (button per entry, or a string-select of entries) plus a **Clear all** button.
- [ ] Remove deletes that one entry; Clear all deletes all the caller's entries for the event. Both then refresh results (FEAT-availability-engine-3) and re-render the ephemeral list.
- [ ] Empty state renders "You have no busy times set for this event."
- [ ] A user only ever sees/affects their own entries.

## Constraints / non-goals
- No editing-in-place of an entry (remove + re-add instead).

## Affected areas
- `src/interactions/buttons/myBusy.ts` (and/or `src/interactions/commands/myBusy.ts`), `src/ui/busyList.ts`
- `test/` where any list-formatting logic is pure

## Dependencies
- FEAT-availability-input-1, FEAT-availability-input-2.

## Open questions
- None.
