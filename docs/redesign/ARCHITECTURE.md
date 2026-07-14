# FliP Next-Generation Architecture

Companion to `NOTES.md` (current state, owner answers) and `BACKLOG.md`
(organized feature/bug list). This document: target architecture, then the
migration plan.

## Design drivers

From the owner's goals:

| Driver | Consequence |
|---|---|
| Five audiences, one app | **Modes**: declarative UI profiles over one engine |
| Flocking calculator merge | Drift math joins the core; new mode + map layers |
| Static free tier AND optional accounts/paid tier | Core must run 100% client-side; backend is an *optional attachment*, never a dependency |
| PWA "phone app" | Offline-capable shell; cacheable data layer; mobile-first layouts |
| Logbook, plan-vs-jump, scoring | **Plan** and **Track** become first-class serializable documents |
| Soundings, station discovery, model choice | Pluggable **wind source** layer with per-row metadata |
| Map provider abstraction | Adapter interface; declarative map layers |
| Wind cones, long spot, expected GR | Shared **reachability/glide-integration** primitive in core |
| localStorage may break, but gracefully | Versioned schemas + validating loaders with fallback |

## Target structure

```
src/
├── core/                 # PURE TypeScript. No React, no DOM, no fetch.
│   ├── model/            # Versioned document schemas + validation/migration
│   │   ├── plan.ts       #   Plan: target, pattern, manoeuvre, winds snapshot,
│   │   │                 #         equipment, mode, notes, meta
│   │   ├── track.ts      #   Track: recorded GPS path + source metadata
│   │   ├── wind.ts       #   WindProfile: rows + per-row source/time metadata
│   │   └── ...           #   Settings, Course, Preset, Equipment/Canopy
│   ├── geometry/         # translate/rotate/mirror/reposition/addWind
│   ├── pattern/          # pattern generation
│   ├── manoeuvre/        # manoeuvre path creation/scaling
│   ├── drift/            # flocking math: wind drift, canopy drift, spot
│   ├── reach/            # glide integration: wind cones, long spot, expected GR
│   ├── analysis/         # track stats (vspeed, turn timing), plan-vs-track diff
│   ├── scoring/          # course scoring (distance/speed/zone-acc)
│   └── units/            # conversions, formatting
│
├── data/                 # I/O. Async, cache-aware, still framework-free.
│   ├── wind/             # WindSource plugin interface + implementations:
│   │   ├── openmeteo.ts  #   forecast models (model selection, multi-hour)
│   │   ├── soundings.ts  #   radiosonde soundings
│   │   ├── stations/     #   observed: NWS, CSC, Spaceland, auto-discovery
│   │   └── compose.ts    #   merge sources → effective WindProfile
│   ├── elevation.ts      # cached elevation lookup
│   ├── geocode.ts        # place search for target selection
│   ├── storage/          # StorageProvider interface:
│   │   ├── local.ts      #   localStorage/IndexedDB (static tier)
│   │   └── remote.ts     #   account sync (backend tier, later)
│   └── export/           # KMZ, FlySight, share-links, plan notes
│
├── map/                  # Map abstraction
│   ├── MapAdapter.ts     # interface: camera, markers, polylines, overlays,
│   │                     #   drag handles, hit-testing, rotation
│   ├── google/           # Google Maps implementation
│   └── layers/           # declarative layer components built on the adapter:
│                         #   flight paths, POMs, wind arrows, courses,
│                         #   stations, measure, drift/jumprun, wind cone
│
├── modes/                # Declarative mode profiles (data, not code):
│   │                     #   nav items, map layers, default settings,
│   │                     #   feature flags. Modes: pattern (default),
│   │                     #   swoop, flocking, coach, demo, free/explore
│   └── index.ts
│
├── features/             # React UI, one folder per feature:
│   ├── pattern/  manoeuvre/  target/  wind/  courses/
│   ├── flocking/  logbook/  coach/  analysis/  settings/
│   └── (each: panel components + feature-local hooks)
│
└── app/                  # Shell: routing (real URLs), layout, theme,
                          # mode switcher, store wiring, PWA setup
```

### Dependency rule

```
app → features → { core, data, map, modes }
data → core          map → core          core → (nothing)
```

