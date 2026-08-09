# FliP Next-Generation Redesign — Working Notes

> **New session? Read `HANDOFF.md` first.** This file is the running log —
> per-phase history and owner Q&A, kept for "why is it like this". It is
> append-only and the status blocks below are historical, newest last.

Branch: `claude/flip-redesign-architecture-e767df`

## History

Status: **Phase 4 complete** (2026-07-15, commits `0694842`, `c7d3776`,
`99f6313`, `186c555`, `59fb9ec`): `src/data/wind/` WindSource plugin layer
replaces `src/forecast/`; elevation cache; multi-hour prefetch with local
hour switching; OpenMeteo model info + selection (best_match/GFS/ICON/ECMWF,
all CORS-verified); NWS station auto-discovery by location (de-couples
ground wind from dropzones); radiosonde soundings source (IEM RAOB,
CORS-verified). 331 tests, 0 lint errors / 49 warnings. Independently
spot-checked in-browser: fetch returns 19 rows with per-row source tags,
cached elevation, real Date validTime, both aloft sources registered.
(Past-forecast-time "bug" from the spot check was retracted — clamps
already handle it; commit `10afc04`.)

**Phase 5 complete** (2026-07-15, commit `3c529d5`): installable PWA via
vite-plugin-pwa — manifest + icons (any + maskable, upscaled from the
pixel-art logo; replace with higher-res art when available), service
worker precaching the app shell with navigateFallback (offline route
loading), NetworkFirst runtime caching for the weather APIs so the last
forecast survives offline. Google tiles intentionally uncached (ToS →
MapLibre item). Verified in production preview: SW active/controlling,
navigateFallback serves the shell for unknown routes, openmeteo runtime
cache populates and reads back offline.

(Phase 4 at `0694842`…`59fb9ec`, Phase 3 at `eb1aad0`…`340b7ae`,
Phase 2 at `882f803`…`aa73fe5`, Phase 1 at `cd2d8b6`…`38adcfd`,
Phase 0 at `e4df103`.)

**MapLibre provider added** (2026-07-15, commits `bb2d5ec`, `78fc9f0`,
`c3afff7`, `c0fbcde`, `b3885cb`): second map provider, switchable in
Settings ("Map provider": Google Maps / MapLibre satellite). maplibre-gl
confined to `src/map/maplibre/`; the 6 primitives are now provider
dispatchers keyed on `MapProviderContext`; default stays google.
Satellite = ESRI World Imagery (no key) with attribution. Place search
handled per provider (google Places / MapLibre-side geocoder).
Verified in-browser: both providers render the pattern; MapLibre shows
ESRI tiles + POM label + attribution, zero console errors; live switch
works BOTH directions without crashing (the `b3885cb` fix guards MapLibre
`map.remove()` teardown that previously blanked the tree on switch);
provider persists.
NOT yet re-verified on MapLibre specifically: full interaction sweep
(target/heading drag handles, courses render+edit, measure tool, hover
tooltips, wind arrows) — recommended spot-check follow-up. The
implementing agent kept hitting session limits and never delivered its
final report; the last crash-fix slice was committed and verified by the
main session.

Next: Phase 6 (flocking mode) or 7 (logbook/documents); see
`ARCHITECTURE.md`. Also pending: replace placeholder PWA icons with
higher-res brand art (owner input); MapLibre interaction spot-check.

This file is the running log of the redesign effort: current-state survey,
flaws, owner Q&A. Deliverables live in companion files (see §4).

---

## 1. Current state of the codebase (as read on 2026-07-13)

### Reality vs. CLAUDE.md

CLAUDE.md is stale. Actual state:

- **All TypeScript** (`.ts`/`.tsx`), not `.js`. TS 4.9, CRA (`react-scripts` 5).
- State management has been centralized into `src/hooks/useAppState.tsx`
  (React context + Toolpad `useLocalStorageState`). Configs are the source of
  truth; paths are derived via `useMemo`.
- Features beyond CLAUDE.md: presets, courses (canopy-piloting
  distance/zone-accuracy/speed courses, custom courses), observed-wind
  stations (NWS + CSC + Spaceland providers), forecast time selection,
  KMZ export, FlySight 2 export, measure tool, crab-angle arrows,
  Beaufort-colored wind arrows, mobile bottom navigation.
- Tests exist for util/ and forecast/ modules (jest via react-scripts).

### Layering (current)

```
App.tsx (595 ln)  — orchestrates: routing (fake in-memory router), derives
                    c (ideal path) and c2 (wind-corrected) inline on every
                    render, wires ~10 components
hooks/            — useAppState (context, localStorage), useFetchForecast,
                    useObservedWind, usePresets, useCustomCourses, ...
components/       — MapComponent.tsx is 1206 ln (map + tooltips + measure
                    tool + drag handles + station markers + arrows, all in one)
util/             — pure-ish geometry/wind/pattern/course logic (well tested)
forecast/         — OpenMeteo aloft + NWS/CSC/Spaceland observed providers
types/            — good shared type definitions
```

### Core data flow

```
patternParams ─┐
manoeuvreConfig ├─→ derived paths ─→ reposition() ─→ c (ideal)
target ────────┘                        │
winds (forecast + observed ground) ─→ addWind() ─→ c2 (wind-corrected)
settings.straightenLegs ─→ straightenLegs(c2) ─→ display path
```

- `FlightPoint` = GeoJSON Feature<Point> with `{alt, time, pom, phase}`.
- Wind applied backward from landing point; landing point pinned to target.
- Persistence: localStorage only, no backend, no accounts.

---

## 2. Flaws / smells noticed so far

(Preliminary; to be verified and expanded.)

1. **Wind direction interpolation wraps wrong** — `Winds.getWindAt()`
   linearly interpolates `direction` without shortest-arc handling:
   350° → 10° interpolates through 180°, not through 0°. Real correctness
   bug when wind veers across north between altitude rows.
2. **Heavy recompute every render** — `App.tsx` calls `reposition()` +
   `addWind()` + `straightenLegs()` + `averageWind()` inline in the render
   body, not memoized. Every hover/state change reruns full turf pipeline.
3. **Mutation leaks** — `reposition()` sets `phase` by mutating points;
   `App.tsx` mutates `c2[i].properties.phase` in a loop;
   `setManoeuvreAltitude()` mutates in place. Mixed mutable/immutable
   conventions invite aliasing bugs with memoized inputs.
4. **Fake router** — `useDemoRouter` keeps pathname in useState; no URL
   deep-linking, no back button, no shareable links. "Navigate to same
   path routes to /map" is a hidden toggle behavior.
5. **MapComponent.tsx is a 1206-line god component** — polylines, tooltips,
   stats displays, measure tool, drag handles, station markers, overlays
   all in one file.
6. **CRA (react-scripts) is dead** — unmaintained; TS locked to 4.9;
   `DISABLE_ESLINT_PLUGIN=true` workarounds. Vite migration is overdue.
7. **Winds is a class stored in React state** — class instances with bound
   methods in state/localStorage codecs; serialization is ad hoc;
   `effectiveWinds` clone-and-patch in App.tsx shows the friction.
8. **Ground wind injection is display-time state surgery** —
   `effectiveWinds` memo overwrites row 0 with the nearest station; source
   tracking via `groundSource`/`aloftSource` flags on a mutable object.
9. **CLAUDE.md badly out of date** — misleads any tooling/contributor.
10. **`lint` script only covers `src/**/*.js`** — i.e. nothing, since code
    is all TS.

---

## 3. Owner's answers (2026-07-13)

1. **Audiences — multiple, and this drives the design:**
   - **Swoopers** — manoeuvre + courses features. Only they need those tabs.
   - **General skydivers (incl. students)** — standard pattern planning.
   - **Flocking community** — goal: absorb the *flocking wind calculator*
     (`~/git/flocking-wind-drift`, Kotlin/JS) into FliP.
   - **Coaches / instructors** — classes, multiple students; presets matter.
   - **Demo jumpers** — planning demo jumps (potential).
   - Owner insight: Manoeuvre and Courses tabs get in the way for
     non-swoopers → **"modes" concept** (per-audience UI profiles).
2. **Platform** — desktop and mobile equal priority. Advanced features may
   be desktop-only if needed. Users have asked for a phone "app" → **PWA
   (installable, offline) is wanted**.
3. **Backend** — plan for BOTH: keep a fully free static client-only
   version, AND allow optional accounts for sync + logbook; possible
   monetization. Architecture must support "no backend" and
   "backend attached" as deployment/feature tiers.
4. **Compatibility** — localStorage migration may break, as long as the new
   app handles old data gracefully (no crashes; fall back to defaults).
5. **Tooling** — no attachments to current frameworks, but change needs a
   reason. (CRA → Vite has one: CRA is unmaintained.)
6. **Maps** — abstraction over the map provider is desired.

### Flocking wind calculator (read 2026-07-13)

`~/git/flocking-wind-drift` — Kotlin/JS + React, separate site.
Function: for altitude band [end, start] kft, descent rate (mph),
horizontal speed (mph), jumprun direction (or auto = into average drift):

- integrates wind drift across altitude band from OpenMeteo winds aloft
  (same data source as FliP)
- adds canopy/wingsuit flight vector along jumprun
- outputs: wind drift, flight vector, combined; recommended **spot**
  (distance prior/past target along jumprun + left/right offset)

Text-only UI, dropzone dropdown, hour offset, localStorage persistence.
In FliP this becomes a **Flocking/Drift mode**: same winds pipeline,
rendered on the map (drift vectors, exit point, jumprun line) instead of
text. Core math is ~100 lines — straightforward TS port + tests.

---

## 4. Deliverables (see companion files)

