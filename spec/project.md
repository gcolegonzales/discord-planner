# Project profile

## Stack
- **Runtime:** Node.js 20+ (LTS), Windows-friendly (no native build steps beyond better-sqlite3's prebuilt binaries).
- **Language:** TypeScript (strict).
- **Discord:** discord.js v14 (slash commands, buttons, modals, embeds).
- **Persistence:** better-sqlite3 (single local `.sqlite` file, synchronous API).
- **Dates/timezones:** luxon (IANA timezone math, DST-safe).
- **Config:** dotenv (`.env` for `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DEFAULT_TIMEZONE`, optional `DEV_GUILD_ID`, `DATABASE_PATH`).
- **Test:** vitest. **Lint:** eslint (+ `@typescript-eslint`). **Format:** prettier.

## Package manager
- npm (committed `package-lock.json`).

## Scale tier
- **`local-tool`** — a personal/community Discord bot run locally as a single process serving a small set of guilds. Single-process + single-file SQLite is appropriate at this tier; multi-tenant/horizontal-scale stack expectations do not apply. NFR gates for this tier = **dependency audit + secret scan** (the heavier authz/SAST/perf gates are not required). If this ever grows toward a hosted multi-guild service, bump the tier to `internal`/`production-multitenant` and re-plan (Postgres, stateless processes, per-guild isolation, the fuller gate set).

## Security & scale gates  (run by /spec-build Phase 3 for the local-tool tier)
| Purpose          | Command                          |
|------------------|----------------------------------|
| dependency audit | `npm audit --audit-level=high`   |
| secret scan      | scan the tree for committed secrets; ensure `.env` is gitignored and only `.env.example` (names, no values) is committed |

## Commands  (the build gate runs these — keep exact)
| Purpose    | Command                  |
|------------|--------------------------|
| install    | `npm install`            |
| dev        | `npm run dev`            |
| build      | `npm run build`          |
| typecheck  | `npm run typecheck`      |
| test       | `npm test`               |
| lint       | `npm run lint`           |
| format     | `npm run format`         |
| run/start  | `npm start`              |

- `build` = `tsc -p tsconfig.json` (emits to `dist/`).
- `typecheck` = `tsc -p tsconfig.json --noEmit`.
- `dev` = `tsx watch src/index.ts` (or `node --watch` via tsx).
- `test` = `vitest run`.
- `lint` = `eslint . --ext .ts`.
- `format` = `prettier --write .`.
- `start` = `node dist/index.js` (after `build`); `npm run dev` for watch mode.

## Run & smoke-verify  (how /spec-build Phase 2 launches and checks the running app)
- **Run command:** `npm run dev` (or `npm start`) — boots the bot and logs it into Discord.
- **Surface:** a Discord bot, not a web URL. Drive it in a **dev/test guild** (`DEV_GUILD_ID`, where slash commands register instantly). Exercise the full flow: `/plan` to create an event → click **Accept** → **Set busy times** (submit a single date, a date range, and a time range) → **Results**, and confirm the ranked windows respect the 10:00 earliest-start and 10:00–24:00 window.
- **Required env/secrets:** `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DEV_GUILD_ID`, `DEFAULT_TIMEZONE` (and optional `DATABASE_PATH`) in `.env`. The user supplies the token. If the token is absent in the build environment, Phase 2 stops and asks for it rather than faking the check.
- **"Working" looks like:** process starts with no unhandled exceptions, logs "logged in as <bot>", slash commands register in the dev guild, and the create→accept→busy→results flow produces a correct ranked heatmap with no error logs. The pure availability/timezone logic is additionally covered by `vitest` and need not be re-verified live.

## Definition of Done
A task is done only when `npm run build` (and `npm run typecheck`), the relevant `vitest` tests, and `npm run lint` all pass. Pure-logic features (slot model, matching engine, date parsing, timezone math) **must** ship with unit tests — they are the core and are testable without a live Discord connection. The **build as a whole** is done only when, additionally, the bot runs and the full create→accept→busy→results flow works live in the dev guild (verified in `/spec-build` Phase 2).

## Conventions
- TypeScript strict mode; no `any` in committed code (use precise types / `unknown` + narrowing).
- Separate **pure logic** from **Discord I/O**: availability math, date/range parsing, and ranking live in plain modules with no discord.js imports, so they're unit-testable. Discord handlers are thin adapters over that logic + the data layer.
- All persistence goes through a single data-access module; no raw SQL scattered in handlers.
- All user-facing times computed via luxon in the event's timezone; never use the host system's local time for logic.
- Conventional, small modules; one slash command / button handler per file under `src/interactions/`.

## Directory map (intended)
- `src/index.ts` — bot bootstrap: client login, interaction routing, command registration on startup.
- `src/config.ts` — env loading + validation.
- `src/db/` — better-sqlite3 connection, schema/migrations, and the data-access layer (events, participants, busy entries).
- `src/domain/` — **pure** logic: types, date/range parsing & validation, slot grid, availability matching & ranking. No discord.js here.
- `src/interactions/` — slash command builders + button/modal handlers (thin adapters).
- `src/ui/` — embed/message builders (formatting results, event message, heatmap bar).
- `src/deploy-commands.ts` — registers slash commands (guild-scoped in dev via `DEV_GUILD_ID`, global in prod).
- `test/` — vitest unit tests, focused on `src/domain/`.

## Notes for agents
- **Do not commit secrets.** `.env` is gitignored; provide `.env.example` with the variable names only.
- Keep `src/domain/` free of any discord.js / network imports so it stays unit-testable and deterministic.
- Discord interaction rules: acknowledge within 3 seconds (`deferReply`/`deferUpdate` if work may be slow); modals allow at most 5 text inputs; embeds have field-count/length limits — page or summarize long output.
- Timezone correctness is a core risk: always construct/compare instants in the event's IANA zone via luxon `DateTime.fromObject(..., { zone })`; account for DST (a "day" may not be exactly 24h). Cover with tests.
- The 10:00 earliest-start and 10:00–24:00 daily window are fixed rules — centralize them as named constants in `src/domain/`.