`core/` is the product. Everything else is delivery. This is what makes
worker offloading, server-side reuse, CLI tools, and native wrappers
possible later without rewrites.

## Key decisions

### 1. Documents, not scattered state

Today state is ~8 independent localStorage keys. Tomorrow the unit is a
**Plan document** — one serializable object holding everything needed to
reproduce a plan (target, pattern, manoeuvre, wind snapshot + source
metadata, equipment, mode, notes, timestamps). Presets become saved Plans.
Exports serialize a Plan. Share-links encode a Plan in the URL. The logbook
stores Plans and attaches Tracks. Sync ships Plans. One schema, five
features.

Every document carries `schemaVersion`. Loaders validate; on unknown/broken
data they migrate what they can and default the rest (owner's requirement:
break old data *gracefully*).

Plain objects only — no class instances in state (current `Winds` class
goes away; becomes `WindProfile` data + pure functions).

### 2. Wind subsystem

```
WindSource (interface)
  id, label, kind: 'model-forecast' | 'sounding' | 'observed-station'
  capabilities: { hours?, models?, discovery? }
  fetch(location, opts) → WindProfile | StationObservation[]

WindProfile
  rows: { altFt, direction, speedKts, tempC?, source, validTime }[]
  meta: { model?, fetchedAt, location, elevationFt }
```

- `compose.ts` merges: aloft profile + ground observation + manual edits →
  effective profile. Replaces today's `effectiveWinds` clone-and-patch.
- Per-row source metadata → UI can badge observed vs forecast vs manual,
  show model name, attribute NWS.
- Fetch layer caches: elevation permanently per location; forecasts for
  several hours per call (local hour-switching); soundings by station+time.
- Interpolation fixed (shortest-arc for direction) and vector-aware
  (interpolate u/v components, not speed/direction independently).

### 3. Modes

A mode is data:

```ts
interface Mode {
  id: 'pattern' | 'swoop' | 'flocking' | 'coach' | 'demo' | 'explore';
  nav: NavItem[];              // which panels exist
  mapLayers: LayerId[];        // which layers render
  defaults: Partial<Settings>; // e.g. student pattern defaults
  features: FeatureFlag[];     // e.g. 'courses', 'manoeuvre', 'jumprun'
}
```

First run: "What are you planning?" picker. Mode switchable any time from
the toolbar; remembered per device. Coaches can share a preset+mode link to
students. Manoeuvre/Courses only exist in swoop mode; jumprun config only
in flocking/coach; etc. No engine changes per mode — only exposure.

### 4. Deployment tiers

- **Tier 0 (static, free, forever):** everything above, PWA, localStorage/
  IndexedDB. No accounts.
- **Tier 1 (backend-attached):** OAuth-ish auth, document sync (Plans,
  Tracks, presets, settings), logbook across devices; candidate paid
  features (long-term storage, team/coach sharing, advanced analysis).

Implementation: `StorageProvider` interface with `local` and `remote`
implementations; a sync engine reconciling the two (documents have ids +
updatedAt; last-write-wins per document is adequate initially). Feature
flags gate tier-1 UI. The static build simply ships without the remote
provider configured. Backend itself: small document store + auth (e.g.
managed service or thin API); decision deferred — the client-side interface
is what the architecture fixes now.

### 5. Map abstraction

`MapAdapter` exposes the primitives the app actually uses (markers,
polylines, ground overlays, drag handles, click/hover hit-testing, camera
incl. rotation). Layers are declarative React components that talk to the
adapter, not to `google.maps`. Google Maps remains the first adapter;
MapLibre becomes possible (matters for PWA offline tiles and cost).
This also forcibly dissolves the 1200-line `MapComponent`.

### 6. App plumbing

- **Build:** Vite + Vitest (CRA is unmaintained; unlocks TS 5.x, fast dev,
  first-class PWA plugin).
- **Routing:** real router with URLs (`/plan/pattern`, `/logbook/…`,
  `?mode=swoop`); deep links + browser back; share-links encode documents.
- **State:** single store (zustand or equivalent) holding documents +
  UI state; derived pipeline (`reposition → addWind → straighten → stats`)
  in memoized selectors — computed once per input change, not per render.
  If profiling ever demands it, the pure core pipeline can move to a Web
  Worker unchanged.
