# FliP - Flight Planner

A flight planning tool for skydivers that calculates wind-corrected landing patterns. It takes user input for pattern parameters and target location, fetches wind forecasts at multiple altitudes, and displays the flight plan on a map showing both the ideal path and wind-adjusted path.

## Project Structure

```
/src/
├── App.js                    # Main application component and state management
├── index.js                  # React DOM entry point
├── components/               # UI components
├── forecast/                 # Wind forecast fetching modules
├── util/                     # Utility functions for geometry, wind, patterns
├── samples/                  # Sample GPS track files for manoeuvres
```

## Tech Stack

- **React 19** with hooks for UI and state
- **Material-UI (MUI) 7** for component library
- **Toolpad Core** for dashboard layout and localStorage state persistence
- **@react-google-maps/api** for map display
- **Turf.js** for geographic calculations (distance, bearing, rotation, translation)
- **D3** for vector math
- **fast-xml-parser** for XML parsing (ground wind data)
- **socket.io-client** for WebSocket communication (real-time wind data)

## Build & Run

```bash
npm start              # Development server on localhost:3000
npm run build          # Production build to /build folder
npm run lint           # ESLint check
```

## Application Flow

1. User defines a **pattern** (1, 2, or 3 legs with altitudes and descent rates)
2. User defines/uploads a **manoeuvre** (turn to final approach)
3. User sets a **target** (landing zone location and final heading)
4. User fetches or manually enters **wind** data at multiple altitudes
5. App calculates repositioned paths and applies wind corrections
6. Map displays two path lines:
   - Dashed line: Original path without wind
   - Solid line: Wind-corrected path

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| App | `App.js` | Main orchestrator, state management, navigation |
| MapComponent | `components/MapComponent.js` | Google Maps with flight path polylines |
| PatternComponent | `components/PatternComponent.js` | Landing pattern parameters UI |
| ManoeuvreComponent | `components/ManoeuvreComponent.js` | Manoeuvre source selection |
| TargetComponent | `components/TargetComponent.js` | Landing target and heading UI |
| WindsComponent | `components/WindsComponent.js` | Wind data table at various altitudes |
| SettingsComponent | `components/SettingsComponent.js` | App preferences |

## Utility Modules

| File | Purpose |
|------|---------|
| `util/util.js` | `reposition()`, `addWind()`, `averageWind()`, `mirror()` - core path transformations |
| `util/geo.js` | Turf.js wrappers for coordinate conversion, translation, rotation, wind application |
| `util/pattern.js` | `makePattern()` - generates landing pattern points from parameters |
| `util/manoeuvre.js` | `createManoeuvrePath()` - creates manoeuvre path from parameters |
| `util/wind.js` | `WindRow` and `Winds` classes for wind data with interpolation |
| `util/dropzones.js` | Dropzone database with coordinates and ground wind fetchers |

## Wind Forecast System

### Forecast Providers (`/src/forecast/`)

1. **OpenMeteo GFS** (`openmeteo.js`) - Fetches from `api.open-meteo.com/v1/gfs` with 17 pressure levels
2. **WindsAloft** (`windsaloft.js`) - Custom endpoint at `mustelinae.net/winds-aloft` with 10 altitude levels

### Ground Wind Fetchers (dropzone-specific)

- **CSC** (`csc.js`) - WebSocket GraphQL subscription
- **SDAZ** (`sdaz.js`) - XML fetch via proxy
- **Spaceland** (`spaceland.js`) - Socket.IO WebSocket

### Forecast Flow

`fetchForecast()` in `forecast.js` combines upper winds + optional ground wind observation. Ground wind is only fetched if the dropzone is within 5000 feet of the target.

## Wind Application Algorithm

In `geo.js` - `addWindTurf()`:

1. Path is processed backward from landing point to exit
2. Final point stays fixed at target
3. Each earlier point is offset based on:
   - Time difference from next point
   - Wind at that altitude (with optional interpolation)
   - Cumulative wind displacement

## Coordinate Formats

- **Flip Format** (internal): `{ lat, lng, alt, time, phase, pom, ... }`
- **Turf Format** (library): GeoJSON Point with properties
- **Google Maps**: `{ lat(), lng() }` functions

Conversions handled in `util/geo.js`: `toTurfPoint()`, `toFlipPoint()`, etc.

## State Persistence

Uses Toolpad's `useLocalStorageState()` to persist across sessions:
- Manoeuvre path
- Target location
- Pattern parameters
- Settings
- Location history
