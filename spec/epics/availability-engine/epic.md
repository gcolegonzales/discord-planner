---
id: EPIC-availability-engine
title: Availability engine — compute & display matching windows
status: ready
---

## Intent
The core value: turn participants' busy entries into the best times to meet. A pure, unit-tested slot grid + matching/ranking engine (timezone- and DST-correct, 10:00–24:00 window, 30-min slots, most-available-first heatmap ranking), and the Discord display that renders ranked windows + a per-day availability bar and keeps them current as people update availability.

## Features
- `FEAT-availability-engine-1` — Slot grid (pure, timezone/DST-safe)
- `FEAT-availability-engine-2` — Matching & ranking engine (pure)
- `FEAT-availability-engine-3` — Results display (ranked windows + heatmap, live refresh)