- **PWA:** service worker (app shell precache, tile/API runtime caching),
  manifest, install prompt; "last fetched winds" persisted with staleness
  banner when offline.

## Migration plan

Principle: **incremental, always shippable; each phase independently
releasable.** No big-bang rewrite — current app keeps working throughout.

**Phase 0 — Tooling (no behavior change)**
CRA → Vite + Vitest; TS 5.x; fix lint script (`.ts/.tsx`), re-enable lint in
CI; keep tests green. Update stale CLAUDE.md.

*Why:* CRA (`react-scripts`) is abandoned/deprecated — visible rot in this
repo already: TS pinned to 4.9, `DISABLE_ESLINT_PLUGIN=true` and
`GENERATE_SOURCEMAP=false` workarounds, hand-maintained jest
`transformIgnorePatterns` for ESM deps (turf/d3), audit noise. Vite is the
maintained default for client-side React; unlocks TS 5 (Phase 1 wants it),
Vitest (same test API, native ESM — the transform hack disappears), and
`vite-plugin-pwa` (Phase 5 depends on it). Alternatives rejected:
Next/Remix are server-rendering frameworks — wrong shape for a static
client-only app.

*Checklist:* swap `react-scripts` → `vite` + `@vitejs/plugin-react`;
`index.html` to root with module script; env vars `REACT_APP_*` → `VITE_*`
(Maps API key); Jest → Vitest, drop `transformIgnorePatterns`; `lint`
script covers `.ts/.tsx` and runs in CI/build; TS → 5.x; verify dev server,
prod build, tests, identical app behavior. ~1 day.

**Phase 1 — Core extraction & correctness**
Create `core/`; move `util/` + pattern/manoeuvre/wind math into it;
fix known bugs on the way (direction interpolation wrap, offset clamp,
mutation leaks); replace `Winds` class with `WindProfile` data + functions;
introduce versioned document schemas + validating loaders (graceful old-data
handling lands here); memoize the derive pipeline. App.tsx shrinks to
wiring.

**Phase 2 — Map layerization**
Introduce `MapAdapter` + split `MapComponent` into layer components on the
Google adapter. Pure refactor; unlocks per-mode layers and provider swap.

**Phase 3 — Router + modes**
Real router with URLs; mode profiles + first-run picker + toolbar switcher.
Existing UI becomes `pattern` + `swoop` modes. Ship: non-swoopers stop
seeing Manoeuvre/Courses.

**Phase 4 — Wind subsystem rework**
`WindSource` interface; port OpenMeteo + observed providers; composition
layer replaces `effectiveWinds` surgery; elevation cache; multi-hour
prefetch; model info/choice; soundings source; station auto-discovery.
Each source ships separately.

**Phase 5 — PWA**
Manifest + service worker + offline behavior. (Cheap after Vite.)

**Phase 6 — Flocking mode**
Port drift math into `core/drift/` (with tests mirroring FWC results);
jumprun config; drift/spot/jumprun map layers; FWC parity checklist; then
retire the FWC site with a redirect.

**Phase 7 — Documents & logbook (local)**
Plan document replaces scattered keys (presets → saved Plans); export/share
from Plans; Track import; logbook UI; analysis (`core/analysis/`) +
plan-vs-jump compare; multi-plot layer.

**Phase 8 — Backend tier**
Auth + document sync via `StorageProvider.remote`; logbook across devices;
tier gating. Static tier unaffected.

Phases 4–7 are reorderable; 1–3 are the foundation and should go first.
Backlog quick wins (bugs/polish in `BACKLOG.md`) can be interleaved any
time; the ones inside touched modules (interpolation, offset clamp,
elevation cache) ride along with their phase.

## Risks / open questions

- **Google Maps vs MapLibre for PWA offline:** offline tiles with Google are
  restricted by ToS; if offline maps matter, MapLibre + OSM/satellite
  provider is the way. Adapter keeps this decision cheap.
- **Toolpad shell:** DashboardLayout is convenient but constraining
  (mode-specific nav, bottom sheets on mobile). Phase 3 likely replaces it
  with plain MUI layout. Low risk, moderate effort.
- **Worker offload:** only if profiling shows need after memoization.
- **Backend choice** deferred deliberately; client interface is the contract.
- **Sync conflicts:** LWW per document is fine for single-user multi-device;
  coach/team sharing may need more later.
