---
id: FEAT-foundation-1
title: Project scaffold, config, bot bootstrap & command registration
epic: foundation
status: ready
depends_on: []
model_hint: sonnet
---

## Summary
Stand up the TypeScript + discord.js v14 project with the complete tooling/verify gate, environment config loading + validation, a Discord client that logs in and routes interactions, and slash-command registration. This is the runnable skeleton; no scheduling behavior yet.

## User stories
- As a developer, I want the build/typecheck/test/lint/run commands wired from task one so the build gate and Phase 2 verification work.
- As an operator, I want missing/invalid config to fail fast with a message that names the bad variable.

## Acceptance criteria
- [ ] `npm install` succeeds and `npm run build`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run format` all exist and exit 0 on the bare scaffold.
- [ ] `src/config.ts` loads env via dotenv and validates required vars `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DEFAULT_TIMEZONE` (and optional `DEV_GUILD_ID`, `DATABASE_PATH`, `MAX_EVENT_DAYS`, `MAX_RESULT_WINDOWS`); a missing/invalid var throws an error that names it. `DEFAULT_TIMEZONE` is validated as a real IANA zone via luxon. Covered by a unit test that injects env and asserts throw vs success.
- [ ] `.env.example` lists every variable (names only, no secrets); `.gitignore` excludes `node_modules`, `dist`, `.env`, and the SQLite file/dir.
- [ ] `src/index.ts` constructs a discord.js v14 `Client` with the minimal intents for slash commands, logs in with `DISCORD_TOKEN`, and on `ready` logs `logged in as <tag>`.
- [ ] An interaction router under `src/interactions/` dispatches chat-input command, button, and modal-submit interactions to registered handler modules (registry keyed by command name / customId prefix); unknown interactions are ignored without crashing.
- [ ] `src/deploy-commands.ts` registers the slash commands with Discord: guild-scoped when `DEV_GUILD_ID` is set (instant), else global. Exposed as `npm run deploy`.
- [ ] `npm start` = `node dist/index.js`; `npm run dev` = watch via tsx. Started with no `DISCORD_TOKEN`, the process exits with the config error (handled), not an unhandled rejection.

## Constraints / non-goals
- No domain/scheduling logic and no DB schema here (DB is FEAT-foundation-2). Leave a clear seam for them.
- TypeScript strict; no `any` in committed code.

## Affected areas
- `package.json`, `tsconfig.json`, `.eslintrc.*`, `.prettierrc`, `vitest.config.ts`, `.gitignore`, `.env.example`, `README.md`
- `src/index.ts`, `src/config.ts`, `src/interactions/` (router + registry + index), `src/deploy-commands.ts`
- `test/config.test.ts`

## Dependencies
- None.

## Open questions
- None.
