# Redesign hand-off — start here

Entry point for a new session picking up the FliP redesign. Written
2026-07-16, at the end of the session that did Phases 0–5.

## Read order

1. This file.
2. `ARCHITECTURE.md` — the target design + the phased migration plan. The
   phase numbering below refers to it.
3. `BACKLOG.md` — everything outstanding, by scope. It is **current**: a
   hygiene pass marked the ~12 items Phases 1–5 had silently delivered.
4. `NOTES.md` — running log: per-phase history, owner Q&A, commit refs.
   Read for "why is it like this", not for "what's next".
5. `UIUX.md` — UX improvements + feature ideas, ⭐ = owner-prioritized.

`CLAUDE.md` (repo root) describes the codebase itself and is current.

## Where things stand

Branch `claude/flip-redesign-architecture-e767df`, in a worktree at
`.claude/worktrees/flip-redesign-architecture-e767df`. **Nothing is merged
to main and nothing is deployed** — that is deliberate (see Hard rules).

Done: **Phases 0–5** (Vite/Vitest/TS5 · core extraction + correctness ·
map layerization · router + modes · wind subsystem · PWA), plus a
**MapLibre provider** switchable in Settings, plus a batch of backlog
bugs/polish. Baseline on the branch: **369 tests, 0 lint errors, ~50 lint
warnings, build green, tree clean.**

The lint warnings are a deliberate, known list (eqeqeq, no-explicit-any,
exhaustive-deps…) left from Phase 0 — don't treat them as new breakage, but
don't add to them either.

## What's next

Remaining from the last agreed list (owner asked for these five):

| # | Item | Notes |
|---|---|---|
| 10 | **Jump to course** — pan/zoom map to the selected course | Built-in courses are geographically anchored (e.g. Skydive Arizona), so selecting one far from the target renders nothing visible. Logged twice (Phase-2 + Phase-3 follow-ups) — closes both. |
| 13 | **Leg tooltip contrast** on the dark map theme | Body rows are low-contrast; header/coords are fine. |
| 19 | **Per-row source indication** in the wind table | Rows carry `source` metadata since Phase 4 but it is not shown; the ground row injected from an observed station is indistinguishable from forecast rows. ARCHITECTURE §2 asked for this. |
| 14 | **Ground speed in the point hover popup** | Deferred twice, honestly: the map tooltip only receives an *altitude* formatter, so this needs the user's speed-unit formatter threaded in, or it will ignore the unit setting. |
| 15 | **"Degrees rotated"** (cumulative turn) in manoeuvre hover | Wants a cumulative-turn calc in `core/` with tests, then surfaced in the tooltip. |

Then the bigger forks, owner's choice: **Phase 6 (flocking mode)** or
**Phase 7 (logbook / Plan documents)**. Phase 7 is the prerequisite for the
backend tier (Phase 8) and the whole Review pillar; Phase 6 is the one with
the most owner enthusiasm and its mode stub already exists.

⭐ **Shareable setup links** is owner-prioritized and still needs a *design
session with the owner* before coding — the open questions are parked in
BACKLOG ("Shareable setup links"). `?mode=` already works as a seed.

## Hard rules (these come from the owner — do not relax them)

- **Never push, deploy, or merge.** Local commits only.
- **Never deploy or prepare deployment for flip-next.mustelinae.net** unless
  the owner explicitly asks in that conversation. (Also stored in memory.)
- **Never force-push.**
- Dependency changes need a reason and are approved case-by-case. MUI is
  pinned at 7 while Toolpad is in use; `socket.io-client` stays 2.5.0
  (Spaceland speaks the v2 protocol).

## Working agreements that earned their keep

- **Commit every green slice immediately.** Agents on this branch were
  repeatedly killed mid-task by API session limits and tooling outages;
  the ones that committed per slice lost nothing, the one that batched lost
  everything. Keep `npm test`, `npm run lint`, `npm run build` green per
  commit and note in the commit body what was browser-verified.
- **Tests lead refactors** — pin current behavior before moving code.
- **Verify before building.** Every external dependency in this app is
  checked against the real thing first: CORS for a new data source, that a
  URL actually resolves, that a claim about a station is true. Three
  sounding-link URLs 404'd before the right one was found; a "dead" helper
  turned out to be live. Don't trust a note — including a note in these
  docs — over the code or the network.
- **Don't fix a phantom.** One "bug" here was retracted after it turned out
  to be my own probe bypassing the app's clamps; another was an automation
  click missing a button. Reproduce through the real UI before fixing.
- **`core/` may not import React, components, hooks, I/O or map code**, and
  `src/map/layers|components` may never import a concrete map provider
  (`google.maps` lives only in `src/map/google/`, `maplibre-gl` only in
  `src/map/maplibre/`). Both rules are currently clean — keep them so.

## Environment gotchas

- **Dev server**: use the `flip-dev` launch config (`.claude/launch.json`,
  untracked). Port 3000 is usually taken by the owner's own server;
  `autoPort` handles it. `.env` in the worktree holds
  `VITE_GOOGLE_MAPS_API_KEY` (gitignored; note the `VITE_` prefix — Phase 0
  renamed it from `REACT_APP_`).
- **Service worker only exists in a production build** — verify PWA
  behavior via `npm run build && npm run preview`, not the dev server.
- **Browser automation is flaky here**: coordinate clicks frequently miss
  (use `read_page` refs, or dispatch the click via `javascript_tool`);
  `read_page` sometimes reports a 0x0 viewport on panel routes; number
  inputs do not expose `selectionStart`; MapLibre's wheel-zoom hung the
  automation once. These are tooling artifacts — do not mistake them for
  app bugs (I did, twice).
- **One driver at a time.** Don't drive the browser/worktree while an agent
  is working in it — doing so produced a confusing "crash" that was really
  the agent's in-flight HMR state.

## Decisions already made (don't re-litigate)

- **Coaching is not a mode** — a coach is a user switching between many
  presets. Modes: pattern, swoop (live); flocking, explore (stubs).
- **Drift angle**, not crab angle (owner's call). The wind-drift tooltip
  line was renamed "Wind drift:" to avoid two "Drift" meanings.
- **Default map provider stays Google.** MapLibre is opt-in.
- **Google map tiles are deliberately not cached** (their ToS) — offline
  tiles are the MapLibre follow-up.
- **Toolpad kept** — it integrates fine behind a small router adapter.
  Replacing it stays optional.
- **`flip.location.tab` deliberately stays an unversioned plain string** —
  wrapping it would reset every existing user's tab.
- Manoeuvre `offsetXFt` = 0 uses a 0.01 ft epsilon segment because
  `setFinalHeading` needs two distinct points; negative = opposite side.

## Open questions for the owner

- Higher-res PWA icons (current ones are the pixel-art logo upscaled).
- "Initiation altitude not saved?" — could not reproduce; needs a concrete
  repro or closure.
- Default pattern params: backlog says "3:1 glide, 8 kts descent" but the
  current default is 9 **mph** — the unit is ambiguous, unresolved.
- Improved KMZ export, preset UX, course stats, distance-course marker
  spacing, "wind code" — all need the owner's intent.
- Observability tool choice (replacing Google Analytics).
