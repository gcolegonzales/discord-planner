# Discord Scheduler

A pure-Discord availability-planning bot. Members answer a single slash command, submit their busy times via buttons/modals, and the bot replies with ranked meeting windows.

## Setup

1. Copy `.env.example` to `.env` and fill in your values:
   - `DISCORD_TOKEN` — your Discord bot token (required)
   - `DISCORD_CLIENT_ID` — your application's client ID (required)
   - `DEFAULT_TIMEZONE` — IANA timezone, e.g. `America/New_York` (required)
   - `DEV_GUILD_ID` — guild ID for instant command registration in dev (optional)
   - `DATABASE_PATH` — path to SQLite file, default `./data/scheduler.sqlite` (optional)
   - `MAX_EVENT_DAYS` — scheduling horizon in days, default `31` (optional)
   - `MAX_RESULT_WINDOWS` — top N windows to show, default `5` (optional)

2. Install dependencies:

   ```sh
   npm install
   ```

3. Register slash commands:

   ```sh
   npm run deploy
   ```

4. Start the bot:
   ```sh
   # Development (watch mode)
   npm run dev

   # Production (after build)
   npm run build
   npm start
   ```

## Development

```sh
npm run build      # Compile TypeScript
npm run typecheck  # Type-check without emitting
npm test           # Run vitest unit tests
npm run lint       # ESLint
npm run format     # Prettier
```

## Architecture

- `src/config.ts` — env loading and validation (fails fast with named variable on error)
- `src/index.ts` — Discord client bootstrap and interaction routing
- `src/interactions/` — interaction router and handler registry
- `src/domain/` — pure scheduling logic (no discord.js imports)
- `src/db/` — better-sqlite3 data access layer
- `src/ui/` — embed and message builders
- `src/deploy-commands.ts` — slash command registration script
- `test/` — vitest unit tests
