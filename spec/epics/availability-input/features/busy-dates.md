---
id: FEAT-availability-input-1
title: Busy dates & date ranges (whole-day)
epic: availability-input
status: ready
depends_on: [FEAT-event-lifecycle-3, FEAT-foundation-2]
model_hint: sonnet
---

## Summary
Let a participant mark whole days as busy — a single date or an inclusive date range — and store them as busy entries. Adding availability triggers a results refresh.

## User stories
- As a participant, I want to say "I'm out July 3" or "I'm away July 8–12" in one step.

## Acceptance criteria
- [ ] Entry point: a `/busy-dates` command and/or a modal launched from the **Set busy times** button, accepting `from` (YYYY-MM-DD, required) and `to` (YYYY-MM-DD, optional). `to` omitted → single busy date; `to` set → inclusive whole-day range.
- [ ] Validation (pure, unit-tested in `src/domain/validate.ts`): dates parse; `from <= to`; the range is **clamped** to the event's `[start_date, end_date]`; a range entirely outside the event window → ephemeral error, nothing stored.
- [ ] Only event participants may add; a non-participant gets an ephemeral prompt to **Accept** first, and nothing is stored.
- [ ] Persists a `busy_entries` row of kind `date` (single) or `date_range`.
- [ ] On success: triggers the results refresh (FEAT-availability-engine-3) and replies ephemerally summarizing the stored entry (e.g. "Marked busy: Jul 8–12").

## Constraints / non-goals
- Whole-day only here; time-of-day busy is FEAT-availability-input-2.

## Affected areas
- `src/interactions/commands/busyDates.ts` (and/or modal handler), `src/domain/validate.ts`
- `test/validate.test.ts` (date-range validation + clamping)

## Dependencies
- FEAT-event-lifecycle-3 (participation), FEAT-foundation-2 (persistence).

## Open questions
- None.
