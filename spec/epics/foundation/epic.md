---
id: EPIC-foundation
title: Foundation — project scaffold & persistence
status: ready
---

## Intent
Stand up the runnable skeleton everything else builds on: a TypeScript + discord.js project with the full tooling/verify gate, config loading, a bot that logs in and routes interactions, slash-command registration, and the SQLite data layer with the event/participant/busy-entry schema. After this epic the bot connects and the build/test/lint/run commands in `project.md` all work, even though no scheduling behavior exists yet.

## Features
- `FEAT-foundation-1` — Project scaffold, config, bot bootstrap & command registration
- `FEAT-foundation-2` — SQLite persistence layer & data model
