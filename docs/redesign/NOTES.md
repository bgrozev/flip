# FliP Next-Generation Redesign — Working Notes

Branch: `claude/flip-redesign-architecture-e767df`
Status: **Phase 0 complete** (2026-07-13, commit `e4df103`): CRA → Vite +
Vitest, TS 5, lint working and in CI, CLAUDE.md rewritten. Next: Phase 1
(core extraction & correctness; see `ARCHITECTURE.md`).

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
