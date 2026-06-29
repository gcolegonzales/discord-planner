---
id: FEAT-availability-engine-3
title: Results display (ranked windows + heatmap, live refresh)
epic: availability-engine
status: ready
depends_on: [FEAT-availability-engine-2, FEAT-event-lifecycle-2, FEAT-availability-input-1, FEAT-availability-input-2]
model_hint: sonnet
---

## Summary
Render the engine's output in Discord: a ranked list of the best windows plus a compact per-day availability heatmap bar, shown via the Results button / `/results`, and refreshed automatically whenever availability changes.

## User stories
- As a participant, I want to see, at a glance, the best times for everyone and how each day looks.

## Acceptance criteria
- [ ] `src/ui/results.ts` renders an embed containing: a ranked list of the top windows (e.g. "**Tue Jul 1** · 2:00–5:00 PM · ✅ all 5 free" and near-misses like "4/5 free — missing @user"), and a compact **per-day availability bar** built from `perDay` free counts using block/emoji glyphs, with a small legend.
- [ ] All times/dates render in the **event timezone**, with weekday + date and a consistent clock format.
- [ ] The **Results** button (`evt:results:<id>`) and `/results <event>` compute via FEAT-availability-engine-2 from current data and show the embed (ephemeral, to avoid channel spam).
- [ ] A `refreshResults(event)` function recomputes and is invoked by the input features whenever availability changes (it may update a pinned results section or be on-demand — at minimum the next Results view reflects the latest data).
- [ ] Empty/edge states: no participants → "No participants yet."; participants but no all-free window → still list the best near-misses (top `MAX_RESULT_WINDOWS`) with their free counts, never an empty result when any slot has ≥1 free.
- [ ] Output respects Discord embed field/length limits (trim to `MAX_RESULT_WINDOWS`; the heatmap stays within limits for a 31-day event).

## Constraints / non-goals
- Text/embed rendering only — no image generation in v1 (a documented later option).

## Affected areas
- `src/ui/results.ts`, `src/interactions/buttons/results.ts`, `src/interactions/commands/results.ts`
- `test/` for any pure formatting helpers (e.g. window→string, heatmap glyph mapping)

## Dependencies
- FEAT-availability-engine-2 (windows + perDay), FEAT-event-lifecycle-2 (message/UI), FEAT-availability-input-1/2 (data + refresh hook).

## Open questions
- None.
