# FliP - Flight Planner

A flight planning tool for skydivers that calculates wind-corrected landing patterns. It takes user input for pattern parameters and target location, fetches wind forecasts at multiple altitudes, and displays the flight plan on a map showing both the ideal path and wind-adjusted path.

A redesign toward a "next generation" architecture is in progress.
**Start at `docs/redesign/HANDOFF.md`** — it says where things stand, what's
next, the hard rules, and the environment gotchas. It points on to
ARCHITECTURE.md (target design + phase plan), BACKLOG.md (outstanding work),
NOTES.md (running log / why), and UIUX.md.

## Project Structure

All source is TypeScript.

```
/src/
├── App.tsx                   # Main orchestrator: routing, derivation wiring, panels
├── index.tsx                 # React DOM entry point
├── core/                     # PURE logic. No React, no DOM, no fetch, no map.
│                             #   geometry, pattern, manoeuvre, wind, flocking,
│                             #   flockingSolve, courses, pathStats, units,
│                             #   validation, model (versioned doc schemas)
├── data/                     # I/O: data/wind/ (WindSource plugins — openmeteo,
│                             #   soundings, stations/, compose, elevation)
├── map/                      # Map abstraction: MapAdapter + dispatch (primitives),
│                             #   google/, maplibre/ (providers — the ONLY places
│                             #   google.maps / maplibre-gl may appear),
│                             #   layers/ (declarative, provider-agnostic)
├── modes/                    # Declarative mode profiles (pattern/swoop/flocking)
├── components/               # UI panels, toolbar, map composition
├── hooks/                    # useAppState (context + localStorage), useWinds,
│                             #   useFlightPaths, useFlockingPath, useMode,
│                             #   usePresets, useUnits, useNotifications, ...
├── app/                      # routing helpers (URL scheme)
├── types/                    # Shared type definitions (types/index.ts)
├── samples/                  # Sample GPS track files for manoeuvres
index.html                    # Vite HTML entry (repo root)
vite.config.ts                # Vite + Vitest configuration
```

**Dependency rule** (enforced by review, currently clean):
`app → components/hooks → { core, data, map, modes }`, `data → core`,
`map → core`, `core → nothing`. `core/` must never import React, DOM,
I/O or map code; `map/layers/` must never import a concrete provider.

## Tech Stack

- **Vite** for dev server/build, **Vitest** for tests, **TypeScript 5**
- **React 19** with hooks for UI and state
- **Material-UI (MUI) 7** for component library
- **Toolpad Core** for dashboard layout and localStorage state persistence
- **@react-google-maps/api** for map display
- **Turf.js** for geographic calculations (distance, bearing, rotation, translation)
- **D3** for vector math
- **fast-xml-parser** for XML parsing (ground wind data)
- **socket.io-client** for WebSocket communication (real-time wind data);
  pinned to 2.5.0 — the Spaceland server speaks the socket.io v2 protocol

## Build & Run

```bash
npm start              # Vite dev server on localhost:3000 (PORT env overrides)
npm run build          # Typecheck (tsc --noEmit) + production build to /build
npm test               # Vitest, single run
npm run test:watch     # Vitest, watch mode
npm run lint           # ESLint over src/**/*.{ts,tsx} (0 errors required;
                       #   warnings are the known Phase-1 cleanup list)
```

Google Maps API key: set `VITE_GOOGLE_MAPS_API_KEY` (see `.env.example`).
Deploy: GitHub Pages via `.github/workflows/static.yml` (lint + test + build).

## Application Flow

1. User defines a **pattern** (1, 2, or 3 legs with altitudes and descent rates)
2. User defines/uploads a **manoeuvre** (turn to final approach) — swoopers
3. User sets a **target** (landing zone location and final heading)
4. User fetches or manually enters **wind** data at multiple altitudes
5. App calculates repositioned paths and applies wind corrections
6. Map displays two path lines:
   - Dashed line: Original path without wind
   - Solid line: Wind-corrected path

**Modes** (`src/modes/`) decide which of this is exposed — panels, map
layers, coarse `features`, setting defaults. The three are *Standard
Pattern*, *High Performance Landing* (adds manoeuvre + CP courses) and
*Flocking* (its own panel/derivation; see below). Features gate the rest:
e.g. only `swoop` has `patternLegCount`, so Standard Pattern hides the
leg-count selector and always flies the full three-leg pattern. A first-run picker
chooses one; it is remembered per device and switchable from the toolbar.
Each mode keeps its own target *position within a place*, but the place
itself is shared: choosing one in the picker (or loading a preset) moves
the target in every mode, while dragging it, shift-clicking and the
heading input affect only the current mode.

Additional features: presets, canopy-piloting courses (distance / zone
accuracy / speed, plus custom courses), observed ground-wind stations,
forecast time selection + hour scrubber, model/sounding comparison,
persisted winds, KMZ and FlySight 2 export. On the map: a compact
by-altitude **winds indicator** (`WindMiniIndicator`, corner overlay,
ground-wind detail on hover), a **wind-trust banner** (`WindTrustBanner` +
`core/windTrust` — none/manual/stale/fresh, hidden when fresh), and an
**always-draggable target** handle (no edit mode; drag to move, hover for
the heading-rotate handle, shift-click the map to jump it). Winds
auto-fetch on load and again whenever the target moves to a new place.

