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
