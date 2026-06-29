---
id: FEAT-foundation-2
title: SQLite persistence layer & data model
epic: foundation
status: ready
depends_on: [FEAT-foundation-1]
model_hint: sonnet
---

## Summary
The better-sqlite3 connection, schema, and a single typed data-access module for events, participants, and busy entries — plus the shared domain types these records use (also consumed by the availability engine). All persistence goes through this layer; no raw SQL elsewhere.

## User stories
- As a developer, I want one typed repo API for all reads/writes so handlers never touch SQL.
- As a participant, I want my data removed when I leave so it stops affecting results.

## Data model
- **events**: `id` (pk), `guild_id`, `channel_id`, `message_id` (nullable until posted), `title`, `start_date` (YYYY-MM-DD), `end_date`, `timezone` (IANA), `creator_id`, `created_at`.
- **participants**: `event_id` (fk→events, ON DELETE CASCADE), `user_id`, `accepted_at`; pk (`event_id`,`user_id`).
- **busy_entries**: `id` (pk), `event_id` (fk→events, ON DELETE CASCADE), `user_id`, `kind` (`'date' | 'date_range' | 'time_range'`), `start_date`, `end_date` (= `start_date` for single date), `start_time` (HH:MM, null for whole-day), `end_time` (HH:MM, null), `created_at`.

## Acceptance criteria
- [ ] `src/db/connection.ts` opens a better-sqlite3 DB at `DATABASE_PATH` (default `./data/scheduler.sqlite`), creating the parent dir if needed, with WAL mode and `PRAGMA foreign_keys = ON`.
- [ ] Schema is created idempotently on startup (`CREATE TABLE IF NOT EXISTS` or a migration runner) with the columns and FKs above (cascade deletes).
- [ ] `src/db/repo.ts` exposes typed functions and contains all SQL: `createEvent`, `getEvent`, `setEventMessageId`, `addParticipant`, `removeParticipant` (cascades their busy entries), `listParticipants`, `addBusyEntry`, `listBusyEntries(eventId, userId?)`, `removeBusyEntry`, `clearBusyEntries(eventId, userId)`, `deleteEvent`.
- [ ] Shared types `Event`, `Participant`, `BusyEntry`, `BusyKind` live in `src/domain/types.ts`, imported by both repo and engine. No discord.js types appear in `src/domain/`.
- [ ] Vitest tests run the repo against a temp/in-memory SQLite DB and cover: create+get event; set message id; add/list/remove participants; add/list/remove/clear busy entries; cascade (removing a participant clears their busy entries; deleting an event clears participants + busy entries).

## Constraints / non-goals
- Synchronous better-sqlite3 only; no ORM. No Discord/network code in this layer.

## Affected areas
- `src/db/connection.ts`, `src/db/schema.sql` (or `src/db/migrations/`), `src/db/repo.ts`
- `src/domain/types.ts`
- `test/repo.test.ts`

## Dependencies
- FEAT-foundation-1 (config, project, tooling).

## Open questions
- None.