- **Architecture + migration plan** → `ARCHITECTURE.md`
- **Backlog** (owner's list, organized by scope) → `BACKLOG.md`
- **UI/UX improvements + new feature ideas** → `UIUX.md`

---

## Session end — 2026-07-16

Final state of the session that ran Phases 0–5: **369 tests, 0 lint errors
/ ~50 warnings, build green, tree clean.** Nothing merged, nothing deployed.

After MapLibre, the owner asked for a sweep of self-contained backlog items.
Landed (`591b059`…`37dfd91`): backlog hygiene (marked ~12 items Phases 1–5
had silently delivered); place-autocomplete listener/DOM leak; target/heading
handle overlap (via a new tested `core/geometry.metersPerPixel`); wind-table
field clipping; redundant KZPH supplement (verified against the live NWS
API — KM08 genuinely still needs its supplement); select-on-focus; Windy
link; mode-picker a11y names; forecast-time picker hidden for soundings;
sounding station named + linked to its IEM page (URL verified — three
earlier candidates 404'd); "Manually entered" badge; dead
`setManoeuvreAltitude` removed and its live replacement (offset + ±15% clamp)
moved out of `useAppState` into `core/manoeuvre.applyInitiationAltitudeOffset`;
versioned codecs for the last unversioned storage keys, then removal of the
now-dead `createSafeCodec`/`createSimpleCodec`/`deepMerge`.

Corrections worth remembering: the backlog's claim that both storage codecs
were unused was **wrong** (`createSimpleCodec` had two live callers), and its
key names were wrong (`flip.custom_locations`, `flip.manoeuvre.track.tracks`).
A "past forecast time" bug was **retracted** — it was a probe bypassing the
app's own clamps.

Outstanding work, hard rules, environment gotchas and settled decisions are
all in `HANDOFF.md`.

---

## Phase 6 — Flocking mode (2026-07-17)

Ported the owner's Flocking Wind Calculator (FWC,
`/Users/boris/git/flocking-wind-drift`, read-only reference) into a live
FliP mode. Commits `8e67e98` (core math + tests), `85f6c81` (params doc +
migration), `5d9acd8` (mode wiring + panel), `be85cee` (map layer),
`244e567` (reference point C). State after: **474 tests, 0 lint errors /
50 known warnings, build green.**

Shape: `core/flocking.ts` (path construction, into-wind resolution, FWC
drift vectors + spot description — Drift.kt parity-tested, incl. FWC's
odd PAST-side flip in the left/right flag, kept deliberately),
`FlockingParams` persisted at `flip.flocking.params`, `useFlockingPath`
derive hook, `FlockingComponent` panel (FWC presets + text shape),
`map/layers/FlockingLayer.tsx` (descent line #29b6f6, no-wind ghost,
round-altitude POMs, 3 nm jumprun ending at the exit, distance markers
anchored to the reference projection, spot label, pinned reference C).

Deliberate deviations from FWC (owner wanted these reported):
- Wind application is FliP's `addWind` (vector interpolation, 1 s steps),
  not FWC's per-level stepwise sum — parity test asserts agreement within
  a few percent on a uniform-wind closed form.
- 'into-wind' replaces FWC's -1 sentinel; resolved degrees shown live.
- Distance units labeled "mi"/"nm" (FWC spells "miles"), km added.
- POM points inserted exactly at round altitudes so labels read clean.

Verification notes: browser automation cannot zoom/pan the Google map
(wheel scroll timed out, synthetic drags and +/- keys ignored) — the map
picture was verified by temporarily lowering DEFAULT_ZOOM (reverted
before commit) plus DOM checks of overlay labels. Clicking two MUI
toggle buttons in one synchronous JS call loses the first update to a
stale props closure — an automation artifact that looked like a bug.

Open for owner iteration ✎: POM altitude labels overlap at low zoom on
the long flocking path; spot-label/exit-label overlap; whether FWC's
PAST-side left/right flip should be fixed in both apps; the rest of the
flocking wishlist (reverse build, jump profiles, groups/separation,
handoff to landing pattern, reachability zones) is untouched.

## Session 2026-07-16→19 — review, wind UX, flocking iteration

One long session. Ordered roughly as it happened; commit refs are on the
branch. End state: **541 tests, 0 lint errors / 50 known warnings, build
green, tree clean.**

### Architecture review (2026-07-16)

Read the whole branch and recorded the weak spots in BACKLOG under
"Architecture-review follow-ups", then cleared all but two:

- `cf21e1e` error surface — a failed forecast fetch used to reset the
  table to an empty profile with only a console.log. It now keeps the
  previous profile and reports through a new app-wide snackbar.
- `6a88205` `useWinds` facade out of App.tsx (also fixed `appTitle`
  calling a component as a plain function).
- `07f6268`/`4610819`/`a15e4a7` finish the core/ layering: `pathStats`
  and `courses` moved (behavior pinned by tests *first*), drift-angle
  formula deduped, `PointData` shared. Exporters deliberately stayed in
  `util/` — they touch the DOM.
- `19bf4f5` first RTL tests (usePresets round-trip, PatternComponent).
- `0e8f6da` settings layering: explicit `flip.settings.touched` replaces
  the equals-global-default heuristic, fixing a real trap — a user could
  not force a mode-overridden setting back to the global default.
  Pre-tracking users are seeded from what differs from the defaults, so
  behavior is unchanged until their next edit.
- `8a9f2f5` removed dead `CODEC_JSON`.

Deferred deliberately: track-scale path rendering (every point renders
2–3 MapCircles — fine at ~100 pattern points, not for GPS tracks; Phase
7), and the OpenMeteo module-level prefetch singleton (accepted).

### Owner quick items + wind UX

Jump-to-course, map tooltip contrast, per-row wind source badges, ground
speed in the point hover (threaded through the user's speed formatter),
cumulative turn in the manoeuvre hover. Then: winds persist across
reloads with a staleness indicator, an hour scrubber over the prefetched
window (verified with zero fetch() calls while scrubbing), and a
first-pass model/sounding comparison view — the comparison fetch
deliberately never *stores* into the prefetch cache so a sweep cannot
evict the window the scrubber relies on.

### Phase 6 iteration (see the Phase 6 section above for the port)

The port was followed by several rounds of owner feedback:

1. **Jumprun decoupled from canopy flight**, first as an auto/pinned
   split, then — after the owner reframed it around how the UI is
   actually used — as three sub-modes: **classic** (FWC), **free**,
   **solve**. `fa64105`, `01ea225`.
2. **Solve mode** `008c68a`/`5e0868a`/`74c02cb`: analytic corridor
   solver (no brute force — the exit collapses to a clamped projection,
   the canopy arc is sampled at 0.5°), with a brute-force oracle test.
3. **Solver stability** `6f1f302`: plain miss-minimization made the
   forecast scrubber flip between a north and a south corridor on noise.
   Now misses are tiered by green/yellow rings and corridors that both
   reach green are separated by *most into the wind*. It only flips when
   the wind crosses the perpendicular between two runs — a real change.
   This is the design worth preserving; the rest of solve mode is
   mechanical.
4. **UI rounds**: compact vector rows with bearing arrows, wrapping
   direction fields (`NumberInput` gained a cyclic `wrap`), distance
   rounding, a visible grid, the distance unit moved into general
   Settings as a `UnitPreferences` field, draggable Spot Reference, the
   two 1-D jumprun handles collapsed into one 2-D move handle, per-mode
   targets (`flip.targets.byMode`, falling back to the shared legacy
   target), rings renamed Green/Yellow and applied in all three modes,
   nameable + toggleable corridors.

### Two real bugs (both worth remembering)

- **`addWind` curvature** `c95d93b`. Polar drift accumulation wandered;
  invisible until the drift nearly cancels the flown line, then ~14° of
  bogus curvature. Now a flat east/north vector sum. Found by writing
  the smallest possible repro (uniform wind → assert collinear) rather
  than by reading the flocking code, which was innocent.
- **FWC's PAST left/right flip** `ba3b681`. Its formula expands to
  `along × side`, so the side inverts with prior/past. FliP now reports
  the geometric side; **FWC itself is still wrong** — open question for
  the owner.

### Verification lessons (the important one)

A browser check *appeared* to confirm the flocking click-to-move fix.
The follow-up regression check then showed the same "pass" in a mode
that should have behaved differently — suspicious. Stashing the change
and re-running proved the old code behaved identically: automated
coordinate clicks never reach the Google Maps click handler at all, so
both results were meaningless and the first was a false positive. The
fix was verified by a unit test of the actual contract instead
(`TargetEditLayer.test.tsx`).

Generalization now in HANDOFF: when an automated check passes, ask
whether it would have *failed* before the change. If not, it proved
nothing. Automated drags have the same problem — the flocking map
handles have never been exercised by a real pointer.

## Session 2026-07-19→25 — winds indicator, trust, target + flocking map UX

A long UX-iteration session, per-slice committed (`543cf4a`..`a7d0490`).
Highlights and the reasoning behind the fiddly bits:

- **Compact winds indicator** (`WindMiniIndicator`, `43d0240`, `97b9266`,
  `9ab0374`): map-corner overlay in every mode; GND + plan-relevant bands
  (`core/wind.windBandAltitudesFt`); collapse persists under
  `flip.ui.windIndicatorCollapsed`. Note: Toolpad `useLocalStorageState`
  returned the raw string `"false"` (truthy) — replaced with a plain
  parse-explicit hook. Ground-wind detail (observed station or forecast)
  moved here on GND-row hover (`41865e7`), replacing the target-anchored
  arrow; the station tooltip body was extracted as `StationDetails`.
- **Winds fetch to ~41k** (`d16b634`): extended the OpenMeteo pressure
  levels to 200 hPa (verified against the live API first); dropped the
  `limitWind` setting; table shows all rows; auto-fetch once on load
  (`b9e5614`) which also warms the scrubber's module-level prefetch cache
  (`1c1d146` — that cache is memory-only, so the scrubber was missing on
  reload until a manual fetch).
- **Wind-trust banner** (`f9e025a`, `b9e5614`): unified the flocking
  no-wind text and the top-bar "verify" badge into one `WindTrustBanner`
  driven by pure `core/windTrust`. Owner chose: top-of-map banner, hidden
  when fresh, manual winds flagged amber, no-forecast amber (not red). Bug
  fixed: unlocking winds flips the profile to `SOURCE_MANUAL` and the
  top-bar summary was gated on source — now gated on "has real wind".
- **Target rework** (`c34fa4a`): removed the "Edit on map" mode; the target
  is always draggable (`TargetEditLayer`), hover reveals the rotate handle,
  shift-click jumps it (a `{shift}` modifier now flows through the map
  click dispatch). Removed the old average-wind arrow entirely.
- **Flocking rotation about the finish** (`21c4b0d`, `15dab14`): the
  canopy-rotate handle now pivots about the finish, not the exit, in both
  modes. `core/flocking.exitForFixedEnd` holds the finish fixed as the
  direction changes (`end = exit + F(deg) + D`, drift `D` recovered from
  the current geometry). Full handle set reworked per mode (see HANDOFF).
- **Map-drag bug batch** (`dc4b0a7`, `983199a`, `a7d0490`): a `MapDragHandle`
  `pinned` mode (rotation handles ride their line, drag only feeds the
  angle); a per-handle centre-freeze for Google's marker edge auto-pan
  (guarded against the synchronous `setCenter`→`center_changed` recursion
  that first shipped as a stack overflow); and `setHandleDragging` so the
  containers skip the target-follow `panTo` while a handle drags. **None of
  the drag gestures are automatable — the whole batch is pointer-unverified.**
- **Docs**: ported `docs/ux/` from the app-ux-analysis branch (`93aff0a`).

Backlog additions this session: round-number display in ft/m, keyboard
shortcuts, plus the whole "UX analysis" section.

## Session 2026-07-26 — dropzone data + the place picker (P6/F5)

**Ported the FWC dropzone list** (`89ea2c8`). FWC's `Dropzones.kt` (60
entries, from `markschulze.net/winds/dropzones.geojson`) merged into
`util/dropzones.ts`: 14 → 58. Eight overlapped; FliP's own entry won each
time, because those are hand-checked *landing areas* at 5 decimals with a
landing heading, where the imported ones are 3-decimal (~100 m) points
with no heading. That asymmetry is the interesting part — `direction`
became optional, and the picker lands into wind when it is missing rather
than keeping a heading that has nothing to do with the new place. A test
pins list integrity (unique names, no two entries within ~1 km, ranges,
display order) so the next import can't quietly double an entry under a
second spelling.

**The picker itself** (`2c71de4`, `5fcecab`). Three tabs (Dropzones / My
Locations / Search) became one search box over one list. The owner's
framing was the design: one list, custom places on top, searchable, with
the wide (geocoder) search available from the same box. Shape:

- `core/places.ts` is pure and holds all the judgement: `buildPlaces`
  flattens dropzones + custom locations + starred dropzones into one list
  (saved first), `rankPlaces` filters by tiered match quality. Tiers, not
  one fuzzy score — the tiers are what keeps "zh" → ZHills above
  coincidences. Diacritics and ligatures fold, so "arhus"/"faldskaerm"
  find Århus Faldskærm Club.
- **Favorites are stored as dropzone names**, not copies, so a later fix
  to a dropzone's coordinates reaches everyone who starred it. Unknown
  names are dropped when the list is built, not by the migrator, so a DZ
  renamed for one release doesn't silently lose the star.
- Two stores, not one union type: the existing `flip.custom_locations`
  plus a new `flip.favorite_dropzones`. A favorite really is a reference.

**What the running app taught us** (`98bbc6e`) — both found by driving it,
neither by a test:

- **The geocoder was dead on mobile.** Google's Places lives in the Maps
  JS API, which only `MapContainer` loaded; on mobile the Target panel
  *replaces* the map, so on the regular jumper's first mobile action
  `window.google` was undefined and search returned nothing, silently.
  The old Search tab had the same hole — the rework just made it matter.
  Fix: `map/google/PlacesLoader` loads the API from the picker, dispatched
  per provider as `PlaceSearchLoader`. Both loaders must pass the same
  script id *and* URL — `@react-google-maps/api`'s `injectScript` removes
  and re-injects an existing script whose URL differs — hence the shared
  `GOOGLE_MAPS_SCRIPT_ID` / `GOOGLE_MAPS_API_KEY` in `mapConfig`.
- **Subsequence matching was too loose**: "deland" is a subsequence of
  "Skydive Spaceland Dallas". Now limited to queries ≤ 5 characters,
  where it does its real job (initials).

The geocoder also changed contract: from "attach to an input and own a
dropdown" to `searchPlaceSuggestions` + `resolvePlaceSuggestion`. That is
what lets its hits render in the same list as the dropzones, and it costs
a details call only for the suggestion actually picked. Google keeps both
Places generations (the new `AutocompleteSuggestion`, falling back to the
legacy `AutocompleteService` if Places API (New) isn't enabled on the
key); the owner's key runs the new one — verified live, no fallback
logged. MapLibre's Photon geocoder moved to the same contract, which
deleted ~120 lines of hand-rolled dropdown DOM.

**Owner decisions** (asked before building): favorites yes; keep Google
Places (don't switch everything to Photon); no distances in the results
("not useful"); no top-bar location chip — switching DZs is rare, a few
clicks is fine, and the map already shows where you are; landing heading
is not important, so set it into wind when unknown, and don't show
heading in the list; DZ country/region later, backlog it.

Verified in the browser (desktop + 375 px): local filtering, Google
suggestions in the same list, resolving one moves the target and sets it
into wind, starring persists and re-groups, custom save/rename/delete,
one `maps/api/js` script with no multiple-inclusion warning, and a denied
location permission leaving everything else usable. **Not verified: a
real geolocation grant** (the prompt can't be answered from automation) —
unit-tested only.

Backlog additions this session: DZ country/region, a recents list, and
landing headings for the 44 imported dropzones.

### Target scope: place vs position (2026-07-26, owner report)

"When switching between pattern and flocking the DZ changes." Per-mode
targets were deliberate (`flip.targets.byMode`, added with the flocking
work) and the rationale still holds *within* a dropzone — a swoop pond
and a flocking end point are not the same spot. But which dropzone you
are at is not a per-mode fact, and having it change under you on a mode
switch is just confusing.

The split now is **place vs position**:

- **Place** — the picker, "nearest dropzone", loading a preset → moves
  every mode (`useAppState.setTargetEverywhere`).
- **Position within the place** — dragging the target, shift-clicking the
  map, the heading input, the flocking exit drag → current mode only
  (`setTargetForMode`, unchanged).

`setTargetEverywhere` *clears* the per-mode entries rather than writing
the new target into each. That is what makes it work for modes the user
has never opened: with no override left, every mode reads the shared
`flip.target` again. Modes are free to diverge afterwards.

Presets follow the same rule: **saving** snapshots the current mode's
target (one place + heading), **loading** applies it everywhere — a
preset names a place, so restoring it in pattern and finding flocking
still at yesterday's DZ would be the same bug. `usePresets` takes the
setter as `applyTarget` to make that explicit at the call site.

Verified in the browser end to end: seeded a per-mode flocking target,
picked DeLand in pattern, switched to flocking (followed); edited the
heading in pattern (pattern-only override, shared untouched); saved a
preset, moved everything to ZHills, re-loaded the preset (all modes back
to DeLand). Also spotted a pre-existing wrinkle worth fixing separately:
re-selecting the *already active* preset is a no-op, so there is no way
to revert to it once you have wandered off (backlogged).

### Winds re-fetch when the place changes (2026-07-26, owner request)

Moving to a new dropzone used to *clear* the winds (the 5 mi
`WIND_INVALIDATE_THRESHOLD_FT` invalidation) and stop there — the
on-load auto-fetch was a one-shot `didAutoFetchRef`, so you landed on the
"no forecast" banner and had to hit refresh. Now the same effect is keyed
on **where the winds were last fetched for**: on load, and whenever the
target has moved further than the invalidate threshold, it fetches again.

The ref records the location last *attempted*, not the last success, so a
failing fetch cannot spin — it retries only once the target moves again.
Sub-threshold nudges keep their winds, as before.

Verified in the browser, including a **control run against the
pre-change code**: same script, same steps — before, picking DeLand left
`flip.winds` empty (0 rows) forever; after, the profile comes back for
DeLand's coordinates within a second. Without that control the check
would have proved nothing (see the verification lessons above).

### P9 — leg-count selector hidden in Standard Pattern (2026-07-26)

NONE/1/2/3 is a swooper's control; a regular jumper always flies the full
downwind-base-final. Expressed the way the other exposure rules already
are — a mode `feature` (`patternLegCount`, on `swoop`, absent on
`pattern`) — rather than an `mode.id === 'pattern'` check in the panel.

Two things worth remembering:

- The override is applied **on read**, never written back
  (`core/pattern.withFullPattern`). `patternParams` is a single store
  shared by all modes, so persisting the promotion would silently destroy
  a swooper's stored two-leg setup the moment they looked at Standard
  Pattern. Verified in the browser: stored type stays `two-leg` while the
  panel shows all three legs.
- The pattern **path** is now derived in App instead of `useAppState`.
  How many legs it has depends on the mode, and the state provider is
  deliberately mode-agnostic; leaving the old derivation in place would
  have handed callers a second, silently mode-blind pattern.

Verification note: comparing map screenshots between the two modes proved
nothing — at the default zoom the third leg is off-screen and both views
look identical. Rather than fight the map, the actual behaviour is pinned
by a unit test on `withFullPattern` + `makePatternByType` (top of pattern
900 ft as stored, 1800 ft as flown). Writing that test also corrected a
wrong assumption: leg altitudes are per-leg heights that sum, not
absolute altitudes.

Also fixed here: a lint error (`no-use-before-define` in
`map/dispatch.tsx`) introduced with `PlaceSearchLoader` in `98bbc6e` and
missed because that commit's check read only the tail of the lint output.
That commit's "0 lint errors" claim was wrong; the tree is clean now.

## Session 2026-07-27 — keyboard shortcuts (+ the `?` overlay)

One table, two consumers: `core/keymap.ts` holds the bindings, and both
`hooks/useKeyboardShortcuts` and `components/ShortcutsOverlay` read it.
That is the whole design idea — a hand-written shortcut list goes stale
the first time a binding changes, so the list is *derived*. Entries are
gated by panel, mode feature, or whether the final heading applies, which
is what makes the overlay show Standard Pattern four panel keys and the
swooper seven.

The table also carries **mouse gestures with no keys** (shift-click to
move the target, drag, hover to rotate). The overlay is where someone
looks to find out what they can do, and "how do I move the target" is
that question — owner asked for shift-click to be documented.

Things worth remembering:

- **The guard is the feature.** Single-key shortcuts are only safe if they
  stay out of the way: keys are ignored from inputs/textareas/selects/
  contenteditable, and from inside anything with `role=menu|dialog|listbox`.
  That second rule is what lets the preset menu own 1-9 without those
  digits also switching mode. Ctrl/Cmd/Alt are never claimed, auto-repeat
  fires once, and the key is only `preventDefault`ed when a handler
  actually ran — an unbound key must keep its browser behaviour.
- **Match on the character, not the physical key.** `?` is Shift+/ on a US
  layout and elsewhere on others; `<` is not `shift+,`. So printable keys
  compare `event.key` lowercased and named keys keep modifiers.
- **Focus map (`F`) keeps the layout mounted.** It hides the header via
  the DashboardLayout `header` slot, the nav via `hideNavigation`, and the
  panel by passing `box={null}`. Swapping to a bare map element instead
  would remount the map, reloading tiles and losing the camera.
- **Key choice:** panel keys are first-letter (owner's call), so the
  flocking panel got `G` — `F` is focus-map, which is global and the more
  guessable of the two. Easy to flip; it is one line of data.
- `Esc` is layered most-transient-first: leave focus map, else close the
  open panel.

Verification notes (two automation traps, both hit):

- `document.querySelector('[role="dialog"]')` returns an *empty* first
  dialog node in this app, so an early "did it close?" check passed while
  the overlay was plainly open on screen. Select by content instead.
- A "still open" check right after Escape reads the MUI **exit
  transition**, not a failure. It had in fact closed.
- The preview reports `window.innerWidth === 0` on some routes, which
  makes `useMediaQuery('(max-width:600px)')` true, so the app renders its
  mobile layout and the desktop-only hint correctly does not appear. Had
  to resize the viewport explicitly to test it — worth remembering before
  concluding a desktop-only feature is broken.

### Two shortcut bugs, and the remount behind one of them (2026-07-27)

Owner found both immediately.

**`[` / `]` moved the slider but nothing else.** The scrubber does two
things — `onForecastTimeChange(t)` *and* `fetch(t)` — and the keys only did
the first, so the selected hour moved while the table and paths kept the
old slice. The keys now go through one `applyForecastTime` helper that
does both, and step on the same whole-hour grid as the slider (0 = now),
clamped to the hours actually cached. Setting the time without re-slicing
is a trap worth remembering for anything else that selects a forecast
hour.

**The preset menu re-opened on every state change.** The real cause was
not the menu: `slots={{ toolbarActions: () => <ToolbarActions …/> }}`
creates a NEW component type on every App render, so React unmounted and
remounted the whole toolbar each time anything changed. The `openSignal`
counter then re-fired its mount effect and re-opened the menu — which is
why nudging the target with an arrow key popped the presets open.

Two fixes, both worth keeping:

- Slot components now have stable identity (created once, reading their
  props from a ref that is refreshed each render), so the toolbar is no
  longer torn down and rebuilt continuously. This was costing far more
  than the preset menu — the toolbar's entire local state, including its
  dialogs, was being discarded on every render.
- The preset menu is **controlled** by App (`open` + `onOpenChange`)
  rather than triggered by a signal. A "do this once" trigger held in
  local state or a mount effect is not safe in a component that can
  remount; controlled state is.

The general lesson: an inline arrow in a `slots`/`components` prop is a
remount, not a re-render. If a component under such a slot ever seems to
forget itself, look there first.

### The help panel (2026-07-27)

Owner's requirement, which is also the acceptance test for the content:
*if a user does not understand a piece of the UI, they can find a
reference for it.* That makes this a manual, not a tutorial — hence a
topic per panel, and a test asserting every panel a mode can open has
one. A new panel cannot ship undocumented.

Decisions worth keeping:

- **Content is data, not JSX** (`core/help.ts`). Blocks are paragraph /
  terms / note / pathLegend / shortcuts. `terms` is the workhorse: a
  control-by-control list, which is the shape "what does this field mean"
  actually wants. The point is that rewriting the prose means editing one
  file of strings — the words will change far more often than the
  rendering, and the owner is the one who will change them.
- **`?` does NOT open the Help panel.** It opens the shortcuts overlay.
  The overlay floats over what you are doing; a panel would replace the
  thing you wanted help with. Contextual entry is the per-panel `?` icon,
  which deep-links to that panel's topic and works without a keyboard.
- **The topic is in the URL** (`/help?topic=winds`), so panel links and
  links sent to a student both land in the right place and survive a
  reload. `/about` redirects rather than hitting the unknown-route guard,
  which would have silently bounced old bookmarks to the map.
- **No rail.** The first attempt had a topic rail beside the content, as
  designed; in the real 380px panel column that wrapped About to about a
  word per line. It is list-then-drill-in at every width now, which also
  deleted the mobile/desktop branch.
- The shortcuts topic renders the same `ShortcutList` component as the
  overlay — extracted for exactly this — so the keys are written down
  once. It is hidden where there is no keyboard.

**The prose is placeholder.** It was written from reading the code, and
the Courses entry (distance / zone-accuracy / speed) was inferred from
type names and geometry rather than from how the disciplines are judged —
flagged to the owner as the least trustworthy part.

## Session 2026-07-29 — Nerd mode (`5ea378c`)

The owner asked for a way to unlock rarely-used features so the everyday
UI stays simple, and explicitly asked for advice on the shape: "maybe not
a mode in itself but a Nerd Mode enable/disable option somewhere?"

**It is a flag, not a mode, and that is the whole design.** A mode
answers *what jump am I planning* (pattern / swoop / flocking); nerd
answers *how much UI do I want*. Those are different axes, and they
cross — the owner's own list spans both ("mostly landing, but manual
wind applies to flocking too"). As a fourth mode it would have needed
nerd × 3 combinations, which the `Mode` object cannot express, and it
would have fought the per-mode target and pattern storage. This also
kills the old **explore / "Winds Aloft & Data" mode** that BACKLOG and
`docs/ux/roles-and-tasks.md` had been circling since 2026-07-22: the
reason that idea kept feeling like "swoop-minus" is that its content was
never a *kind of jump*.

**Applied as a transform over the active mode**, which is what made it
cheap. Every existing gate already keys off the `Mode` object — nav, map
layers, `hasFeature`, and the keymap context — so `withNerd(mode, nerd)`
widening `features`/`nav` gates all four at once. The alternative,
threading `settings.nerd` into each component, would have put the same
boolean in fifteen places and missed the keymap entirely. Confirmed in
the browser: the `E` shortcut and its overlay row disappear with the
Export button, and nothing in `core/keymap.ts` knows nerd exists.

Two things that were nearly wrong, both worth remembering:

- **Hiding a control is not enough.** The owner's wording was "enabled
  iff nerd mode is on": a hidden switch still stored as `true` would keep
  its behaviour and there would be no simplification. So `applyNerdGate`
  masks the value at App's single `modeSettings` choke point.
- **But the mask must not be "force false".** The first instinct was to
  gate `interpolateWind` and `straightenLegs` too — both default to
  `true`, so forcing them false would have silently changed everyone's
  path geometry the moment they left nerd mode. The everyday value is
  therefore the **app default**, which is exactly the rule the owner
  stated in the follow-up round ("otherwise default settings should
  apply") and which made gating those two safe when he asked for them.
  `NERD_OFF_OVERRIDES` holds only the exceptions, and a test asserts the
  math-affecting settings never appear in it.

**The gate ignores `flip.settings.touched`** — deliberately unlike
`applyModeDefaults`. Touched means "the user chose this", and mode
defaults respect it so a user can force a mode-overridden setting back.
With nerd off the control is not rendered at all, so an old choice is
stale by definition and must not keep the advanced behaviour alive.
Nothing is written back: the stored value returns when nerd does.

**Placement detail that is not cosmetic:** the toggle is the *first*
thing in Settings because switching it on makes rows appear *below* it.
At the bottom of the panel — the obvious place for an "advanced" switch —
the change happens off-screen and the toggle reads as broken.

**Why the chip.** Nerd's only footprint outside Settings, and only while
it is on. Without it the extra tools appear with nothing to explain them,
and "why does my FliP look different from yours" has no answer. Clicking
it turns nerd off; no confirmation, since it is fully reversible.

**Scope, from the owner.** In: manual wind (Unlock/invert/row editing),
both exports, `showPomTooltips`, `highlightCorrespondingPoints`. Ruled
out, so they are not re-proposed: forecast-model selection and comparison,
unit pickers, `showPreWind`, `showCrabArrow`. The full 41k ft wind table
needs work but outside nerd. Left open: map provider, `straightenLegs`,
`correctPatternHeading`, custom course authoring.

**Verification.** Every browser check was run in *both* states, so the
pairing is the evidence rather than one green reading — the same
discipline as re-running a check against the pre-change code. It caught
nothing this time, but it is what makes "the KMZ button is absent"
meaningful (it was absent for a while because no course was selected,
which the paired check exposed immediately). The two component test files
were also confirmed to fail with the gate removed.

**MUI 7 gotcha:** `inputProps={{ 'aria-label': ... }}` on `Switch` is
silently dropped — no warning, no attribute. `slotProps={{ input: {...} }}`
is the live path. Cost a debug round-trip.

### Round 2, same day (`3e86140`)

The owner came back with a second list. Most of it was one line per item
in the nerd tables, which is the payoff of the transform design. Three
things were not:

**The wind actions moved rather than being gated.** "Fetch forecast" was
a full-width button and there was a second refresh in the app toolbar;
the owner wanted the button gone, an icon "somewhere near the top, not
wasting space", and the toolbar one gone too. The shared panel header
(title + `?`) already existed for every panel, so the refresh icon went
*there*: it costs no layout space, sits next to the thing it refreshes,
and leaves the global toolbar for genuinely global actions. Refreshing
now exists in exactly two places, both next to what they change — that
header and the map indicator's own refresh.

**Reset joined Unlock.** It clears the profile, so it is an editing
action, and having it as the second thing an everyday user met in the
panel was backwards. Locked, the row is Unlock / Reset; unlocked, it is
add / Invert / Reset.

**"The hover over pattern points should go under NERD" was not a settings
row.** `FlightPathsLayer` had `enableHover = isPom || showTooltip` with
the comment "POMs always have hover/tooltip" — i.e. pattern points were
hoverable *regardless* of `showPomTooltips`, which only ever controlled
whether hover extended to the non-POM points as well. Gating the setting
alone (round 1) therefore did nothing for the pattern points themselves,
which is exactly what the owner was looking at. It needed a real feature
(`pointTooltips`) above the setting. A layer test pins all three states,
and was confirmed to fail with the gate removed. Worth remembering as a
category: **a setting can be gated and the behaviour still leak, when the
code treats the setting as an extension rather than the switch.**

The seven new settings arrived with the rule that resolved a question
left open in round 1: their everyday value is `DEFAULT_SETTINGS`, so
`interpolateWind`, `straightenLegs` and `correctPatternHeading` could be
gated safely after all — someone who leaves nerd mode gets the same paths
as someone who never entered it. Gating the whole Pattern section also
surfaced a small rendering bug in the first version: a group whose every
row is nerd-only left a bare header and divider behind, so empty groups
are now dropped.

### Round 3, same day (`a07c8d6`) — the wind table and the comparison

**"The wind table should display the same summary as the panel on the
map."** Taken literally: the by-altitude sampling moved into pure
`core/wind.sampleWindBands()` and *both* the map indicator and the Wind
panel call it, with App handing the panel the same band list it hands the
map. Duplicating the loop in the panel would have looked identical on the
day and drifted the first time either side changed. The panel then
expands to the source's full level list and back; unlocking forces the
full table, because editing needs real levels rather than sampled bands.

A unit test caught the edge case: with no bands in range the "summary"
degenerates to a single GND row, which would have hidden every level
behind an expander. It falls back to the full table now.

**The comparison had three separate problems, and the owner named all
three.**

- *"What's _TBW?"* — the sounding column was headed with
  `profile.meta.station`, the raw IEM station id. A column header is the
  worst place for an identifier nobody outside the code recognises,
  especially when the owner's next question was "does it include the
  sounding?" — it did, and the header was the only thing that could have
  said so. Now labelled "Sounding", station in the tooltip, and the
  footnote states the contents outright.
- *It didn't follow the forecast time* — two causes, both needed fixing:
  `fetchOpenMeteoComparison` hardcoded `hourOffset` 0 ("the comparison
  answers what the sources say about now" — a deliberate choice that was
  simply wrong once the panel grew an hour scrubber), and the view only
  loaded on open. The sounding genuinely cannot follow the hour, so
  rather than hide that, the footnote says it.
- *The show/hide felt weird* — a button that renames itself gives no clue
  that a section is about to appear below it, and none that it is already
  open. A chevron disclosure row does both, and matches the other section
  headers in the panel.

**An off-by-one the new footnote exposed.** Printing the sampled hour next
to the profile's "valid" line made it obvious that asking for 13:00 at
11:55 returned the **12:00** forecast. The offset indexes an hourly series
whose row 0 is the *current hour* (`prefetchedIndexFor` floors `now` to
the hour), but it was computed from the wall clock, so 1.08 h rounded to
1. Wrong for most of every hour, and invisible until two clocks appeared
side by side. `forecastHourOffset` now measures from the current hour and
is the single definition shared by the main fetch and the comparison.
Test written first, confirmed failing, then fixed.

**One bug the browser caught that the tests did not** (the pattern keeps
paying): loading from both the toggle and the new "follow the forecast
time" effect raced — the second call aborts the first controller — and
the sounding column came back as "signal is aborted without reason". The
effect is the only loader now. The tests were green throughout, because
none of them exercise two loads in one tick.

### Round 4, same day (`d26307e`) — the sounding link, and two bits of chrome

**"Is there a link we can include for the sounding?"** Yes, but not the
obvious one, and checking first changed the answer twice:

- `https://mesonet.agron.iastate.edu/archive/raob/?station=_TBW` returns
  **200 and ignores the parameter**. Loaded in a real browser the station
  select still reads KABR (Aberdeen, SD). Curl alone would have passed
  it: the status code is fine, the page is the right page, and only the
  form state gives it away. This is the exact failure mode the "verify
  before building" rule exists for, and it needed the browser, not curl.
- Autoplot **#150** — linked from the archive page and tempting because
  it takes a station — is "Single Sounding Mandatory Level Percentile
  Ranks", a climatology plot. Not the sounding.

What works is `/sites/site.php?station=<sid>&network=RAOB`, whose page
title names the station. `soundingStationUrl` now lives in `core/wind`
and is shared with the Wind panel's own sounding caption, which had been
pointing at `networks.php` (same family, less specific page).

**The underscore ids are real.** Fetching IEM's RAOB network GeoJSON:
346 stations, **26 with a leading underscore** — aggregates, e.g. `_TBW`
= "Tampa Bay Area -- KTPA KTBW", distinct from the plain `KTBW`. So the
owner's "_TBW" was not corruption, it was the nearest station and it was
an aggregate of two sites. The tooltip now gives the name and the id
together, which is the only form in which either is useful.

**Windy** was a line of prose ("Open this location in Windy") occupying a
row of its own for what is a side door out of the app. It is a globe icon
at the end of the conditions row now; the wording survives as its
tooltip.

**Panel top padding** was `py: 4` — 32px of nothing between the app bar
and the panel title. Now `pt: 1.5`. Small, but it was costing a row of
content on every panel at every width.

### Round 5, same day (`5379653`) — picking the source from the table

"Best" became "OpenMeteo Best": it is OpenMeteo's own auto-pick, not a
named model like GFS, and the bare word implied a judgement the app was
not making.

**The comparison's column headers are now controls** — tap one to plan on
that source, sounding included. Comparing sources and then having to go
to Settings to act on the comparison was the gap. The sounding's station
link moved to a small icon beside the label so that the label means one
thing in every column.

**This forced `windAloftSource` and `windModel` back OUT of the nerd
settings mask, and the reasoning is worth keeping**, because it is the
first time the masking rule had to give way. The rule ("hiding a control
must also suppress its effect") rests on a premise: with nerd off the
user cannot see or change the setting, so a stored value is stale by
definition. The comparison table breaks that premise — it is available to
everyone and now writes both settings. Leaving the mask on would have
made a non-nerd user's click write the setting and have it silently
reverted on the next read: the worst kind of dead UI, because it looks
like it worked. The Settings dropdowns stay nerd-only; only the masking
went. **The general form: a gated setting may only be masked while every
control that writes it is behind the same gate.**

**Selecting could not do its own refetch.** `fetchWinds` closes over the
settings it is replacing, so fetching from the click handler would have
fetched the model you just left — the classic setState-then-read race.
App refetches on a source-key change instead, skipping the initial value.
That also fixed a papercut nobody had reported: changing the model in
Settings stored the choice and left the previous profile on screen until
the user hit refresh.

**One unresolved observation.** Twice, a screenshot taken after selecting
a source showed the comparison section collapsed, though `aria-expanded`
read true moments earlier. It did not reproduce across five further
attempts, including a 30-second watch, with GFS, ECMWF and the sounding.
`WindComparison` is deliberately outside the `fetching` ternary (verified
again), so a fetch should not unmount it. Recorded rather than "fixed":
chasing it further would have been a phantom hunt, and a fix with no
repro would be unverifiable.

### Round 6, same day (`c5beefa`) — two small reversals

**A wind glyph for Windy — tried and reverted.** `Cyclone` (closest glyph
to Windy's swirling flow maps) went in and the owner preferred the globe,
so the globe it is. What stands either way: MUI has no Windy mark, and
using their real one would mean fetching it from windy.com on every
render — a third-party request from a PWA meant to work offline, and one
that tells windy.com every time the panel opens — or shipping their
trademark artwork in the bundle. `Air`, the obvious wind glyph, is the
Wind nav item's icon, and one icon meaning two things in the same app is
worse than an abstract one.

**"OpenMeteo Best" went back to "Best".** Round 5 put the provider in the
header; the header is the one place in that table that cannot afford
words — five or six columns in a ~380px panel — and it started wrapping.
The provider belongs in the tooltip, which has room, and it is now on
*every* column ("GFS forecast model, via OpenMeteo") rather than implied
by whichever one carries the provider's name. The "Best" tooltip also
explains what it actually is: OpenMeteo's own pick of the model it rates
highest for that location, not a judgement FliP is making.

The general shape of both: the smallest surface should carry the shortest
label that is unambiguous *in context*, and the explanation belongs one
hover away.

## Courses belong to a dropzone (2026-07-29)

Owner: "move the Courses to be DZ specific. The app will ship with certain
courses in certain DZs. The user can add new courses to a specific DZ
locally. The UI only lists the courses available for the current DZ, and
the choice is saved in a preset."

**One field, not two mechanisms.** The obvious reading — shipped courses
are dropzone *data*, so they go in `Dropzone.modes.swoop`, next to
flocking's `solveCorridors` — was rejected. Custom courses need the same
scoping, and hanging them off the dropzone entry is impossible (a user
cannot edit `util/dropzones.ts`), so that route ends with two parallel
lookups. Instead `CourseParams.placeId` carries a `Place.id` and is
filled in for *both* kinds. `coursesForPlace` then filters one flat list
and nothing downstream knows which courses were shipped. It also keeps
`core/courses.ts` free of `util/dropzones.ts`, which pure `core/` may not
import anyway.

The built-in ids are unchanged (`skydive-arizona-distance`, …) so a
stored `flip.courses.selected` and any preset saved earlier still
resolve. Their *names* dropped the DZ prefix — "Skydive Arizona:
Distance" is now "Distance", because the dropzone is the group header
above it. That is why the type caption in the picker is conditional:
printing "Distance · Distance" was the first thing the browser showed.

**Three decisions the owner made** (all as recommended):

- **Legacy custom courses stay unassigned.** `placeId` absent means
  "belongs nowhere", and such a course is offered at *every* dropzone,
  under "Not at a dropzone". The alternative — guess the nearest DZ from
  the coordinates on first load — is a storage write that cannot be
  undone if the guess is wrong, and there is no coordinate radius that is
  right for both a pond 200 m from the LZ and a course at a boogie site.
- **Changing dropzone drops a foreign selection.** A ZHills course at
  Eloy is not merely useless, it drags the map camera 2000 mi
  (`App`'s "jump to course" effect). Unassigned courses survive the move,
  because they belong here as much as anywhere.
- **A preset records its place.** Presets already stored
  `selectedCourseId`; with scoping, restoring that id without the place
  would select a course the panel no longer lists. `Preset.placeId` is
  the fix, and it needed `PlaceSelection.useGivenTarget`: the normal
  place-selection path prefers what the place *remembers* over the target
  passed in, which for a preset is backwards — the preset IS the
  remembered setup. `useGivenTarget` overrides the target only; the
  place's Spot Reference and corridors still apply, since a preset says
  nothing about either and dropping them would lose the corridor setup
  for the dropzone it just took the user to.

**Where the clearing lives.** In `selectPlaceTarget`, not in an effect
watching `activePlaceId`. Choosing a place is an event with a known
before and after; an effect would have to distinguish "the place changed"
from "the app just loaded", which is exactly the shape that clears a
user's selection on every refresh. It costs `AppStateProvider` a call to
`useCustomCourses` — a course's place is stored with the course, so
deciding this needs the user's own list, not just `BUILT_IN_PARAMS`.

**Verified in the browser** (both directions, per the standing rule): the
picker at Eloy lists Practice gates / Distance / Speed / Zone Accuracy
under "Skydive Arizona" and the legacy course under "Not at a dropzone",
with the ZHills custom course absent; selecting Distance then picking
ZHills in the place picker left `flip.courses.selected` null; "New" at
Skydive Atlanta wrote `placeId: 'dz:Skydive Atlanta'`; and saving a
preset there, moving to Eloy, then loading it restored place, course and
the preset's own target together. One dead end worth recording:
re-selecting the *already active* preset is a deliberate no-op in
`PresetSelector` (`if (id !== activePresetId)`), which looked at first
like the preset load being broken.

### Fresh-load bug found the same day: no place to match the default target

Owner report: on initial load the target sits at ZHills, but the Courses
panel is empty; picking ZHills from the Target panel fixes it.

Root cause predates this session. `DEFAULT_TARGET` (`core/model.ts`) is
28.21887, -82.15122 — ZHills' coordinates almost exactly (its lat is an
exact match for the dropzone's own `swoop`-mode override) — but nothing
ever set a matching `activePlaceId` for it; that field has defaulted to
`null` since the per-place system was built, because until today nothing
read it before a place was chosen. Course scoping was the first consumer
that cared whether `activePlaceId` matched where the target actually was,
which is what surfaced it.

Fix: `flip.place.active`'s default (in `useAppState.tsx`) is now ZHills'
place id, not `null`, applying only when nothing has ever been explicitly
stored there — a user who already picked a different dropzone is
untouched, since their key already holds a real value. `resetAll` sets
the same default rather than `null`, for the same reason it restores
`DEFAULT_TARGET` rather than clearing it.

Confirmed the bug with `localStorage.clear()` before the fix (Courses
panel empty at a target sitting exactly on ZHills) and after (lists
ZHills' three built-ins). Two tests pin it in `useAppState.test.tsx`
("starts at ZHills…", "restores the ZHills default after resetAll") and
were confirmed to fail against the pre-fix code.

### Courses panel rework, same day (P5 closed)

Owner: "There's only a handful available, so we should display them with
something like a radio button. The 'new' interface is awkward."

**Radio list, not a dropdown.** Per-DZ scoping made the list short by
construction — three or four rows at a dropzone — so a `Select` was
spending two clicks to reveal what fits on screen. It is now a `List` of
`ListItemButton` + `Radio`, with "None" as the first row. The
`ListItem`/`secondaryAction` form was chosen over `RadioGroup` +
`FormControlLabel` specifically to have somewhere to put the row actions:
Duplicate used to be an icon *inside a MenuItem*, so it only existed while
the dropdown happened to be open, and Delete only existed at the bottom of
the Edit accordion. Both are row actions now (Delete on custom rows only,
since a shipped course cannot be removed).

That also retires a standing backlog item for free: a stale
`flip.courses.selected` used to render its raw id, because `Select`'s
`renderValue` fell through to it. A radio list has no `renderValue` — an
id matching no row just leaves nothing checked.

**"New" asks the type first**, which is the actual content of P5. It is a
three-item menu (Distance / Zone Accuracy / Speed) rather than a dialog:
the only other field a dialog would collect is the name, and the name is
almost always just the type. So the course is created already named for
its type — `defaultCourseName`, numbering to "Speed 2" when the built-in
"Speed" is already there — which is consistent now that the shipped
courses dropped their DZ prefix and are called "Distance" / "Speed" /
"Zone Accuracy".

Two defaults changed with it:

- **Direction is the target's final heading, not 0.** A course laid out
  due north through the target is never what anyone means; courses are set
  into the prevailing wind, which is what the final heading already tracks.
- **Speed courses get `carveDirection: 'left'` at creation**, rather than
  being defaulted later on first read. `handleDuplicate` also carries
  `carveDirection` now — it was dropping it, so duplicating a right-carve
  speed course silently produced a left-carve one.

**The Edit accordion is titled with the course name**, not the word
"Edit", and opens automatically for a just-created course, which by
definition still needs positioning. Type and Carve sit on one row.

**Map handles are no longer gated on the accordion** (`courseEditTarget`
in App). Opening a *form* to make the map interactive is the same
indirection the target's "Edit on map" mode was deleted for; a selected
custom course is now draggable whenever the panel is open, and the
accordion is purely a form. `courseEditOpen` still exists but only drives
the accordion.

**Approach angle: a real readout bug.** `direction - finalHeading` was
never folded, so it could show -270 for what is +90 the other way (the UX
pass noticed the number, not the cause). New pure
`normalizeRelativeAngle` in `core/validation` folds to (-180, 180],
keeping +180 rather than -180. Depth / Offset / Approach Angle also got
tooltips saying what they measure from — the second half of P5.

**Verification.** The map-handle change was checked in *both* directions,
which mattered: with the old `courseEditOpen &&` condition put back, the
orange move handle vanishes from the screenshot while the blue target
handle stays, so the check distinguishes the two states rather than just
finding some marker. The -270 fold was exercised from both sides
(ZA course at 270.308 against final headings 180 and 0, reading 90 and
-90).

### Courses panel, second pass: positioning is a mode again

Owner: "Dragging the target vs the course clash. I want an 'edit' mode
for the course, which then gets disabled once it's set."

**This reverses the previous pass's decision, and the reversal is right.**
That pass removed the gate on the course's map handles, reasoning by
analogy with the target's retired "Edit on map" mode. The analogy was
wrong, and the owner found the reason within the hour: the target has no
*rival*. A course does. A course centre is usually within metres of the
landing spot — at ZHills the ZA course and the target are about 10 m
apart — so both handle sets land on the same pixels and you cannot tell
which one you are grabbing. "Always draggable" is only a good default for
the single thing on the map that nothing else overlaps.

So `courseEditOpen` gates the handles again, but as an **explicit
"Position on map" toggle** in the panel rather than a side effect of an
accordion being open — which is what was actually wrong with the original
arrangement, and is a different complaint from "there should be no mode".
While it is on, `targetEditTarget` is `undefined`, so the target is not
draggable at all: two overlapping handle sets is the bug, and hiding one
of them is the fix. It resets on a change of selection (`handleSelect`),
because a positioning mode left on would hand the *next* course's handles
the map without being asked, and it is switched on automatically for a
course that was just created or duplicated, both of which sit
un-positioned on top of something else.

**Details moved inline.** The selected course's controls render under its
own row instead of in a section below the Relative Position block. With
the list this short the old arrangement made you look away from the row
you had just clicked to find its fields. A built-in course with nothing
exportable renders no block at all — the first cut left an unexplained
gap under its row.

**"Target" is "Relative Position"**, with the explanation as a tooltip on
the heading rather than a caption line under it (the caption was reading
as a section subtitle, i.e. as more chrome, and it cost a line in a panel
that has none to spare). Its three fields are one per line: side by side
they wrapped unpredictably at panel width and "Approach Angle" does not
fit an 11ch column.

**Verification note worth keeping.** The first attempt to check the
handle exclusion was worthless and looked fine: with the course sitting
on top of the target, "positioning on" showed a cyan dot and an orange
dot, and it was tempting to read the cyan one as the target's handle
still being there. It is not — `CourseEditLayer` draws a **cyan centre**
and an **orange rotation handle**, so both dots were the course's. The
check only became real after moving the course ~250 m off the target so
the two objects could not be confused: positioning off = handle on the
target, nothing on the course; positioning on = both handles on the
course, nothing on the target. Overlapping subjects make a screenshot
prove less than it appears to.

Also fixed here: a lint error (`'_id' is assigned a value but never
used`, from the destructure in `duplicateCourseParams`) and a `no-shadow`
warning in `courses.test.ts` were committed in the previous pass, because
the check read only eslint's last line — which reports the *fixable*
count, not the total. Read the "✖ N problems" line.

## Session 2026-07-30 — the manoeuvre's parameters (`0328ddb`, `c5bd838`)

Owner report, and it was right: "my description of left/right relative to
the target is wrong. It should be relative to the final direction of
flight." Worked example — a left-hand 270 approaching from the north always
ends up facing west; a positive "back" should offset you west of your
start, a negative one east, but you face west either way.

Three separate defects were behind that, all in one small model:

1. **`left` did not name the turn.** It named the side the target was on
   (per its own tooltip). The local geometry it built for `left: true` was:
   fly north, turn CLOCKWISE 90, fly east — a right-hand turn under a flag
   the UI rendered as "Left".
2. **The offsets ran along local axes**, not the final heading, so neither
   number meant anything until you knew which way the manoeuvre had been
   rotated afterwards.
3. **The sign of `offsetXFt` was folded into the final bearing**
   (`finalBearing = (finalBearing + 180) % 360`). `setFinalHeading` rotates
   the path so the LAST SEGMENT matches the target heading, so flipping
   that segment rotated the entire manoeuvre by 180 degrees. That is the
   owner's bug exactly: a negative depth re-aimed the turn instead of
   moving the rollout.

Rotation was also hardcoded to 90 (the angle between the two legs), so a
270 could only be approximated by choosing offsets, and the entry heading
was always final ±90. Worth noting: that is what `correctPatternHeading`
compensates for — it snaps the pattern's final leg to ±90 of the target
heading, which was harmless when the manoeuvre could only ever be ±90.

### The model now

`turnDirection` + `rotationDeg` + `depthFt` + `offsetFt`, all in the frame
of the final heading, with the entry heading derived (`final -/+ rotation`).
Offered alternatives were: radius instead of offsets (fewer numbers, more
physical, but "roll out 40 ft left of centre" stops being dialable);
map-first dragging with the numbers as readouts; and preset chips. The
owner picked the explicit one. They are not a fork — the stored model can
carry either pair and derive the other.

**Why the offset is signed against the turn rather than absolutely.** The
first instinct is "+ = right of final", which reads well until you flip the
direction: the shape does not mirror, it becomes *unflyable*. Given an
entry heading that is not parallel to final, the initiation point has to be
on the side from which flying forward reaches the final line. Measuring on
the turn side makes that automatic, makes flipping a mirror, and makes
every positive value valid — hence `LIMITS.manoeuvreOffsetFt.min > 0`.

**Why an arc rather than the old two legs.** With rotation explicit the
shape is solvable: two unknowns (radius, rollout), two constraints (the arc
ends on the final line, the rollout reaches the landing point). Closed
form, and for a 90/270/450 the radius falls out equal to the offset, which
is a nice thing to be able to tell a canopy pilot.

**Both ends carry a straight stub.** Chord bearings sit half a sampling
step from the tangent, and `reposition` reads the manoeuvre's first segment
as the heading to build the pattern's final leg on — so without an entry
stub every parametric turn handed the pattern a heading 2.5 degrees out.
The rollout is the same idea at the other end, and it must never reach
zero: a zero-length final segment is how the old model managed to reverse a
heading.

### Two bugs the work surfaced

- **Writing the tests first caught a duplicate point.** The arc's last
  sample already IS the start of the rollout; pushing it again left a
  zero-length final segment, i.e. no final heading at all. The monotonic
  altitude assertion failed on it.
- **A fresh setup flew no manoeuvre.** Retiring the `none` type made
  `parameters` the default, but `DEFAULT_MANOEUVRE_CONFIG` carried no
  `params`, and `computeManoeuvre` returns `[]` for that. The panel showed
  the default numbers the whole time (it falls back for display), so only
  the map showed it. Found in the browser, not by a test.

### Tests

The manoeuvre suite is now property-based rather than coordinate-based:
rotation actually flown, entry heading, mirroring under a direction flip,
and a table asserting the final approach direction is unchanged by depth
sign, turn direction, rotation and offset — the regression pin for the 180
flip.

`pipeline.test.ts` was the interesting call. Its goldens took a manoeuvre
from `createManoeuvrePath`, so the model change would have required
regenerating 73 pinned coordinates — destroying the safety net at the exact
moment it was there to help. Instead its 3-point manoeuvre is now literal
data (the values the old parameters produced), so the pins carry over
untouched. **A golden test should not take its input from the module the
change is in.**

Stored `offsetXFt`/`offsetYFt`/`left` are deliberately NOT migrated (owner:
"I don't care about existing config — just replace it"), and there is no
sound reading of a `left` that named the target's side anyway.

### The map hint

`ManoeuvreHintLayer` + pure `describeManoeuvrePath`: the final axis, an
entry arrow and the rotation. It measures the PATH, not the parameters, so
tracks and samples get described identically — the owner asked for the
rotation on those too. Rotation comes from the pre-wind path while the
geometry is anchored to the drawn one, because wind bends the ground track
and a turn entered as 270 otherwise reads back "271". `showManoeuvreHint`
(Map section, on by default) turns it off.

### Open — raised, not fixed

`correctPatternHeading` (nerd-only, defaults true) still snaps the
pattern's final leg to ±90 of the target heading. Now that rotation is
exact, a 135 leaves a visible 45-degree kink between the pattern and the
turn. The snap exists to tolerate noisy RECORDED tracks; a parametric turn
knows its entry heading exactly and should bypass it. `reposition` takes
paths, not the config, so it cannot tell them apart today.

## Session 2026-08-03 — the initiation handle's frame

Closed the item above first, by reading the code rather than trusting the
note: `4eda10b` already fixed it. App passes `correctPatternHeading &&
manoeuvreConfig.type !== 'parameters'` to `useFlightPaths`, so the snap
still tolerates a noisy track and never touches a turn that knows its own
entry heading. `reposition` still cannot tell them apart, which is why the
decision is made at the call site, where the config is in scope. No test
covers that line.

### The handle was on the wrong line

Owner's report: the parametric turn is configured for STILL AIR — the
dashed pre-wind line — and the wind-corrected path is FliP's answer. The
initiation handle sat on the answer.

Whether that was cosmetic was the question worth asking, and the answer is
mostly yes. The write-back was already resolved in still air: the layer
subtracted the drift (`idealInitiation - initiation`) from the drop before
handing it to `placeInitiation`, which works in the target's frame. What
was not obvious is that the subtraction was *exact*, not an approximation.
The drift at initiation is the wind integrated over the time from
initiation to touchdown, and both the altitude and the duration are
parameters — the turn's shape and position do not enter it (the same
invariant that makes the path resample at uniform time steps). So the
drift vector does not change as the handle is dragged. Measured before
touching anything: dragging 300 ft deeper, the handle re-rendered 0.005 ft
from where it was dropped.

So the fix is a deletion. The handle takes `paths.ideal`'s initiation
instead of `paths.display`'s, `onMove` forwards the drop untouched, and
`ManoeuvreEditTarget.idealInitiation` and the `withoutDrift` helper are
gone. Dragging now moves the line the numbers describe, and the solid path
answers.

A pre-fix run of the new `ManoeuvreEditLayer.test.tsx` expectations
(against the old two-field shape) failed on both counts — the handle
rendered at the drifted point, and the drop arrived at `onMove` shifted by
the drift — which is what makes the test worth keeping.

Browser-verified on MapLibre at ZHills, ~15 kt average: the handle sits on
the dashed line and the entry arrow ~140 ft away on the solid one, the
displacement pointing upwind, which is the right sign — with wind you must
start upwind of the still-air initiation to land on the same spot.

That gap is the loose end: `ManoeuvreHintLayer` still anchors the arrow
and the rotation label to the drawn path, so the two ends of one turn are
now drawn on different lines. Moving the hint to the still-air path is
consistent for a parametric turn; for a recorded track the drawn line is
the one that was actually flown. Owner's call, recorded in HANDOFF.

## Session 2026-08-03 (2) — "no place" could not be stored

Owner report, flocking: search for somewhere with no dropzone matches, pick
a Google result, and the Spot Reference is stale — "1000 mi PAST".

The state layer looked innocent. `selectPlaceTarget` already clears the
reference when the new place has none (`remembered?.flockingReference ??
declared ?? null`), a unit test already pinned that for dropzone-to-
dropzone moves, and adding the geocoder case — `selectPlaceTarget(value)`
with no place — passed first time. In the browser, picking "Eiffel Tower"
did unpin the reference and the spot read 3.41 mi.

The hole is one layer down, in **Toolpad's `useLocalStorageState`**:
`encode()` maps a null value to null, and `setValue()` treats null as
`removeItem(key)`. A key that is *absent* falls back to its initializer
(`getSnapshot(area, key) ?? encodedInitialValue`). So `flip.place.active`,
whose initializer is ZHills (a deliberate choice, see the 2026-07-29 entry
— it makes a fresh install's DZ-scoped data show something), could not
hold "no place" at all: writing null deleted the key, and the next read —
which in jsdom is the very next render, no reload needed — said ZHills.

Everything downstream then wrote to the wrong record. `setTargetForMode`
and `setFlockingParams` both key on `activePlaceId`, so an adjustment made
in Paris was filed under ZHills, and the next visit to ZHills restored a
target and a Spot Reference on another continent. That is the reported
spot: ZHills' plan measured against Paris. It is not a flocking bug —
flocking is where it is loudest, because the spot readout prints the
distance. The same write hits every mode's per-place target, and the
Courses panel lists the wrong dropzone's courses meanwhile.

Fix: store the absence. `NO_PLACE = ''` is never a `Place.id`, so the key
carries "explicitly nowhere" without a second key or a codec, and
`setActivePlaceId` maps null to it on the way in, `activePlaceId` maps it
back to null on the way out. Audited the other keys: every one whose
initializer is non-null is an object or array that is never set to null,
and the ones that are set to null (`flip.mode`, `flip.winds`,
`flip.courses.selected`, `flip.settings.touched`) default to null anyway,
so this was the only key with the hole.

Second half, because the first does nothing for storage already written:
`nearbyMemory` bounds what a place is allowed to remember at 25 miles from
the place's own position — well past a flocking end point out in the field
or a Spot Reference up the jumprun, nowhere near an ocean. A record that
fails is ignored (the place falls back to its declared coordinates, as on
a first visit); a reference that fails is dropped on its own. Verified in
the browser against a storage record poisoned by the pre-fix repro:
selecting ZHills healed it.

Three tests fail against the pre-fix code: the two `NO_PLACE` ones (the
active place is ZHills again straight after choosing a geocoder hit, and
an off-list edit is handed back by the default dropzone) and the guard's
own (a remembered target nowhere near its place is ignored). A fourth pins
what the guard must NOT eat — a reference three miles up the jumprun.

## Session 2026-08-03 (3) — the spot as the output

Owner: the spot is what flocking is FOR. It is decided, read out and sent
to a pilot, so it has to be big, readable and copyable — and the top bar's
avg/gnd wind is the wrong thing to be showing in that mode.

Shipped four of the seven options that were on the table (1, 3, 4 minus the
shortcut and the radio phrasing, 6); the map HUD card and the big-type
aircraft view were dropped as redundant with the top bar.

**One formatter.** `core/spotText.formatSpot()` builds every string, and
the panel, the top bar and the map label all call it. Before this each
surface built its own — the map label had its own "Jumprun … prior/PAST …"
concatenation, the panel had another with different wording ("Offset 0.42
mi left" vs "0.42 mi left"), and the two rounded independently. Same
lesson as `sampleWindBands`: "they show the same thing" has to be
structural or it is a rumour.

`verdict` is deliberately outside `line`. A miss is a fact about the
jumper's configuration; the pilot is being handed a place to fly to. So
every surface may show it, and no clipboard ever carries it.

**Top bar.** In flocking, `CustomAppTitle` renders `SpotSummary` instead of
`WindSummary`. That is not a loss of wind information: the map's winds
indicator already shows GND and the plan's bands, which is what the bar was
duplicating. The wordmark hides under `sm` when a spot is present — on a
375 px phone the bar cannot hold both, and "FliP" is the part nobody needs
to read. `variant="subtitle1"`, not `button`: the latter upper-cases, and
prior vs PAST is carried by the case.

**Panel.** The spot was body text a third of the way down a panel of
inputs, so it scrolled away exactly when it was being read out. It is now
first, in display type, and sticky.

**The map label is not clickable, on purpose.** It was, briefly. Google's
`OVERLAY_LAYER` pane receives no mouse events (which is why the click did
nothing in the browser), and the panes that do — `overlayMouseTarget`,
`floatPane` — sit above every marker pane, which is exactly why the layer
was moved off them in the first place: a label there shadows the drag
handles under it, and in free mode the exit handle is a few pixels from
this label by construction. Copy is one glance up in the top bar. If the
owner wants it clickable anyway, the fix is an `interactive` flag on
`MapOverlay` plus more separation from the exit.

**Verification note.** A synthetic `element.click()` on the copy control
reported "Could not copy the spot", which looked like a bug and was not:
`navigator.clipboard.writeText` needs transient user activation, which a
scripted click does not carry. Driving the same button through the
browser's real input path copied and toasted correctly. Worth remembering
before "fixing" a clipboard failure that only automation sees.

Mobile answers the remaining question from the options list: the footer bar
(option 7) is unnecessary, because the top bar survives a panel replacing
the map, which is where the spot used to disappear on a phone.

### The no-wind ghost was anchored at the wrong end (same day)

Owner: what is the white dashed line in flocking? If it is the no-wind
canopy flight, it should start at the exit and end wherever it ends,
rather than ending at the target and starting somewhere arbitrary.

Correct, and the cause is structural rather than a slip. `addWind` holds
the LANDING point and accumulates drift backwards, so `ideal` and
`corrected` come out of the model sharing an end. That alignment is what
`flockingVectors` and `averageWind` measure against — drift is the gap
between the two exits — so the pair has to stay that way for the numbers.
Drawing it that way is a different question, and the answer was wrong: the
ghost began at the exit you would have needed in still air (a point nobody
flies from) and finished on the target, where the wind puts you and still
air would not.

`anchorAtExit` translates the drawn ghost onto the real exit, in all three
sub-modes; the vectors keep the end-aligned pair (`idealAligned`). The
picture now reads as the jump being planned: leave the aircraft HERE, with
no wind you would end up THERE, and the gap at the far end is exactly the
drift — which is also the new regression test, since the gap and
`vectors.windDrift.lengthMi` must agree.

Three tests failed before the change (one per sub-mode: the ghost's exit
did not coincide with the flight's), and one pins what must NOT move —
canopy flight, drift and average wind read the same as before.

## Session 2026-08-08 — the consistency pass

Owner: the UI should feel like one app. Example given: the input fields
differ between panels, and the new Manoeuvre ones are right (though too
wide). I audited every panel and the map layers first and proposed nine
findings; the owner took all of them.

What was actually wrong, in order of how much it showed:

**Three numeric fields.** `NumberInput` (label underneath as helper text,
uncontrolled, 15ch), the Manoeuvre panel's `NumberField` (floating label,
unit inside, controlled) and a hand-rolled `TextField` in Courses with
focus refs. Unified on the second. Two things fell out of that: the
Flocking panel's `externalEdit` counter — which existed only to remount an
uncontrolled input when a preset changed its value — is gone, and the
field grew a `wrap` for headings with a union type that makes `limits` and
`wrap` mutually exclusive, so a cyclic field cannot claim bounds it does
not have. Width: 220px alone, `fullWidth` in a pair, and the pairs are the
ones people set together (altitude+duration, depth+offset).

**Five section headings** (h6, secondary body2, uppercase caption,
overline, accordion) became one, plus the accordion where collapsing earns
the click. Two of those h6s were competing with the panel header directly
above them — Courses rendered its own title, so the panel said "Courses"
twice in two sizes.

**The container was fighting its contents.** `alignItems: 'left'` is not a
value `align-items` takes, so it did nothing; `textAlign: 'center'` meant
every panel re-lefted its own text, and the manoeuvre panel's caption —
added later, without the override — was centred. One line fixed a whole
class of drift.

**Buttons**: contained in a panel (the track panel's Save), outlined for
inline row actions (Wind's Unlock/Invert/Reset), text for the same job
elsewhere (Flocking). Now: contained in dialogs, outlined for a panel
action, text inline, small everywhere.

**A tooltip renames a button.** Gating Wind's Reset broke a test that
queried it by name — not because of the gate, but because wrapping a text
button in a MUI `Tooltip` makes the tooltip its accessible NAME unless
`describeChild` is set. "Reset" was called "Discard this profile and start
from nothing." to anything reading the page. Fixed here and in the two
other text buttons with tooltips; icon buttons are unaffected (the tooltip
IS their name, correctly).

**Thirteen map-label styles** over nine backgrounds, three radii and five
font sizes, for one thing: a dark plate holding text over imagery.
`mapLabel()` now issues them, with size (sm/md/lg) and colour as the only
axes that carry meaning. The tooltip proper keeps its own style — it is a
denser surface with a shadow and an anchor offset — and the station arrows
keep text-shadow instead of a plate, deliberately.

Left alone on purpose: the ToggleButtonGroup picker idiom (already
consistent everywhere), the wind table, the SpotHero's display type, the
mode/NERD chips. Those are hierarchy, not drift.

### Three small ones (2026-08-08)

**The sounding says how far away it is.** It always had the distance, but
measured at fetch time from wherever the profile was fetched for — and a
profile outlives a move to another dropzone, so the number quietly became
about somewhere else. The station's own position is now stored
(`meta.stationLocation`, and remember: every meta field has to be listed
in `migrateStoredWinds` or the round trip drops it — the temperature bug),
and the panel re-measures against the target on every render: "39 mi from
the target". Profiles stored before this fall back to the fetched distance
and say "39 mi away" instead, because that is all they can honestly claim.
It uses the shared target rather than the mode's: per-mode targets differ
by yards within a place, and this is a tens-of-miles number.

**Mirror the turn.** The owner asked for Shift+X, and offered Z if there
was a reason. There was: `eventToCombo` folded letters to lower case by
design, so Shift+X and X were the same combo and the binding could not be
expressed. Rather than pick one, the fold now applies only to unshifted
letters — a shifted letter is its own combo, tested on `shiftKey` so caps
lock still types plain letters. It shipped bound to both `z` and `shift+x`
for an hour; the owner asked for one, so `shift+x` is the binding. One
deliberate loss, pinned in a test that used to assert the opposite:
`Shift+P` no longer opens the Pattern panel, and no shifted letter falls
through to its plain binding.

What mirroring *means* depends on the manoeuvre's type, so it lives in
`core/manoeuvre.mirrorManoeuvre` rather than in a key handler: a
parametric turn flips `turnDirection` and nothing else (the offset is
measured on the turn side precisely so that works), a sample flips
`sampleLeft`, and a recorded track has its points mirrored, since a track
carries no hand to flip.

**Beaufort in the top bar** — the last of that backlog item. The AVG and
GND arrows take `beaufortColor`, the same function behind the map arrows
and the wind table's dots.

## Session 2026-08-08 (2) — three backlog items, re-checked

The owner named three entries and asked which were still real. Two were,
one was already done and had grown a second half nobody had noticed.

### The map stays on screen on a phone (P7 / F2)

Opening a panel on mobile rendered the panel INSTEAD of the map
(`LayoutWithSidebar`: `box ? panel : map`). Two costs, only one of them in
the backlog: you could not see what an edit did, and the map was
**unmounted** on every panel visit, so its tiles reloaded and its camera
was lost each time you came back.

They now split the screen — map on top at 40%, panel scrolling below, a
chevron on the divider collapsing the map to an 88px strip. Three choices
worth recording:

- **Split, not an overlay sheet.** The obvious mobile idiom is a bottom
  sheet floating over a full-height map, and it was rejected: the map's own
  corner furniture lives at the corners. The fullscreen control sits
  bottom-right (moved there so it would stop colliding with the winds
  indicator), and a sheet covering the bottom half would bury it along with
  any label near the bottom edge. It also needs camera padding, which
  neither provider exposes through `MapAdapter` — Google has no map-level
  padding at all, so it would have meant shifting the centre by half the
  sheet height in metres-per-pixel, in both providers. A split makes the
  map viewport genuinely BE the visible area, so every existing camera,
  hit-test and overlay-position assumption stays true with no plumbing.
- **The collapsed state is 88px, not zero.** Zero (or `display: none`)
  would put the provider back in the situation the split exists to avoid —
  a torn-down or zero-sized viewport that has to recover on the way back.
- **A toggle, not a drag.** A dragged divider is nicer and is one more
  thing that automated verification here cannot touch (see the "never
  exercised by a real pointer" list, which is already long enough). The
  toggle is a button, so it is verifiable today.

The winds indicator is the size of the strip it sits on, so it takes a
`compact` prop: the chip form is forced and its expand chevron withdraws,
since tapping the chip already opens the Wind panel — the better answer on
a phone than growing the card back over the map. The stored collapse
preference is neither read nor written in that mode, so a desktop user's
expanded card is still expanded when they go back to a full-size map.

**The app bar was already overhanging the content by 34px**, and that is
what had been hiding the indicator's own header — refresh and collapse
included — on the mobile map view too. Toolpad's `DashboardLayout` reserves
one toolbar height for `main` and pins the bar over it; at 375px the bar's
contents (the wind summary or the spot, the mode switch, the presets menu)
wrap to a second row and it grows past the reservation. `useAppBarOverlap`
measures the overhang and pads it out rather than assuming a number: how
tall the bar gets depends on what the active mode puts in it. Measuring
cannot move either element it measures — the padding is applied inside
`main` — so there is no feedback loop.

### Select-on-focus: the rule, and the fields it had missed

The backlog called this done, and it was, for numbers: every numeric field
is `NumberField` and selects on focus. But the same argument — this field
arrives with a value you REPLACE, not one you edit letter by letter —
covers a set of fields that cannot be a `NumberField`, and none of them did
it: a course's name and its lat/lng, a corridor's name, the export dialog's
ground elevation, and both rename dialogs, which open on the current name.
The wind table had its own private copy of the handler.

`components/selectOnFocus` is now the one handler and its doc carries the
rule, which is also in CLAUDE.md's conventions table. What is deliberately
NOT included is as much of the rule as what is: free text (the manoeuvre's
description, the place search box you refine) wants the caret where you
clicked, and a native date or time input owns its own selection behaviour.

Verification note: a scripted `element.focus()` does **not** reach React's
`onFocus` in this browser tooling — the page is not the platform's focused
window, so no focus event is dispatched at all. Dispatching `focusin`
directly does reach it (React delegates on `focusin`), and that is how the
course fields were confirmed to select whole. Same family as the existing
notes about synthetic clicks not reaching the Maps handler: a green check
from `.focus()` alone would have proved nothing.

### The Phase-N follow-up lists

Re-checked entry by entry against the code; BACKLOG now says what each one
is. Two were already fixed (the target/heading handle overlap — solved by
placing the rotate handle 44 **pixels** out rather than a fixed distance in
metres, plus hover-gating it; the mode-picker cards' accessible names), one
is obsolete (`attachPlaceAutocomplete` no longer exists — place search
became a promise API), and one turned out to be **latent rather than
live**: the Settings panel does show stored rather than effective values,
but all three modes declare `defaults: {}`, so nothing is currently
overridden, and the nerd gate only masks settings whose controls it also
hides. The indicator that entry asks for is worth building when a mode
first declares a default, not before.

The `SECONDARY_PANELS` entry is left open with an argument against it:
"Settings and Help are secondary" is a fact about the app rather than about
a mode, so folding it into `Mode` would have all three modes repeat the
same pair. Worth doing only if a mode ever needs a different one.

## Session 2026-08-08 (3) — the phone toolbar, and an empty map explained

Three owner reports, all from using the new split on a real phone.

### The top bar

Four separate things, one symptom:

- **The observed-conditions eye drew at 24px.** `<Tooltip sx={{fontSize:16}}>`
  — the `sx` was on the Tooltip, which is not the element that renders, so it
  did nothing. Owner noticed it as "the observed condition icon takes a lot of
  space", which it did: it was half again the size of everything around it.
- **Every reading could wrap inside itself**, so "140˚@6.6" broke under its
  own "AVG" and "2552 FT" split across two lines. Each is one token now.
- **The gaps were `spacing={3}`** — 24px between four items, on a 375px
  screen. 8px at xs, 24px from sm.
- **The group overflowed its row**, which is why the density altitude was
  sliced off at the right edge.

Then the arithmetic, which is the part worth recording, because it is what
makes this a judgement rather than a fix. At 375px the toolbar has 355px of
usable width. The two readings measure 119 + 121; the mode switch is 40, the
presets button 64 with its label and 40 without; the burger is 40 and the logo
32. Fitting title AND actions on one row needs ≈ 240px for the readings and
there is no honest way to get there — dropping the labels leaves two bare
arrows, and shrinking the font to 0.75rem buys 34px of the 104 needed.

So: **the density altitude is not in the bar at xs.** It was chosen because it
is the only item there that is also somewhere else — the winds indicator's
header carries temperature and DA, and the Wind panel has the whole conditions
row. The two wind readings are only in the bar. With DA gone the title group
is 344 ≤ 355 and nothing is clipped; the actions still wrap to a second row.
That is left as the owner's call (BACKLOG, Polish), because the only way to
one row is to take the readings out of the bar entirely, and AVG — the wind
through the pattern, weighted by descent rate — exists nowhere else in the UI.

### Flocking's empty map

Owner: "if I have flocking selected and I move to a different spot I only see
spot reference and target — no jumprun". Reproduced at Skydive Sebastian in
**solve** sub-mode, and it is not a regression: `deriveSolve` returns the
EMPTY derived state whenever the solver has no `best`, which includes the case
of no enabled corridors at all. Corridors belong to a dropzone and never
travel, so *every* move to a DZ that declares none lands in exactly this
state — and the top bar's spot disappears with the map's, because there is no
spot to write.

Everything about that is intended except that nothing said so. The Flocking
panel did say it ("No corridors — add one to describe an allowed jumprun"),
but it is below the fold on a phone and the map is where the user is looking.

The map says it now. The wind-trust banner's strip was extracted as
`MapNotice` — same amber plate, icon, title, detail — and the two stack in one
absolutely-positioned column, with the winds indicator's `topOffset` computed
from how many strips are showing instead of assuming one. Two messages:
"No jumprun corridors here" when none are configured, "No jumprun solves"
when they are but none reaches.

One layout note: title and detail were two flex items and wrapped
independently, which stranded the "·" at the start of the second column. They
are one flowing sentence in a single child now, with the icon aligned to the
first line rather than centred.

### Pressing the map to close the panel

The click registry dispatched to exactly ONE handler — the highest priority,
latest registration breaking ties. That is right for a layer answering "the
map was pressed HERE" and wrong for behaviour hanging off "the map was
pressed at all", and closing the panel is the second kind. A registration may
now pass `observe`: always notified, never consuming, so `TargetEditLayer`
still gets its shift-click and its tap-to-dismiss.

The winner-selection rule moved into `map/clickDispatch.ts`. It belongs to the
adapter's contract rather than to any map library, both provider containers
had their own copy of the same `reduce`, and neither copy was tested — the
pure version is. That matters more than usual here: the browser tooling cannot
drive a Google map click at all, so a unit test is the only check this rule
will get before a human taps it.

Rejected: a plain DOM listener on the map container. A `click` fires after a
pan (down and up on the same element), so the panel would close every time the
user dragged the map.

## Session 2026-08-08 (4) — Target becomes Location

Owner: the panel is confusing now that the target is movable on the map — it
is only useful for searching locations, so Location is a better name; the top
text is unnecessary; the dropzone list is far too long. He asked for options
and chose: hero card, one starred-first list, country-grouped browse, and
"adjust heading just goes away".

### What the rename evicted

The final-heading field and its "Upwind" button were the last target-EDITING
left in the panel, and the map has owned the heading since the rotate handle
landed. They are gone. The keyboard keeps the heading, and gained a fine step
because five degrees is too coarse for lining up on a runway: `<` `>` are
still 5°, `,` `.` are 1°, `u` is still into wind. Settings gave up `,` and
took `shift+s` — expressible only because the Shift+X work made a shifted
letter its own combo.

Then the gap that leaves: a phone has no keyboard, and "Upwind" was a button.
Four placements were put to the owner (fold into the heading handle; a second
puck on the heading line; on the winds indicator; back in the Pattern panel).
He took the first. A CLICK on the rotate handle now snaps the heading into
wind — the handle already means "landing direction", it costs no pixels, and
the overlay's two gesture lines read as the sequence they are: hover the
target, click that handle.

That surfaced a real defect one layer down. **MapLibre's drag handle fired
`onClick` at the end of every drag** although the contract says "(no drag)":
it listens for a raw DOM `click`, which fires whenever mousedown and mouseup
land on the same element. Google's marker suppresses it; MapLibre does not.
Nothing had depended on it (the one existing `onClick` re-revealed an
already-revealed handle), so it had gone unnoticed — and this feature would
have snapped the heading into wind at the end of every rotate drag on that
provider.

Not implemented, and worth knowing: **there is no way to type an exact
heading any more.** If "set final to 247" ever matters, the hero card is
where it would go.

### Favorites and recents are one list

The design question the owner actually asked ("an intuitive way to do it")
has one fact behind it: **favorites and recents overlap.** A favorite you
used an hour ago is both, so two headed lists either show it twice or need an
invisible rule about which wins. One list dissolves that — saved places sort
first, recents follow, and the star on each row is simultaneously the marker
("this one is saved") and the control that moves a place between the halves.
Verified in the browser: starring a recent leaves exactly one row and drops
its history icon.

Recents are a new store and are **snapshots, not references**, unlike
favorites — which name a dropzone precisely so that corrections to the
database reach them. A recent cannot: it may be a geocoder hit, which is in
no database, and "that field I searched yesterday" is the case recents exist
for. Where a recent still resolves to a place, the place wins on re-selection
(it carries the per-mode config); where it does not, the snapshot is all
there is, and that is the point. Only the picker writes them: a preset load
also selects a place, and that is not somewhere you went.

### Search-first, and browsing by country

274 dropzones rendered unfiltered under the saved ones is not a list anyone
reads — and it is why two of `PlacePicker.test.tsx`'s cases carried a
15-second timeout. Idle now shows only your places; searching filters
everything and queries the geocoder as before; browsing is a disclosure
grouping every dropzone by country. 41 countries is a list. Both timeouts are
gone and the whole suite went from 31s to 9s.

### Three bugs the rework surfaced

Each has a test confirmed to fail without its fix:

- **Confirming a row's rename dialog also selected that row.** A portal
  renders elsewhere in the DOM but stays a CHILD in the React tree, so the
  click bubbled to the place row containing the dialog — and the row's job is
  to select the place. The `Menu` beside it already guarded this; `NameDialog`
  did not. Invisible until recents made selections leave a trace, which is
  the second time this session a new readout has exposed an old write.
- **Starring a dropzone removed it from "All dropzones".** `buildPlaces`
  moves a favorite into the saved group — right for search results, wrong for
  a list calling itself all: the count and the country totals went with it.
- **`DEFAULT_TARGET` sat ~250 ft and 90° from the ZHills entry it is paired
  with** by `DEFAULT_ACTIVE_PLACE_ID`. The hero card measures the target
  against its place, so a fresh install opened saying "target moved 258 ft
  from the dropzone" with nobody having moved it. The dropzone entry is the
  hand-checked one (it carries a `direction`), so it wins. Worth noting for
  the general case: the two were only ever *asserted* to be the same place,
  and nothing compared them until something displayed the difference.
