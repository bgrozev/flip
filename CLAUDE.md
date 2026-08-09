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

**Nerd mode** (`src/modes/nerd.ts`) is a global flag (`settings.nerd`,
off by default), *not* a mode: a mode answers "what jump am I planning",
nerd answers "how much UI do I want", and they cross. It is applied as a
transform over the active mode — `withNerd()` widens `features`/`nav`, so
`hasFeature`, the nav, the map layers and the keymap gate on it for free
— plus `applyNerdGate()`, which forces the nerd-only settings to their
everyday values at App's `modeSettings` choke point. That value is
`DEFAULT_SETTINGS` unless listed in `NERD_OFF_OVERRIDES`, so hiding a
switch never silently changes the path math; unlike mode defaults the
gate ignores `flip.settings.touched`. Behind it: manual wind entry
(Unlock / Invert / Reset), both exports, pattern-point hover tooltips
(`pointTooltips` — POM hover used to ignore its setting), and nine
settings including interpolation, leg straightening and the map
provider. The wind source/model dropdowns are nerd-only too, but their
*values* are deliberately not masked — the comparison table lets any user
pick the active source, and a setting may only be masked while every
control that writes it is behind the same gate. Toggle at the top of Settings; a NERD
chip in the toolbar while it is on. Adding an item is one line in
`NERD_FEATURES` or `NERD_SETTING_KEYS`.

**The manoeuvre is a turn onto final, described in the final heading's
frame** — not relative to the target. The final heading is fixed by the
target, so the parameters are what a turn is actually free to choose:
`turnDirection` (which way you rotate), `rotationDeg` (90 / 135 / 270 /
450 / custom), `depthFt` (how far back you start, along the final heading,
positive away from the target) and `offsetFt` (how far to the side, on the
side you turn FROM). The entry heading is derived, so odd rotations work
and changing a sign moves a point instead of rotating the whole manoeuvre
— which the previous offsetX/offsetY/`left` model did, because it folded
the offset's sign into the final bearing. Measuring the offset on the turn
side is what makes flipping left/right mirror the turn; the absolute
convention is not merely unintuitive but unflyable, since a turn cannot
start across its own final line and still arrive on it.

**The drawn curve is an ILLUSTRATION**, and the panel says so. The numbers
fix where the turn starts and how far it goes; they say nothing about its
shape, and a real canopy turn is not a circle. `solveManoeuvre()` draws it
at a nominal 200 ft radius and takes up the slack with straight legs: the
turn is cut at every heading at a right angle to final, and a straight may
be inserted at each joint as well as at both ends. Those directions are the
four axes of the final-approach frame, so between them they absorb any
displacement — a deep setup stretches the final approach, a negative offset
stretches the entry, a 270 starting past the target becomes turn-straight-
turn. Two straights always suffice, and the solver takes the LATEST valid
pair (length only breaks ties), so slack lands on the final approach rather
than partway round. Pairs must be at least 5 degrees apart and the total is
capped: near a half turn the entry heading is the reverse of the final one,
and solving that pair used to run away past the edge of the globe. The radius is tightened (by bisection) only when
the setup is smaller than the nominal. Some setups cannot be drawn at all —
a 90 can neither start past the target nor across the final line — and
`reaches` reports that for the panel to warn about. Past 270 the radius
shrinks along the sweep so big turns spiral instead of crossing themselves.

