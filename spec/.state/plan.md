# Build plan — Discord Scheduler (all, tier: local-tool)

**Summary:** 14 tasks · 7 waves · models: 12 sonnet / 2 opus · max parallel width 3
**Spec lock:** `git:2cb8bbc+clean` — `/spec-build` will refuse to run if `spec/` changes before approval.

## Risks & gaps
- ⚠ **T-002 must implement the interaction router as directory-scan auto-discovery** (commands in `src/interactions/commands/*`, buttons by customId prefix in `src/interactions/buttons/*`). This is what keeps all later command/button tasks (T-007/08/09/10/13/14) file-disjoint — without it they'd collide on a shared registry/`deploy-commands.ts`.
- ⚠ **T-006 deliberately consolidates all validators** (event + date-range + time-range) so T-007/T-009/T-010 import rather than edit `validate.ts` — avoids a shared-file conflict across waves.
- Handler tasks (commands/buttons/ui) carry no unit tests by design; their acceptance criteria are **runtime/UI** and get verified in **Phase 2** by driving the bot in a dev guild (needs `DISCORD_TOKEN` + `DEV_GUILD_ID`). Pure logic (config, repo, validate, slots, matching, customId, results-format) is unit-tested.
- **Tier = local-tool** ⇒ Phase-3 gates are dependency audit + secret scan only (no security/perf-review tasks). Authorization is enforced in-handler (acting user always `interaction.user.id`, never a client value) and confirmed in Phase 2.

## Wave 1
- **T-001** · sonnet · FEAT-foundation-1 — Scaffold project, tooling & config · verify: build, typecheck, test config, lint

## Wave 2 (parallel ×3)
- **T-002** · sonnet · FEAT-foundation-1 — Bot bootstrap, router (directory-scan) & deploy (deps: T-001)
- **T-003** · sonnet · FEAT-foundation-2 — SQLite persistence layer & domain types (deps: T-001)
- **T-006** · sonnet · FEAT-event-lifecycle-1 — Pure validation module (deps: T-001)

## Wave 3 (parallel ×2)
- **T-004** · sonnet · FEAT-event-lifecycle-2 — customId encode/decode helpers (deps: T-002)
- **T-011** · **opus** · FEAT-availability-engine-1 — Slot grid (tz/DST-safe) (deps: T-003)

## Wave 4 (parallel ×2)
- **T-005** · sonnet · FEAT-event-lifecycle-2 — Event message embed + buttons + update (deps: T-003, T-004)
- **T-012** · **opus** · FEAT-availability-engine-2 — Matching & ranking engine (deps: T-011)

## Wave 5 (parallel ×3)
- **T-007** · sonnet · FEAT-event-lifecycle-1 — /plan create-event command (deps: T-002, T-003, T-005, T-006)
- **T-008** · sonnet · FEAT-event-lifecycle-3 — Participation buttons Accept/Leave (deps: T-003, T-004, T-005)
- **T-014** · sonnet · FEAT-availability-engine-3 — Results display + refresh (deps: T-005, T-012)

## Wave 6 (parallel ×2)
- **T-009** · sonnet · FEAT-availability-input-1 — Busy dates & ranges input (deps: T-003, T-006, T-014)
- **T-010** · sonnet · FEAT-availability-input-2 — Busy time ranges input (deps: T-003, T-006, T-014)

## Wave 7
- **T-013** · sonnet · FEAT-availability-input-3 — Manage my busy times (deps: T-009, T-010, T-014)

---
Review this plan. When you approve, run `/spec-build` to execute it autonomously (build → run in a dev guild → harden), and it'll alert you when it's ready.