**Keyboard + help.** `core/keymap.ts` is one table driving both the key
handler (`hooks/useKeyboardShortcuts`) and the `?` overlay, gated per
mode; it also documents mouse gestures. `F` hides all chrome but the map.
`core/help.ts` holds the in-app reference as data — a topic per panel,
reached from each panel header's `?` (`/help?topic=<id>`) or the Help
nav item, which replaced About. The old measure tool and average-wind arrow
were removed (measure to be reimplemented — see BACKLOG).

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| App | `App.tsx` | Main orchestrator, path derivation, navigation |
| MapComponent | `components/MapComponent.tsx` | Google Maps: paths, tooltips, drag handles, stations, winds indicator |
| PatternComponent | `components/PatternComponent.tsx` | Landing pattern parameters UI |
| ManoeuvreComponent | `components/ManoeuvreComponent.tsx` | Manoeuvre source selection (params/track/samples) |
| TargetComponent | `components/TargetComponent.tsx` | Landing target and heading UI |
| PlacePicker | `components/PlacePicker.tsx` | One searchable list: saved places, dropzones, geocoder hits |
| HelpComponent | `components/HelpComponent.tsx` | In-app reference: topic list, drill-in; absorbed About |
| WindsComponent | `components/WindsComponent.tsx` | Wind table, forecast time picker, stations |
| CoursesComponent | `components/CoursesComponent.tsx` | Course selection and editing |
| SettingsComponent | `components/SettingsComponent.tsx` | App preferences |
| PresetSelector | `components/PresetSelector.tsx` | Save/load named setups |
| FlockingComponent | `components/FlockingComponent.tsx` | Flocking panel: classic/free/solve sub-modes |

## State Management

`hooks/useAppState.tsx` — React context. Configs (patternParams,
manoeuvreConfig, flockingParams, per-mode targets, settings) are the
source of truth, persisted via Toolpad's `useLocalStorageState` behind
**versioned codecs** (`util/storage.ts` + `migrate*` in `core/model.ts`,
which must never throw on bad data); flight paths are derived with
`useMemo`. Presets snapshot/restore these configs (`hooks/usePresets.ts`).

Settings resolution: mode defaults apply only to settings the user has
never changed — `flip.settings.touched` records explicit edits, so a
user can force a mode-overridden setting back to the global default.

## Core Modules (`src/core/`, all pure + unit-tested)

| File | Purpose |
|------|---------|
| `core/geometry.ts` | `translate()`, `reposition()`, `addWind()`, `averageWind()`, `straightenLegs()`, `mirror()` |
| `core/pattern.ts` | `makePatternByType()` — landing pattern from parameters |
| `core/manoeuvre.ts` | `createManoeuvrePath()`, initiation-altitude scaling |
| `core/wind.ts` | `WindProfile` data + pure helpers (`getWindAt`, vector interpolation, Beaufort, row provenance) |
| `core/flocking.ts` | Flocking math: path, into-wind, drift vectors, FWC spot description, jumprun line helpers |
| `core/flockingSolve.ts` | Analytic corridor solver: tiers + into-wind preference |
| `core/courses.ts` | Course geometry (buoys, gates, lines) |
| `core/pathStats.ts` | Per-leg/manoeuvre stats, `driftAngle`, `groundSpeedKts`, `cumulativeTurnDeg` |
| `core/units.ts` | Unit conversions + preferences (incl. mi/nm/km distances) |
| `core/validation.ts` | `LIMITS`, clamping, direction normalization |
| `core/model.ts` | Versioned document defaults + `migrate*` loaders |
| `core/places.ts` | Place list assembly + search ranking (`buildPlaces`, `rankPlaces`) |
| `core/keymap.ts` | Keyboard bindings + gestures; one table for handler and overlay |
| `core/help.ts` | Help topics as data (`HELP_TOPICS`, `topicForPanel`) |
| `util/dropzones.ts` | Dropzone database (58 entries; `direction` only where known) |
| `util/exportKmz.ts`, `util/exportFlySight.ts` | Exports (DOM/download side effects, so not in core) |

## Wind System (`src/data/wind/`)

Sources implement a `WindSource` plugin interface (`source.ts`):

- **OpenMeteo** (`openmeteo.ts`) — winds aloft at 27 pressure levels (to ~41k ft),
  selectable model, prefetches a ≥24 h window so hour-switching and the
  scrubber are local.
- **Soundings** (`soundings.ts`) — Iowa Environmental Mesonet RAOB.
- **Observed stations** (`stations/`) — NWS gridpoint discovery, CSC
  (GraphQL WS), Spaceland (Socket.IO); the nearest can be injected as
  ground wind (`useDzGroundWind`).
- `compose.ts` merges aloft + observed ground into the effective profile.
  `hooks/useWinds.ts` is the app-facing facade over all of it.

### Wind application algorithm

`core/geometry.addWind()`: the path is processed backward from the
landing point (held fixed); each earlier point is offset by the
cumulative drift, accumulated as a **flat east/north vector** (a polar
accumulation used to wander and visibly curved paths whose drift nearly
cancels the flown line — see NOTES).

## Flocking mode

`core/flocking.ts` + `hooks/useFlockingPath.ts` + `FlockingComponent` +
`map/layers/FlockingLayer.tsx`. Three sub-modes:

- **classic** — the original Flocking Wind Calculator model: pick the
  canopy flight direction, the jumprun IS that direction, one unique exit.
- **free** — you own the jumprun line (direction + lateral offset), the
  exit on it, and the canopy direction; the app reports where the jump
  ends and how far off target.
- **solve** — describe allowed jumprun *corridors* (nameable, individually
  enabled) and let `core/flockingSolve.ts` pick. Selection is NOT plain
  miss minimization: misses are tiered by the green/yellow rings and
  corridors that both reach green are separated by which run is most
  into the wind, which keeps the answer stable as a forecast drifts.

## Coordinate Formats

- **Flip Format** (internal): GeoJSON `Feature<Point>` with properties
  `{ alt, time, pom, phase }` (`FlightPoint` in `types/index.ts`)
- **Google Maps**: `{ lat, lng }` literals / `LatLng` interface

Conversions handled in `util/coords.ts` and `util/geo.ts`.
