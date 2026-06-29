---
id: FEAT-availability-engine-1
title: Slot grid (pure, timezone/DST-safe)
epic: availability-engine
status: ready
depends_on: [FEAT-foundation-2]
model_hint: opus
---

## Summary
The pure, unit-tested foundation of the engine: build the discrete 30-minute slot grid over the event's date range within the 10:00–24:00 daily window (event-local, DST-correct via luxon), and decide whether a given busy entry overlaps a given slot. No Discord code. See [[0002-timezone-and-slot-model]].

## User stories
- As the matching engine, I need a deterministic slot grid and overlap test so availability is computed consistently.

## Acceptance criteria
- [ ] `src/domain/constants.ts` defines `DAY_START_MIN = 600` (10:00), `DAY_END_MIN = 1440` (24:00), `SLOT_MINUTES = 30`.
- [ ] `src/domain/slots.ts` exports `buildSlots(startDate, endDate, timezone)` returning ordered slots, each `{ date, startMin, endMin, startInstant, endInstant }`, covering 10:00→24:00 in 30-min steps for every date in `[startDate, endDate]` inclusive — 28 slots per normal day; first slot starts at 10:00, last is 23:30–24:00.
- [ ] **No slot starts before 10:00.** Instants are computed via luxon `DateTime.fromObject({...}, { zone })`.
- [ ] `isBusyEntryOverlappingSlot(entry, slot)` returns true iff the entry overlaps the slot: `date`/`date_range` → busy for **all** slots whose `date` falls in the entry's date span; `time_range` → busy for slots on applicable dates whose `[startMin,endMin)` overlaps the entry's `[start_time,end_time)`.
- [ ] DST-correct: slots derive from wall-clock 10:00–24:00 in-zone, not by adding fixed milliseconds; behavior on a DST-transition date is documented (a transition inside the window changes that day's slot count/instants).
- [ ] Vitest covers: 28 slots on a normal day; a multi-day range; overlap for each entry kind including partial time overlaps and exact boundaries (a slot touching only the entry's end is **not** busy); and a known US DST boundary date.

## Constraints / non-goals
- Pure module — no discord.js, no DB, no `Date.now()`; fully deterministic from its arguments.

## Affected areas
- `src/domain/slots.ts`, `src/domain/constants.ts`
- `test/slots.test.ts`

## Dependencies
- FEAT-foundation-2 (`BusyEntry` type).

## Open questions
- None.
