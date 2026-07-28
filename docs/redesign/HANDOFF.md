# Redesign hand-off — start here

Entry point for a new session picking up the FliP redesign. Rewritten
2026-07-25 (winds indicator, trust banner, target + flocking map
interactions); updated 2026-07-27 at the end of the DZ-discovery,
shortcuts and in-app-help session. The 2026-07-19 revision
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

Baseline on the branch: **649 tests, 0 lint errors, 47 known lint
warnings, build green, tree clean.** (`.claude/launch.json` is untracked
on purpose — it is the local dev-server config.)

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

### Session 2026-07-26 → 27 (this one)

Four things landed: DZ discovery (P6/F5), the leg-count fix (P9),
keyboard shortcuts, and the in-app help panel. NOTES has the reasoning
for each; the short version:

**DZ discovery (P6/F5)** — see the detail below.

**P9 — leg-count selector** hidden in Standard Pattern via a new
`patternLegCount` mode feature. The promotion to three legs is applied on
READ (`core/pattern.withFullPattern`), never written back, so a swooper's
stored two-leg choice survives a trip through the simple mode. The
pattern path moved from `useAppState` to App, which is the only place
that knows the mode.

**Target scope: place vs position** (owner report — "the DZ changes when
I switch modes"). Per-mode targets stay, but choosing a *place* (picker,
nearest-dropzone, loading a preset) now moves every mode via
`setTargetEverywhere`, which clears the per-mode overrides so even
never-opened modes follow. Dragging, shift-click and the heading input
stay per-mode.

**Winds re-fetch on a new place.** Moving beyond the 5 mi invalidation
threshold used to clear the winds and stop; the auto-fetch effect is now
keyed on where the winds were last fetched *for*, so it refetches. The
ref records the location last **attempted**, so a failing fetch cannot
spin.

**Keyboard shortcuts + `?` overlay.** `core/keymap.ts` is one table read
by both the handler (`hooks/useKeyboardShortcuts`) and the overlay
(`components/ShortcutsOverlay`), gated per mode, and it carries mouse
gestures with no keys so "how do I move the target" has an answer. `F`
hides everything but the map; `S` opens presets and 1-9 load one; `Esc`
steps back. The guard — ignore keys from inputs and from anything with
`role=menu|dialog|listbox` — is the feature, and it is what lets the
preset menu own the digits.

**Help panel** (`core/help.ts` + `components/HelpComponent`): topics as
DATA, one per panel plus How-it-works / Reading-the-map / Glossary /
Shortcuts / About. The `about` panel is gone; About is a topic and
`/about` redirects to `/help?topic=about`. Every panel header now has a
`?` deep-linking to its own topic. **The prose is placeholder** — see
"What's next".

### DZ discovery, in detail (P6/F5)

- **Dropzone data**: FWC's list ported in, 14 → 58 dropzones. The
  imported ones have ~100 m coordinates and no landing heading, so
  `Dropzone.direction` is now optional and a place with no heading lands
  **into wind** on select.
- **The place picker** (`components/PlacePicker.tsx` + pure
  `core/places.ts`): the three-tab Locations panel became one search box
  over one list — saved places first, then dropzones, then the geocoder's
  hits in the same list. Star a dropzone to save it (favorites are stored
  as *names*, so dropzone-data fixes reach them); custom places rename /
  move-to-current-target / delete in place.
- **Geolocation exists now** (`hooks/useGeolocation.ts`), opt-in behind
  "Nearest dropzone": nothing runs until it is tapped, and denial,
  timeout or no-geolocation-at-all all leave the picker fully usable.
- **Place search is a promise API** (`searchPlaceSuggestions` +
  `resolvePlaceSuggestion`) instead of the old attach-to-an-input widget,
  and it **loads the Maps API itself** — see NOTES: on mobile the panel
  replaces the map, so the geocoder used to be silently dead exactly
  where it mattered most.

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

**The immediate one: the help text.** `core/help.ts` has a topic per panel
with placeholder prose written by an agent from reading the code. The
structure is done and tested; the words are the owner's to write. Two
entries need his eye before anyone trusts them:

