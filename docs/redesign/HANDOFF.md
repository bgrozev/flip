# Redesign hand-off — start here

Entry point for a new session picking up the FliP redesign. Rewritten
2026-07-25, at the end of a long UX-iteration session (winds indicator,
trust banner, target + flocking map interactions). The 2026-07-19 revision
covered the architecture review, the wind-UX batch, and Phase 6 flocking.

## Read order

1. This file.
2. `ARCHITECTURE.md` — the target design + the phased migration plan.
3. `BACKLOG.md` — everything outstanding, by scope. Kept current; the
   **"UX analysis (2026-07-22)"** section near the top holds the newest
   prioritised items.
4. `docs/ux/pain-points.md` + `docs/ux/roles-and-tasks.md` — a walkthrough
   of the running app: prioritised friction (P1–P9) and a role/task
   inventory with the trust-state, accounts-sync, and Nerd-mode concerns.
5. `NOTES.md` — running log: per-phase history, owner Q&A, commit refs.
   Read for "why is it like this", not for "what's next".
6. `UIUX.md` — UX improvements + feature ideas, ⭐ = owner-prioritized.

`CLAUDE.md` (repo root) describes the codebase and is current as of this
hand-off (structure, core modules, wind layer, flocking, indicator/banner).

## Where things stand

Branch `claude/flip-redesign-architecture-e767df`, in a worktree at
`.claude/worktrees/flip-redesign-architecture-e767df`. **Nothing is
merged to main and nothing is deployed** — deliberate (see Hard rules).

Baseline on the branch: **554 tests, 0 lint errors, 47 known lint
warnings, build green, tree clean.**

Done: **Phases 0–6.** Phases 0–5 (Vite/Vitest/TS5 · core extraction ·
map layerization · router + modes · wind subsystem · PWA) plus a
MapLibre provider and all of Phase 6 (flocking) landed earlier — see the
2026-07-19 history in NOTES.md.

This UX-iteration session (2026-07-19 → 25) added, roughly in order:

- **Compact winds indicator** (`WindMiniIndicator`): a map-corner overlay,
  every mode, showing GND + plan-relevant altitude bands (5k ceiling for
  pattern, 15k+ for flocking) with Beaufort arrows, a header refresh, a
  collapse-to-chip, tap-to-open the Wind panel, and the ground-wind
  station/forecast detail on hover. Gated by the `displayMapWinds` setting.
- **Winds subsystem changes**: fetch every OpenMeteo level to ~41k ft (200
  hPa, FWC-equivalent); the Wind panel table shows all of it; the
  "wind altitude limit" setting is gone; winds auto-fetch once on load
  (which also warms the scrubber cache).
- **Wind-trust banner** (`WindTrustBanner` + pure `core/windTrust`): one
  top-of-map verdict — none / manual / stale / fresh — that unified the
  old flocking "no-wind" text and the top-bar "verify" badge; hidden when
  fresh, amber otherwise. Fixed a related bug: unlocking winds dropped the
  top-bar avg/gnd summary.
- **Target interaction rework**: the target is now always draggable in all
  modes (no "Edit on map" mode); hover reveals the heading-rotate handle;
  shift-click the map jumps the target. The old average-wind arrow and the
  target-anchored ground-wind arrow were removed (the ground readout moved
  to the indicator hover).
- **Flocking map interactions** — see below.
- **Removed the measure tool** (to be reimplemented — BACKLOG).
- **Docs**: ported the UX-analysis docs into `docs/ux/`.

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
solve and vanish from the map. Names are labelled on the map at each
corridor rectangle's far edge; corridor rows collapse (checkbox + verdict
stay visible). The spot readout on the map now includes the crosswind
offset. POM altitude labels thin out by zoom (max one per 1000 ft).

### Flocking map handles (this session — verify with a real pointer)

The drag-handle set was reworked and is the least-tested part.

