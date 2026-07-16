# FliP Next-Generation Redesign — Working Notes

Branch: `claude/flip-redesign-architecture-e767df`
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
