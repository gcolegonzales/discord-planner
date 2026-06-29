# Discord Scheduler — group availability planning bot

## Vision
A Discord bot that helps a group find a time everyone can meet, entirely inside Discord (no companion website). A member starts a planning **event** for a date range; others opt in and submit the times they're **busy** (single days, multi-day ranges, and time ranges within days); the bot computes and continuously displays the **best matching availability windows** — ranked by how many participants are free — like a lightweight Outlook Scheduling Assistant / When2meet that lives in a channel.

## Goals
- Let a user create a planning event in a channel with one slash command.
- Let other members opt in ("Accept") and submit busy times with a few clicks / a short form.
- Support three kinds of busy entry: a single busy date, a busy date **range** (multi-day), and a busy **time range** within one or more days.
- Compute availability over the event's date range in 30-minute slots, within a daily window of **10:00–24:00** (event-local), and **never propose a window starting before 10:00am**.
- Display results as a **ranked "most-available" heatmap**: windows where everyone is free first, then near-misses (e.g. 4 of 5 free), with the count shown.
- Update the results automatically whenever a participant changes their availability.
- Run locally on the user's Windows PC with a bot token they supply; be deployable to an always-on host later without rework.

## Non-goals
- No companion web app or web UI of any kind. All interaction is via Discord (slash commands, buttons, modals, embeds).
- No image/canvas rendering for v1 (results are text/embed based). Image output is a possible later enhancement, not in scope now.
- No per-user timezones in v1 — a single timezone is set per event (see [[0002-timezone-and-slot-model]]).
- No recurring events, no calendar sync (Google/Outlook/iCal), no reminders/notifications beyond the live-updating results message.
- No external database server; storage is a local file (SQLite). No multi-shard / large-scale concerns.
- Not a general-purpose calendar — it answers "when is everyone free within this date range," nothing more.

## Personas
- **Organizer** — the member who starts the event. Sets the title, date range, and timezone, and shares the event message. Wants a clear ranked answer to "when can we all meet?"
- **Participant** — a member who accepts the event and submits their busy times. Wants entering availability to be fast and forgiving, and to see the current best windows.

## Key flows
1. **Create event**: Organizer runs `/plan title:<text> start:<YYYY-MM-DD> end:<YYYY-MM-DD> timezone:<IANA>` → bot creates the event and posts an **event message** (embed) in the channel with buttons: **Accept**, **Set busy times**, **My busy times**, **Results**, **Leave**.
2. **Join**: Participant clicks **Accept** → added to the participant list; the event message updates to show them.
3. **Submit busy time**: Participant clicks **Set busy times** → a modal (or `/busy` command) captures one busy entry: a single date, a date range, or a date(+range) with a start–end time. Repeatable for multiple entries.
4. **Manage busy times**: Participant clicks **My busy times** → ephemeral list of their entries with the ability to remove one or clear all.
5. **See matching availability**: Anyone clicks **Results** (or the message auto-refreshes) → ranked list of the best windows within the date range, each showing the local day + time span and how many of N participants are free, plus a per-day availability bar.

## Constraints
- Pure Discord; respect Discord limits (modal = max 5 inputs; embed field/length limits; 3s interaction ack window — defer long work).
- Daily availability window is **10:00–24:00 event-local**; earliest proposed start is **10:00**. These are fixed product rules for v1.
- 30-minute slot granularity.
- Single event timezone (IANA name), default supplied via config; all dates/times entered and displayed in that zone.
- Local-first: a single SQLite file; no network storage. Bot token and default timezone come from environment/config, never committed.
- **Date-range cap:** an event spans at most **31 days** (`start..end` inclusive), configurable via `MAX_EVENT_DAYS`. Keeps results readable and within Discord embed limits.
- **Results size:** show the top **5** windows by rank (configurable via `MAX_RESULT_WINDOWS`). When some windows have everyone free, show those first; otherwise show the best near-misses.

## Authorization model
> Tier is `local-tool`, so heavy multi-tenant authz isn't required — but the bot is still the authority and must key every mutation to the **calling Discord user**, never a client-supplied id.
- Any member who can see the channel may run `/plan`, **Accept**, and view **Results**.
- A user may add/remove/clear **only their own** busy entries; **Leave** removes only the caller. The handler derives the user from `interaction.user.id` — never from a command option or customId payload.
- Only an event's **participants'** busy entries count toward its results.
- Bot-process enforcement (there is no client to trust): every repo write is scoped to `(event_id, interaction.user.id)`.

## Glossary
- **Event** — a planning session bound to a channel, with a title, a date range `[start, end]` (inclusive), and one timezone. Has participants and their busy entries.
- **Participant** — a member who Accepted an event. Only participants' busy times count toward results.
- **Busy entry** — one record of unavailability owned by a participant. One of: *busy date* (whole day), *busy date range* (whole days, inclusive), or *busy time range* (a start–end clock time applied to a date or an inclusive date range).
- **Slot** — a 30-minute interval on a given date within the daily window 10:00–24:00, event-local. A participant is *free* in a slot if no busy entry of theirs overlaps it, else *busy*.
- **Window** — a maximal run of consecutive slots on a single day with the same free-participant set (or, for results, a contiguous run that meets a freeness threshold). Reported with its day, time span, and free count.
- **Event message** — the bot's embed in the channel that shows event info, participants, and the action buttons; edited in place to stay current.
- **Daily window** — the bookable span each day: 10:00 (inclusive) to 24:00 (exclusive), event-local.

## Open questions
- None blocking. (Resolved: 31-day range cap and top-5 result windows — both configurable; see Constraints. Flagged to the user at hand-off for confirmation.)
