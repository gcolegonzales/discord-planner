# 0001. Stack: discord.js + TypeScript + better-sqlite3

- Status: accepted
- Date: 2026-06-28

## Context
A pure-Discord bot that must run locally on Windows now and be deployable later, with non-trivial pure logic (availability math, timezone handling) that should be unit-tested.

## Decision
- **discord.js v14** for the Discord layer (mature, first-class slash commands / buttons / modals).
- **TypeScript (strict)**, compiled with `tsc`, dev via `tsx`.
- **better-sqlite3** for persistence: a single local file, synchronous API (simplest correct model for a single-process bot), prebuilt binaries on Windows.
- **luxon** for all date/timezone math.
- **vitest** for tests, **eslint** + **prettier** for quality.
- **npm** as package manager.

## Consequences
- Single-process, single SQLite file — no horizontal scaling / sharding (explicit non-goal). Deploying later means copying the file or pointing `DATABASE_PATH` at a mounted volume.
- better-sqlite3 is synchronous: DB calls block the event loop briefly — fine at this scale, keep queries simple and indexed.
- Pure logic must avoid discord.js imports to remain testable (enforced by the `src/domain/` boundary).