- **Courses** — the distance / zone-accuracy / speed descriptions were
  inferred from type names and geometry, not from how they are judged.
  Treat as unverified.
- **How FliP works** — this is the P1 teaching text. It should sound like
  the owner explaining it to a student, not like an agent's paraphrase.

Then, owner priorities most-ready first:

| Item | Notes |
|---|---|
| **Owner feedback on what shipped** | Place picker, shortcuts, focus map, help panel — all browser-verified, none used in anger |
| **P1's other half** | The Help topic gives dashed-vs-solid a home, but only for someone who goes looking. A legend or first-run pointer ON the map is still the higher-reach half |
| **Trust banner → help link** | The banner says "don't trust this"; "why?" has an answer now (`/help?topic=winds`) but nothing links to it. Small and obvious |
| **Flocking shortcuts** | Rotate jumprun, step the exit along it, cycle sub-mode, toggle a corridor by number. The keymap is ready for them |
| **Corridor direction ranges** | "anything 250–290°" — solver structure supports it, schema stores fixed headings. Small |
| **Per-DZ corridor presets** | Describe ZHills-style restrictions by name; ties into `util/dropzones.ts` |
| **Landing headings for the imported DZs** | 44 of 58 have ~100 m coordinates and no heading; promote them as they are checked against imagery |
| **UX-analysis items** | Remaining: mode-filtered Settings (P4), wind panel read-only-first (P3), course Type up front (P5), mobile panels page-swap the map (P7), jumprun handoff copy/share (P8) |
| **Trust state — finish it** | `◐`: out-of-bounds "silly value" call-out, stale-age tuning |
| **Nerd mode** | Owner-approved data-first mode; reframes the disabled `explore` stub |
| ⭐ **Shareable setup links** | Needs a *design session with the owner*; fragment-encoding proposal parked in BACKLOG |
| **Better wind visualization** | windy.com-like particle/flow rendering. ✎ design |
| **Phase 7 — documents & logbook** | Prerequisite for the backend tier and the whole Review pillar |
| **Flocking wishlist** | Reverse build, jump profiles (runback), groups/separation, handoff to landing pattern, reachability zones. `core/reach/` before the zones |

### Open design decisions from this session

- **`G` for the flocking panel** is the one awkward key: `F` went to
  focus-map (global, more guessable). One line of data in `core/keymap.ts`
  if the owner wants them swapped.
- **`?` opens the shortcuts overlay, not the Help panel.** Deliberate: the
  overlay floats over what you are doing, and `?` is useless without a
  keyboard anyway. Contextual entry is the per-panel `?` icon instead.
  Owner has not yet said whether he agrees.

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
- **A real geolocation grant** ("Nearest dropzone" in the Target panel).
  The permission prompt cannot be answered from automation, so only the
  denied and unavailable paths were exercised in a browser; the granted
  path is unit-tested only.
- **Keyboard shortcuts under a real keyboard.** Every binding was driven
  by synthetic `KeyboardEvent`s, which bypass focus: in particular the
  guard that ignores keys inside menus and dialogs was only exercised by
  unit test, because synthetic events dispatched on `window` never have a
  menu as their target. Worth one real pass: type in a numeric field and
  confirm nothing fires, open the preset menu and confirm 1-9 load
  presets without also switching mode.
- **Focus map (`F`) and the help `?` icons on a phone.** Verified at
  375px in the preview, not on a real handset.
- The **winds indicator hover** works via real DOM (not a marker), so it
  *was* verified — ground-station detail shows on GND-row hover.

## Owner decisions recorded this session

Recorded here because they were judgement calls, not deductions:

- Dropzone list: no distances in the picker results ("not useful"); keep
  Google Places rather than switching everything to Photon; no top-bar
  location chip (switching DZs is rare, the map already shows where you
  are); landing heading is not important — set it into wind when unknown.
- Panel shortcut keys are letters, not numbers. `Esc` behaviour was left
  to the agent's judgement (it is layered: leave focus map, else close the
  panel). The first-run "press ?" hint was wanted.
- Help absorbs About, and needs a reference entry for every panel's
  controls — "if a user doesn't understand a piece of UI they can find a
  reference" is the acceptance test for the content.

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
