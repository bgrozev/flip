# Redesign hand-off — start here

Entry point for a new session picking up the FliP redesign. Rewritten
2026-07-19, at the end of the session that did the architecture review,
the wind-UX batch, and all of Phase 6 (flocking).

## Read order

1. This file.
2. `ARCHITECTURE.md` — the target design + the phased migration plan.
3. `BACKLOG.md` — everything outstanding, by scope. Kept current; the
   flocking entry and the "Architecture-review follow-ups" section are
   the two that moved most recently.
4. `NOTES.md` — running log: per-phase history, owner Q&A, commit refs.
   Read for "why is it like this", not for "what's next".
5. `UIUX.md` — UX improvements + feature ideas, ⭐ = owner-prioritized.

`CLAUDE.md` (repo root) describes the codebase and is current as of this
hand-off (structure, core modules, wind layer, flocking).

## Where things stand

Branch `claude/flip-redesign-architecture-e767df`, in a worktree at
`.claude/worktrees/flip-redesign-architecture-e767df`. **Nothing is
merged to main and nothing is deployed** — deliberate (see Hard rules).

Baseline on the branch: **541 tests, 0 lint errors, 50 known lint
warnings, build green, tree clean.**

Done: **Phases 0–6.** Phases 0–5 (Vite/Vitest/TS5 · core extraction ·
map layerization · router + modes · wind subsystem · PWA) plus a
MapLibre provider landed earlier. This session added:

- **Architecture review** of the whole branch, and all its follow-ups:
  an app-wide error surface (snackbar) that no longer wipes the wind
  table on a failed fetch, a `useWinds` facade out of App.tsx, the last
  pure modules moved into `core/`, the first React Testing Library
  tests, explicit touched-settings tracking (fixing a real trap where a
  mode default could not be overridden back to the global default), and
  dead-code removal. Only two items were deliberately deferred:
  track-scale path rendering (Phase 7) and the OpenMeteo prefetch
  singleton (accepted as-is).
- **Owner quick items**: jump-to-course, map tooltip contrast, per-row
  wind source badges, ground speed in the point hover, cumulative turn
  ("degrees rotated") in the manoeuvre hover.
- **Wind UX**: winds persist across reloads with a staleness indicator,
  an hour scrubber over the prefetched window, and a first-pass
  model/sounding comparison view.
- **Phase 6 — flocking**, ported from the owner's Flocking Wind
  Calculator and then iterated heavily with the owner. See below.

### Flocking, in its current shape

Three sub-modes in one panel (see CLAUDE.md for the module map):
**classic** (FWC parity), **free** (you place the jumprun, exit and
canopy direction), **solve** (describe corridors, the app picks).

The solver is analytic, not brute force: per canopy-direction sample the
best exit is the clamped projection of `target − Δ` onto the corridor
rectangle, and the canopy arc is sampled at 0.5° centre-outward. Its
*selection rule* matters as much as its math — misses are tiered by the
green/yellow rings, and corridors that both reach green are separated by
which run is most into the wind. That was the fix for a real complaint:
scrubbing the forecast used to flip the answer between a north and a
south corridor on noise. A brute-force oracle test guards the math; a
13-point wind sweep guards the stability.

