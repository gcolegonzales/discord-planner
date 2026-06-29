# 0002. Timezone handling and slot/availability model

- Status: accepted
- Date: 2026-06-28

## Context
The bot must compute "when is everyone free" across a date range and rank results. Users chose: single event timezone, daily window 10:00–24:00, 30-minute slots, and a "most-available heatmap" ranking (everyone-free first, then near-misses).

## Decision
- **One IANA timezone per event** (e.g. `America/Chicago`), set at creation (default from `DEFAULT_TIMEZONE` config). All entry and display happen in that zone. Per-user timezones are out of scope for v1.
- **Slot grid:** for each date in the inclusive `[start, end]` range, generate **30-minute** slots covering the **daily window 10:00 (inclusive) → 24:00 (exclusive)** event-local — i.e. slots at 10:00, 10:30, …, 23:30 (28 slots/day). No slot may start before 10:00 (the hard rule).
- **Freeness:** a participant is *busy* in a slot if any of their busy entries overlaps it:
  - *busy date* / *busy date range* → busy for **all** slots on those whole days.
  - *busy time range* → busy for slots overlapping `[from, to)` clock time on the applicable date(s). A slot `[s, s+30m)` is busy if it overlaps the entry interval at all.
  Otherwise the participant is *free*.
- **Ranking (heatmap):** score each slot by `freeCount = participants free`. Merge consecutive slots **with the same free set** on the same day into **windows**. Rank windows by: (1) `freeCount` desc, (2) duration desc, (3) earliest start. "Everyone free" (`freeCount == N`) windows sort to the top by construction.
- **DST:** compute slot instants with luxon in the event zone; a calendar day may be 23/25h on DST boundaries — derive slots from wall-clock 10:00–24:00 in-zone, not by adding fixed milliseconds.

## Consequences
- Results are deterministic and fully unit-testable from `(participants, busy entries, range, tz)` with no Discord dependency.
- Fixed 10:00–24:00 / 30-min / single-tz rules are encoded as constants; changing them later is a localized edit but a real change (re-spec).
- Whole-day busy entries dominate (block all 28 slots that day), which is the intended semantics for "I'm out that day."
