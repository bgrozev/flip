# FliP - Flight Planner

A flight planning tool for skydivers that calculates wind-corrected landing patterns. It takes user input for pattern parameters and target location, fetches wind forecasts at multiple altitudes, and displays the flight plan on a map showing both the ideal path and wind-adjusted path.

A redesign toward a "next generation" architecture is in progress — see
`docs/redesign/` (NOTES.md, ARCHITECTURE.md, BACKLOG.md, UIUX.md).

## Project Structure

All source is TypeScript.

```
/src/
├── App.tsx                   # Main orchestrator: routing, path derivation, wiring
├── index.tsx                 # React DOM entry point
├── components/               # UI components (panels, map, toolbar)
├── hooks/                    # State: useAppState (context + localStorage),
│                             #   useFetchForecast, useObservedWind, usePresets,
│                             #   useCustomCourses, ...
├── forecast/                 # Wind forecast + observed-wind station providers
├── util/                     # Pure-ish logic: geometry, wind, pattern, manoeuvre,
│                             #   courses, csv, exports, units, validation
├── types/                    # Shared type definitions (types/index.ts)
├── constants/                # Map styles, shared constants
├── samples/                  # Sample GPS track files for manoeuvres
index.html                    # Vite HTML entry (repo root)
vite.config.ts                # Vite + Vitest configuration
```

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

Additional features: presets, canopy-piloting courses (distance / zone
accuracy / speed, plus custom courses), observed ground-wind stations,
forecast time selection, KMZ and FlySight 2 export, measure tool.

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| App | `App.tsx` | Main orchestrator, path derivation, navigation |
| MapComponent | `components/MapComponent.tsx` | Google Maps: paths, tooltips, drag handles, stations, measure tool |
| PatternComponent | `components/PatternComponent.tsx` | Landing pattern parameters UI |
| ManoeuvreComponent | `components/ManoeuvreComponent.tsx` | Manoeuvre source selection (params/track/samples) |
| TargetComponent | `components/TargetComponent.tsx` | Landing target and heading UI |
| WindsComponent | `components/WindsComponent.tsx` | Wind table, forecast time picker, stations |
| CoursesComponent | `components/CoursesComponent.tsx` | Course selection and editing |
| SettingsComponent | `components/SettingsComponent.tsx` | App preferences |
| PresetSelector | `components/PresetSelector.tsx` | Save/load named setups |

## State Management

`hooks/useAppState.tsx` — React context. Configs (patternParams,
manoeuvreConfig, target, settings) are the source of truth, persisted via
Toolpad's `useLocalStorageState`; flight paths are derived with `useMemo`.
Presets snapshot/restore these configs (`hooks/usePresets.ts`).

## Utility Modules

| File | Purpose |
|------|---------|
| `util/util.ts` | `reposition()`, `averageWind()`, `straightenLegs()` — core path transformations |
| `util/geo.ts` | Turf.js wrappers: translation, rotation, mirror, `addWind()` |
| `util/pattern.ts` | `makePatternByType()` — landing pattern from parameters |
| `util/manoeuvre.ts` | `createManoeuvrePath()` — manoeuvre path from parameters |
| `util/wind.ts` | `WindRow` and `Winds` classes with interpolation |
| `util/courses.ts` | Course geometry (buoys, gates, lines) |
| `util/pathStats.ts` | Per-leg/manoeuvre stats for map tooltips |
| `util/dropzones.ts` | Dropzone database with coordinates |
| `util/exportKmz.ts`, `util/exportFlySight.ts` | Exports |
| `util/units.ts` | Unit conversions and preferences |

## Wind System

### Forecast (`/src/forecast/`)

- **OpenMeteo GFS** (`openmeteo.ts`) — winds aloft at 17 pressure levels;
  `fetchForecast()` in `forecast.ts` is the entry point.

### Observed ground wind stations

- **NWS** (`nwsObserved.ts`) — nearby official stations
- **CSC** (`csc.ts` / `cscProvider.ts`) — WebSocket GraphQL subscription
- **Spaceland** (`spaceland.ts` / `spacelandProvider.ts`) — Socket.IO
- `observedWind.ts` — provider registry; `useObservedWind` hook consumes it.
  Nearest station can be injected as ground wind (setting `useDzGroundWind`).

### Wind application algorithm

In `geo.ts` — `addWind()`: path is processed backward from the landing
point (which stays fixed at the target); each earlier point is offset by
cumulative wind drift based on time deltas and wind at that altitude
(optionally interpolated between rows).

## Coordinate Formats

- **Flip Format** (internal): GeoJSON `Feature<Point>` with properties
  `{ alt, time, pom, phase }` (`FlightPoint` in `types/index.ts`)
- **Google Maps**: `{ lat, lng }` literals / `LatLng` interface

Conversions handled in `util/coords.ts` and `util/geo.ts`.
