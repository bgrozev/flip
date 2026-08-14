# src/map — map abstraction

Structure:

```
map/
├── MapAdapter.tsx   # provider-neutral contracts: primitive component props,
│                    #   contexts, hooks (useMapClick/useMapCursor/useMapZoom),
│                    #   MapControl
├── google/          # Google Maps implementation of the contracts
├── layers/          # feature layers built on the primitives
└── index.ts         # public surface; binds the active provider
```

## The import rule

**`src/map/google/` is the only place allowed to import
`@react-google-maps/api` or reference the `google.maps` namespace.**

Layers and app code import primitives from `src/map` (the package index)
and layers from `src/map/layers`. Nothing outside `google/` may depend on
a concrete map provider — this is what keeps a future provider swap
(e.g. MapLibre for PWA offline tiles) cheap.

## Primitives

- `MapContainer` — the map itself: camera center (pans when the prop
  changes), API loading, and the providers for the contexts below.
- `MapPolyline`, `MapCircle` — geographic vector primitives (`dotted`
  polylines; circles sized in meters with hover/click events).
- `MapOverlay` — arbitrary DOM anchored at a geographic position, in a
  pane that receives pointer events.
- `MapDragHandle` — draggable circular handle for direct manipulation.
- `MapControl` — screen-anchored DOM (buttons, HUD) over the map.
- `useMapClick(handler, { enabled, priority })` — map background clicks;
  the highest-priority enabled handler wins (measure=10 beats edit=0).
- `useMapCursor(cursor | null)` — cursor override while active.
- `useMapZoom()` — current zoom (e.g. course markers only at zoom >= 20).

## Layers

Declarative feature layers, each owning its interaction state (hover,
drag previews, measure points): `FlightPathsLayer`, `CourseLayer`,
`CourseEditLayer`, `TargetEditLayer`, `StationsLayer`, `MeasureLayer`.
`components/MapComponent.tsx` is a thin composition of `MapContainer` +
these layers. The average-wind HUD arrow (`WindDirectionArrow`) is a
plain screen-space component rendered through `MapControl`.