Two invariants worth keeping: the entry and final headings read back
exactly (each end carries a straight longer than one track sample —
`reposition` builds the pattern's final leg on the entry heading), and the
**wind drift over the turn depends only on altitude and duration**, not on
the shape. The second is why the track is resampled at uniform TIME steps:
altitude is linear in time, so the drift integral is shape-independent, but
`addWind` sums over the segments it is handed and geometric sampling put
those at shape-dependent times.

Not every setup can be drawn, and the fields say so rather than letting the
map disagree with them: `manoeuvreBounds` bisects on `reaches` to find the
feasible depth and offset range (each with the rest of the turn held where
it is), those bounds reach the input element so the spinner stops at the
edge, and the binding edge is spelled out under the field.

`correctPatternHeading` applies only to tracks and samples, which are often
a few degrees off; a parametric turn knows its entry heading exactly.

**The initiation point is a drag handle** (`ManoeuvreEditLayer`), and is
the primary way to set a turn up — depth and offset are a position, and a
position is a thing you point at. Always live, parametric turns only. It
rides the **still-air path** — the dashed pre-wind line — because that is
the frame the turn is described in: you set the turn up in still air and
the wind correction is what FliP hands back. On the corrected path it was
an input dressed as a result, and the drop had to have the drift taken
back out of it before `placeInitiation` could read the numbers off.
(Harmless arithmetic, as it happens: the drift over the turn depends only
on altitude and duration, so it is the same vector wherever the handle is
dropped.) `placeInitiation` projects the drop onto the final-approach axis
and clamps to the same feasible bounds the fields use, one axis at a time.
The handle withdraws within 26 px of the target's so it never eats its
drags.

`describeManoeuvrePath` measures all of this back OFF a path, so recorded
tracks and samples are described the same way. `ManoeuvreHintLayer` draws
the entry arrow and rotation (`showManoeuvreHint`) and the final approach
line (`showFinalApproachLine`), each separately switchable.

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
heading input affect only the current mode. Places also *remember*: a
dropzone's stored coordinates are only a starting point, so the spot you
shift-click to is recorded against that place (`flip.targets.byPlace`,
keyed by `Place.id`, with the active one in `flip.place.active`) and
restored next time you pick it. Flocking's pinned Spot Reference and its
jumprun corridors ride along in the same record: the reference is the only
other absolute coordinate in the app, so it unpins on a move (one left at
the old DZ produced spots thousands of miles out) and comes back with its
place. Targets belonging to no place — a preset, a geocoder hit — pass no
place id and are not remembered.

**"No place" is stored explicitly** (`NO_PLACE`, the empty string). It
cannot be stored as null: `useLocalStorageState` encodes null as *delete
the key*, and a missing key reads back as that key's DEFAULT — which for
`flip.place.active` is ZHills. So picking a geocoder hit used to leave the
app believing it was at ZHills, and every later edit (a target drag, a
pinned Spot Reference, a new course) was recorded against that dropzone;
choosing it later handed the foreign coordinates back, which is what a
"1652 mi prior" spot was. `flip.place.active` is the only key with a
non-null default that is ever set to null, so it is the only one with this
hole. Reading a place's memory is also **bounded** (`nearbyMemory`): a
remembered target or Spot Reference further than 25 mi from the place it
belongs to is treated as damage and dropped, which heals storage already
written by the bug.

A dropzone can also declare where each mode *starts*
(`Dropzone.modes`, keyed by mode id): a swoop pond away from the student
LZ, a flocking end point out in the big field, and for flocking the DZ's
jumprun corridors and canonical Spot Reference (the landmark a spot is
quoted against to the pilot). Anything omitted falls back to the
dropzone's own coordinates and heading, and what the user did at a place
always outranks what the dropzone declares, and "Reset to default" in the
Corridors section throws those edits away. Corridors never travel: a place
that declares none and has no edits has none. Speeds, window altitudes and
the ring radii stay out of the DZ data on purpose — they describe the
flock, not the place.

Pattern params are per-mode too (`flip.pattern.byMode`, falling back to
the shared legacy `flip.pattern.params`): a swooper's descent rate and
long legs describe their canopy, not the student pattern next to it.

**Courses belong to a place.** A course is a fixed set of buoys in one
pond, so `CourseParams.placeId` (a `Place.id`) scopes both the shipped
courses in `core/courses.BUILT_IN_PARAMS` and the user's own — one field,
one filter, no special-casing. The Courses panel lists only what is at
the active place, grouped under its name, as a **radio list** rather than
a dropdown (there are only ever a handful, and Duplicate/Delete then live
on the rows instead of inside an open menu). **"New" is a type menu** —
Distance / Zone Accuracy / Speed — which creates the course already named
for its type (`defaultCourseName`, numbered if taken) and pointed along
the target's final heading, because the type is the first real decision
and used to be two levels down inside Edit. The selected course's own
controls render **inline under its row**, not in a section further down.
Positioning a course on the map is an **explicit mode** ("Position on
map"): a course centre is usually within metres of where you land, so
its drag handles sit on top of the target's and one set has to yield —
while it is on the target is not draggable. It is off by default and
resets whenever the selection changes. Below the list, **Relative
Position** (depth / offset / approach angle, one field per line) places
the turn against the course.
Choosing another dropzone drops a selection that belongs to the one being
left (`selectPlaceTarget`), since it is meaningless there and the map
camera would chase it. Two escapes keep that lossless: a course with no
`placeId` — every custom course saved before this existed — belongs
nowhere and is offered everywhere, and a preset records the place it was
saved at (`Preset.placeId`), restoring dropzone and course together with
`PlaceSelection.useGivenTarget` so the preset's own target still wins over
what that place remembers.

Additional features: presets, canopy-piloting courses (distance / zone
accuracy / speed, plus custom courses), observed ground-wind stations,
forecast time selection + hour scrubber, model/sounding comparison (which
follows the selected hour),
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
`X` flips the pattern's turns; `Z` (or `Shift+X`) mirrors the MANOEUVRE —
`core/manoeuvre.mirrorManoeuvre` decides what that means per type: flip
`turnDirection` for a parametric turn (the offset is measured on the turn
side, so nothing else moves), flip `sampleLeft` for a sample, and mirror
the points of a recorded track, which carries no handedness. A shifted
letter is its own combo (`shift+x`), keyed off `shiftKey` so caps lock
still types plain letters — the cost is that `Shift+P` no longer opens the
Pattern panel.
`core/help.ts` holds the in-app reference as data — a topic per panel,
reached from each panel header's `?` (`/help?topic=<id>`) or the Help
nav item, which replaced About. The old measure tool and average-wind arrow
were removed (measure to be reimplemented — see BACKLOG).

## UI conventions (one way to do each thing)

The panels had drifted into three numeric fields, five section headings,
two disclosure styles, three reset idioms and thirteen map-label styles.
The shared pieces below are the whole vocabulary; reach for one before
writing a new look.

| Thing | Use | Notes |
|---|---|---|
| A number | `components/NumberField` | Floating label, unit inside, helper text free for a bound. Bounds required (`limits`) unless the value is cyclic (`wrap`), and the type enforces the choice. 220px alone; `fullWidth` when sharing a row. |
| A section | `components/PanelSection` / `SectionHeading` | Uppercase caption, optional action on the heading row. The Accordion (Flocking) is only for sections long enough to be worth collapsing. |
| A folded section | `components/DisclosureRow` | Chevron carries the state, so the label never renames itself. |
| A panel title | the App panel header | Panels never render their own — Courses used to, and said "Courses" twice. Panel-scoped actions (Wind's refresh, Courses' New) go in the header or on a section heading. |
| A button | `contained` in dialogs only | `outlined` for a panel's own action, `text` inline, `size="small"` throughout. |
| A reset | text button, gated | Shown only when there is something to restore, with a `describeChild` tooltip naming what — without that flag MUI makes the tooltip the button's accessible NAME. |
| A map label | `map/layers/labelStyles.mapLabel()` | One background, one radius, three sizes (`sm` annotates, `md` is default, `lg` is an answer). Colour is meaning; nothing else varies. |

Panels are left-aligned by their container (`App.tsx`), not by each
component: the container used to centre text and every panel undid it by
hand.

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
| `core/manoeuvre.ts` | `solveManoeuvre()` + `createManoeuvrePath()` (the turn), `describeManoeuvrePath()` (measure one back), initiation-altitude scaling |
| `core/wind.ts` | `WindProfile` data + pure helpers (`getWindAt`, vector interpolation, Beaufort, row provenance, `sampleWindBands` for the shared by-altitude summary, `forecastHourOffset`) |
| `core/flocking.ts` | Flocking math: path, into-wind, drift vectors, FWC spot description, jumprun line helpers |
| `core/flockingSolve.ts` | Analytic corridor solver: tiers + into-wind preference |
| `core/courses.ts` | Course geometry (buoys, gates, lines); `BUILT_IN_PARAMS`, the per-place filter (`coursesForPlace`, `courseIsAtPlace`) and naming (`courseTypeLabel`, `defaultCourseName`) |
| `core/pathStats.ts` | Per-leg/manoeuvre stats, `driftAngle`, `groundSpeedKts`, `cumulativeTurnDeg` |
| `core/units.ts` | Unit conversions + preferences (incl. mi/nm/km distances) |
| `core/validation.ts` | `LIMITS`, clamping, direction normalization (`normalizeDirection` absolute, `normalizeRelativeAngle` signed) |
| `core/model.ts` | Versioned document defaults + `migrate*` loaders |
| `core/places.ts` | Place list assembly + search ranking (`buildPlaces`, `rankPlaces`); place ids (`dropzonePlaceId`, `placeNameFromId`) |
| `core/regions.ts` | State/country short forms, so "az" finds Arizona |
| `core/keymap.ts` | Keyboard bindings + gestures; one table for handler and overlay |
| `core/help.ts` | Help topics as data (`HELP_TOPICS`, `topicForPanel`) |
| `modes/nerd.ts` | Nerd-mode flag: `withNerd()` mode transform, `applyNerdGate()` settings mask |
| `util/dropzones.ts` | Dropzone database (274 entries; `direction`, `website`, `town`/`region`/`country` and per-mode config only where known) |
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

**The no-wind ghost is drawn from the exit** (`anchorAtExit` in
`useFlockingPath`). The model builds both paths sharing an END, because
`addWind` holds the landing point and accumulates the drift backwards —
right for measuring, wrong for drawing: the ghost then started at the exit
you would have needed in still air, which is nobody's exit, and ended on
the target, which is where the wind puts you. Translated onto the real
exit it reads as the jump being planned — leave here, no wind, end up
there — and the gap at the far end IS the drift. Only the drawn path
moves; `flockingVectors` and `averageWind` keep the end-aligned pair,
since both measure the gap between the two.

**The spot is the output**, so it is treated as one: "Jumprun 248˚ · 3.41
mi prior · 0.42 mi left" is written by `core/spotText.formatSpot()` and
nothing else, and every surface that says it reads that one function —
the panel's sticky **SpotHero** (display type, first thing in the panel,
stays put while the inputs scroll), the **top bar**, which in flocking
shows the spot INSTEAD of the wind summary (the map's winds indicator
already carries GND and the bands; the pilot handoff outranks them), and
the map's pill label at the exit. Two readouts rounding the same distance
differently would be a bug, so they cannot be built separately.
`useCopySpot` hands it on — clipboard, or the share sheet where the
platform has one — from the top bar and the hero, and reports failure
rather than pretending. The copy text is the spot alone: the reference
point is agreed offline, and the corridor name and the forecast time are
FliP's business, not the aircraft's. The map label is deliberately NOT
clickable: map overlays live in Google's `overlayLayer` pane, which takes
no mouse events, and the interactive panes sit above every marker — a
clickable label would shadow the drag handles beside it. `verdict`
("MISSES by 0.80 mi") sits beside the spot on every surface but never
inside the copied line; it describes the jumper's own setup, not where
the plane should fly.

## Coordinate Formats

- **Flip Format** (internal): GeoJSON `Feature<Point>` with properties
  `{ alt, time, pom, phase }` (`FlightPoint` in `types/index.ts`)
- **Google Maps**: `{ lat, lng }` literals / `LatLng` interface

Conversions handled in `util/coords.ts` and `util/geo.ts`.