- **Free**: exit (green) translates the run; a white handle at the jumprun
  *start* rotates the run about the exit; a cyan handle at the *end* of the
  canopy flight rotates the canopy about the exit (jumprun static); a
  magenta handle at the *middle* of the flight rotates the canopy about the
  *finish* (finish held, exit repositioned via `core/flocking.exitForFixedEnd`
  using the exact no-wind flight length so it doesn't drift).
- **Classic**: exit (green) translates everything (moves the target); the
  magenta middle-of-CF handle rotates about the target.
- Rotation handles are **`pinned`** (a `MapDragHandle` mode): they stay on
  their line and the drag only feeds the angle. The middle-of-CF handle
  anchors to the actual (wind-curved) path midpoint.
- Map handling during a handle drag: the camera never pans
  (`MapInteractions.setHandleDragging` suppresses the target-follow `panTo`;
  a per-handle centre-freeze also cancels Google's edge auto-pan). These
  were bug fixes this session (a stack overflow from the freeze, a marker
  left at the drop point, the camera chasing the target on the classic exit
  drag) — all fixed but **unverified by a real drag**.

### Two real bugs an earlier session found and fixed

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

Nothing is half-finished; pick from the backlog. **Read a real pointer over
the flocking/target map handles first** — much of the recent work can't be
auto-verified (see below). Then, owner priorities most-ready first:

| Item | Notes |
|---|---|
| **Owner feedback on what shipped** | The winds indicator, trust banner, target/flocking handle rework, ground-wind hover — all shipped this session, browser-verified only where a real pointer wasn't needed |
| **Corridor direction ranges** | "anything 250–290°" — the solver structure already supports it, the schema stores fixed headings. Small. |
| **Per-DZ corridor presets** | Describe ZHills-style restrictions by name; ties into `util/dropzones.ts` |
| **UX-analysis items** | `docs/ux/` + the BACKLOG "UX analysis" section: dashed-vs-solid legend (P1), DZ discovery/geolocation (P6), mode-filtered Settings (P4), hide leg-count in pattern (P9), jumprun handoff copy/share (P8) |
| **Trust state — finish it** | `◐` first version shipped; remaining: out-of-bounds "silly value" call-out, stale-age tuning |
| **Nerd mode** | Owner-approved data-first mode (manual/invert winds + export); reframes the disabled `explore` stub |
| ⭐ **Shareable setup links** | Still needs a *design session with the owner*; a fragment-encoding proposal is parked in BACKLOG |
| **Better wind visualization** | windy.com-like particle/flow rendering. ✎ design |
| **Phase 7 — documents & logbook** | The prerequisite for the backend tier and the whole Review pillar |
| **Flocking wishlist** | Reverse build, jump profiles (runback), groups/separation, handoff to landing pattern, reachability zones. `core/reach/` should be built before the zones. |

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
  pre-React value — await a tick. React derives `onMouseEnter/Leave` from
  `mouseover/out` — dispatch those, not `mouseenter`, to trigger hovers.
- **Google Maps imagery is flaky in the preview**: it greys out / doesn't
  fully initialise on rapid reloads (referrer/key sandboxing). The vector
  overlays (paths, handles, markers) still render on the grey background,
  so most checks work; if `.gm-style` isn't found, wait and retry, or read
  the overlays regardless. The **fullscreen control was moved to
  bottom-right** but couldn't be visually confirmed for this reason.
- **Service worker only exists in a production build** — verify PWA
  behavior via `npm run build && npm run preview`.

## Never exercised by a real pointer

Everything below works by unit test and by DOM inspection, but automated
drags cannot drive them (Google-marker drags/hover don't reach the
handlers here). This is the **top verification priority** — a lot of this
session's work is drag-shaped. Ask the owner to try, or verify another way:

- **All flocking map handles** (the reworked set above): exit-translate,
  jumprun-rotate (at the run start), end-of-CF and middle-of-CF canopy
  rotates, in both free and classic. Confirm: rotation handles stay pinned
  on their line (no flicker), the free finish doesn't drift across repeated
  middle-handle rotations, the classic exit translates everything, and the
  camera never scrolls while dragging any handle.
- **Target handle** (all modes): drag to move, hover to reveal the
  heading-rotate handle, shift-click the map to jump it. The map must stay
  put while dragging.
- The **Spot Reference** drag (dragging pins it).
- The **winds indicator hover** works via real DOM (not a marker), so it
  *was* verified — ground-station detail shows on GND-row hover.

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
