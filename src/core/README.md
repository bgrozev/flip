# src/core — pure flight-planning logic

Pure TypeScript only. **Nothing in `core/` may import from `react`,
`components/`, `hooks/`, `forecast/` (I/O), or map code.** Allowed imports:
other `core/` modules, `types/`, and pure third-party libraries (turf, d3).

`core/` is the product; everything else is delivery. Keeping it pure makes
worker offloading, server-side reuse, CLI tools and native wrappers possible
without rewrites (see `docs/redesign/ARCHITECTURE.md`).

| Module | Contents |
|---|---|
| `geometry.ts` | translate, setFinalHeading (rotate), mirror, reposition, addWind, straightenLegs, averageWind, bearings/distances |
| `pattern.ts` | landing-pattern generation |
| `manoeuvre.ts` | manoeuvre path creation/scaling |
| `wind.ts` | WindProfile data type, interpolation, compose, source ids |
| `units.ts` | unit conversions and formatting constants |
| `coords.ts` | FlightPoint ↔ LatLng conversions |
