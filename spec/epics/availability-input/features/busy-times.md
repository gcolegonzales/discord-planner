---
id: FEAT-availability-input-2
title: Busy time ranges (within days)
epic: availability-input
status: ready
depends_on: [FEAT-event-lifecycle-3, FEAT-foundation-2]
model_hint: sonnet
---

## Summary
Let a participant mark a time-of-day range as busy on a single date or across a date range (e.g. "busy 1–4pm on Jul 3", or "busy 9am–12pm Jul 8–12"). Stored as time-range busy entries; triggers a results refresh.

## User stories
- As a participant, I want to block specific hours, optionally repeated across several days.

## Acceptance criteria
- [ ] Entry point: a `/busy-time` command and/or a modal from **Set busy times**, accepting `from_date` (YYYY-MM-DD, required), `to_date` (optional, defaults to `from_date`), `start_time` (HH:MM, required), `end_time` (HH:MM, required). The busy time range applies to each day in `[from_date, to_date]`.
- [ ] Validation (pure, unit-tested): times parse as 24h `HH:MM`; `start_time < end_time`; dates parse and the date span clamps to the event window. Times outside 10:00–24:00 are accepted but the handler notes they fall outside the bookable window and won't change results.
- [ ] Only participants may add; non-participant → ephemeral prompt to Accept; nothing stored.
- [ ] Persists `busy_entries` rows of kind `time_range` with `start_time`/`end_time` and the date span.
- [ ] On success: triggers results refresh + ephemeral confirmation.
- [ ] If implemented as a modal, it uses ≤ 5 text inputs (Discord limit).

## Constraints / non-goals
- A single contiguous time range per submission; multiple ranges = multiple submissions.

## Affected areas
- `src/interactions/commands/busyTime.ts` (and/or modal handler), `src/domain/validate.ts`
- `test/validate.test.ts` (time-range validation)

## Dependencies
- FEAT-event-lifecycle-3 (participation), FEAT-foundation-2 (persistence).

## Open questions
- None.
