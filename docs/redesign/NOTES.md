# FliP Next-Generation Redesign — Working Notes

Branch: `claude/flip-redesign-architecture-e767df`
Status: **Phase 0 — understanding the project.** Awaiting the owner's list of
long-term goals/ideas before drafting the architecture.

This file is the running log of the redesign effort. It will grow into:

1. High-level architecture for future goals
2. Migration plan (incremental, non-breaking)
3. UI/UX improvements
4. New feature ideas
5. Flaws found in code / approach

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

## 3. Open questions for the owner

1. **Users & audience** — who uses FliP today (just you? your DZ? public
   swooper community)? Rough user count? Primary persona: competitive
   canopy pilots, or general skydivers planning patterns?
2. **Platform priorities** — desktop-web vs. phone at the DZ? Any interest
   in installable PWA / offline support / native app?
3. **Backend appetite** — everything is client-side + localStorage today.
   Are accounts, sync, sharing links, or a server component acceptable in
   the future architecture, or is "static hosting only" a hard constraint?
4. **Compatibility constraints** — must existing users' localStorage data
   survive the migration? Is the current URL (single-page, no routes)
   linked anywhere that matters?
5. **Tooling freedom** — OK to migrate CRA → Vite, upgrade TS, add a
   router? Any attachment to Toolpad/MUI dashboard shell?
6. **Google Maps** — happy with Google Maps (API key, cost), or is a
   switch/abstraction (MapLibre etc.) worth considering?

---

## 4. Architecture proposal

*(pending goals list)*

## 5. Migration plan

*(pending)*

## 6. UI/UX improvements

*(pending)*

## 7. Feature ideas

*(pending)*