Corridors are nameable and individually enable-able ("North / South /
East", untick East at ZHills). Disabled ones stay configured, leave the
solve and vanish from the map.

### Two real bugs this session found and fixed

- **`addWind` curved paths.** Drift was accumulated in polar form
  (distance + a bearing re-derived spherically each step); the bearing
  wandered a fraction of a degree, which was invisible normally but
  amplified into ~14° of curvature when the drift nearly cancels the
  flown line (flocking straight into a strong wind). Now a flat
  east/north vector sum; a regression test pins uniform wind to < 0.05°
  of bearing spread. Golden values shifted sub-foot.
- **FWC's left/right flag inverts for PAST exits.** Its formula expands
  to `along × side`, so the reported side flips with prior/past even
  though the exit never changes sides of the line. FliP now reports the
  geometric side always. **The same bug is still live in FWC itself** —
  worth fixing upstream (owner's call).

## What's next

Nothing is half-finished; pick from the backlog. The owner's own
priorities, most-ready first:

| Item | Notes |
|---|---|
| **Owner feedback on what shipped** | Side-profile sketch (verdict never given), the model/sounding comparison view (explicitly a first pass), and solve mode generally |
| **Corridor direction ranges** | "anything 250–290°" — the solver structure already supports it, the schema stores fixed headings. Small. |
| **Per-DZ corridor presets** | Describe ZHills-style restrictions by name; ties into `util/dropzones.ts` |
| **Better wind visualization** | Owner request: windy.com-like particle/flow rendering. ✎ design |
| ⭐ **Shareable setup links** | Still needs a *design session with the owner*; open questions parked in BACKLOG. A fragment-encoding proposal is recorded there. |
| **Phase 7 — documents & logbook** | The prerequisite for the backend tier and the whole Review pillar |
| **Flocking wishlist** | Reverse build, jump profiles (runback), groups/separation, handoff to landing pattern, reachability zones. Owner: needs their input, and `core/reach/` should be built before the zones. |

## Hard rules (these come from the owner — do not relax them)

- **Never push, deploy, or merge.** Local commits only.
- **Never deploy or prepare deployment for flip-next.mustelinae.net**
  unless the owner explicitly asks in that conversation.
- **Never force-push.**
- Dependency changes need a reason and are approved case-by-case. MUI is
  pinned at 7 while Toolpad is in use; `socket.io-client` stays 2.5.0
  (Spaceland speaks the v2 protocol). RTL + jsdom were added for tests.

## Working agreements that earned their keep

- **Commit every green slice immediately.** Agents on this branch have
  repeatedly been killed by API session limits and outages; the ones that
  committed per slice lost nothing. Keep `npm test`, `npm run lint`
  (0 errors, ≤ 50 warnings) and `npm run build` green per commit, and
  note in the body what was browser-verified.
- **Tests lead refactors** — pin current behavior before moving code.
- **Verify before building.** Every external dependency is checked
  against the real thing first (CORS, that a URL resolves, that a claim
  about a station is true).
- **Don't fix a phantom, and don't trust a green automated check
  blindly.** Two examples from this session: a "bug" that was really the
  automation clicking the wrong thing, and — more instructive — a
  browser check that *appeared* to confirm a fix but proved nothing,
  because automated map clicks never reach the Maps handler at all. The
  way that was caught: re-run the same check against the pre-change code
  and see whether it behaves identically. If it does, the check is
  worthless. Prefer a unit test of the actual contract.
- **`core/` may not import React, components, hooks, I/O or map code**,
  and `src/map/layers|components` may never import a concrete map
  provider. Both rules are currently clean — keep them so.

## Environment gotchas

- **Dev server**: use the `flip-dev` launch config (`.claude/launch.json`,
  untracked). Port 3000 is usually taken by the owner's own server;
  `autoPort` handles it. `.env` holds `VITE_GOOGLE_MAPS_API_KEY`.
- **One driver at a time.** Don't drive the browser or the worktree while
  an agent is working in it. A stray `npm test` launched in the *main*
  repo (not the worktree) hangs forever — that's the old CRA jest
  watcher; the worktree's `npm test` is Vitest and exits.
- **Browser automation limits, measured:** coordinate clicks frequently
  do not reach the Google Maps click handler; synthetic drags do not
  drive the map drag handles; wheel-zoom can hang the tooling;
  `read_page` sometimes reports a 0x0 viewport on panel routes. DOM
  queries, `javascript_tool` and screenshots are reliable. Reading
  values back synchronously after dispatching an input event shows the
  pre-React value — await a tick.
- **Service worker only exists in a production build** — verify PWA
  behavior via `npm run build && npm run preview`.

## Never exercised by a real pointer

Everything below works by unit test and by DOM inspection, but automated
drags cannot drive them. Ask the owner to try, or verify another way:

- Flocking free mode: the jumprun **move** handle (2-D), the **rotate**
  handle, and the canopy-rotate handle at the flight's end.
- The **Spot Reference** drag (dragging pins it).
- The flocking target drag (click-to-move is deliberately off there).

## Open questions for the owner

- Higher-res PWA icons (current ones are the pixel-art logo upscaled).
- "Initiation altitude not saved?" — could not reproduce; needs a repro
  or closure.
- Default pattern params: backlog says "3:1 glide, 8 kts descent" but the
  current default is 9 **mph** — the unit is ambiguous, unresolved.
- Should FWC itself get the PAST left/right fix?
- Should presets (and later share-links) snapshot `flockingParams` too?
  They currently do not.
- Improved KMZ export, preset UX, course stats, distance-course marker
  spacing, "wind code" — all need the owner's intent.
- Observability tool choice (replacing Google Analytics).
