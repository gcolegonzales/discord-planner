---
id: FEAT-availability-engine-2
title: Matching & ranking engine (pure)
epic: availability-engine
status: ready
depends_on: [FEAT-availability-engine-1]
model_hint: opus
---

## Summary
The core computation: from participants + busy entries over a date range, compute per-slot free counts, merge into windows, and rank them "most-available first" (the heatmap behavior). Pure and heavily unit-tested. See [[0002-timezone-and-slot-model]].

## User stories
- As an organizer, I want the bot to tell me the best times to meet, ranked by how many of us are free.

## Acceptance criteria
- [ ] `src/domain/matching.ts` exports `computeAvailability(participants, busyEntries, startDate, endDate, timezone, options?)` returning `{ windows: RankedWindow[], perDay: DayAvailability[] }`.
- [ ] For each slot (from FEAT-availability-engine-1), compute the set/count of participants who are **free** (no busy entry of theirs overlaps the slot).
- [ ] Merge consecutive slots **on the same date with the identical free-participant set** into a `RankedWindow` `{ date, startMin, endMin, freeCount, freeUserIds, totalParticipants }`.
- [ ] Rank windows by `freeCount` desc → duration desc → earliest `startMin`. Return at most `MAX_RESULT_WINDOWS` (default 5). Windows where `freeCount === totalParticipants` (everyone free) sort to the top by construction.
- [ ] Never emit a window starting before 10:00 or ending after 24:00 (inherited from the slot grid).
- [ ] `perDay` provides, per date, the ordered per-slot `freeCount` array (drives the heatmap bar).
- [ ] Deterministic and pure. Vitest covers: an everyone-free window; partial overlaps producing distinct adjacent windows with different free sets; ranking order and each tie-break; zero participants (no windows); one fully-busy participant capping `freeCount` at N−1; a busy `date_range` blocking whole days; and a multi-day range.

## Constraints / non-goals
- No Discord, no DB, no wall-clock-now dependence. Formatting/strings belong to the display feature, not here.

## Affected areas
- `src/domain/matching.ts` (+ `RankedWindow`, `DayAvailability` types)
- `test/matching.test.ts`

## Dependencies
- FEAT-availability-engine-1 (slot grid + overlap test).

## Open questions
- None.
