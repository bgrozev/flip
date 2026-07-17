# FliP Backlog

Owner's raw idea/bug list, organized by scope. Companion to `NOTES.md`.
Status legend: ☐ open · ◐ partially done · ☑ believed done (verify) · ✎ needs clarification

Categories: **Bugs** → **Polish** (trivial UI/text fixes) → **Small features**
(days) → **Medium features** (weeks, self-contained) → **Large features**
(architecture-relevant) → **Ideas / research** (unscoped, needs design).

---

## Bugs

- ☑ **Manoeuvre-from-params offset bug** — FIXED Phase 1 (`85e967d`).
  `offsetXFt` = 0 now produces correct geometry (0.01 ft epsilon segment,
  needed because `setFinalHeading` derives direction from the last two
  points); negative offsets place the initiation point on the opposite
  side of the final-approach line. Tests cover positive/zero/negative.
- ✎ **Initiation altitude not saved?** — could not reproduce. The feature
  is live (`ManoeuvreAltitudeControl` → `initiationAltitudeOffset`,
  persisted via the versioned codec, applied in `computeManoeuvre`).
  Needs a concrete repro (which manoeuvre mode? what steps?) or close.
- ☑ **No input limits** — FIXED Phase 1 (`12c7dcf`). `core/validation.ts`
  clamps pattern/manoeuvre/wind/heading inputs; panels show red +
  helperText while typing and clamp on blur (e.g. 999999 → 3000).
- ☐ **Wind table number field too narrow** — custom values don't fit.
- ☐ **Winds tab: read-only first** — in the vast majority of uses the tab is
  read-only; the "unlock" button is used very rarely. Redesign around
  viewing (colors, source badges, summary); editing becomes an explicit,
  secondary mode. (Partly served: Beaufort dots + source badges landed.)
- ☑ **Wind direction interpolation wrap bug** — FIXED Phase 1 (`4e76aa4`).
  `getWindAt` now interpolates the wind vector (u/v components), so
  350°→10° goes through north and speeds cancel correctly.

## Polish (trivial)

- ☑ Rename "crab angle" → "drift angle" (owner chose this term, 2026-07-15).
  User-facing strings updated (Settings label/tooltip, map tooltip
  "Drift angle:"). To avoid a "Drift" collision, the existing wind-drift
  tooltip line is now "Wind drift:". Internal field/var names kept
  (`showCrabArrow`, `crabAngle`) to skip a settings migration — minor
  future cleanup if desired.
- ☐ Input fields UX — highlight/select content on click (focus behavior).
- ☐ Link to windy.com (at target/DZ coordinates, matching altitude?).
- ◐ Attribution for ground wind sources — observed stations already show
  the source with a link (e.g. "NWS · 17 min ago") after the Phase-4 wind
  rework. Forecast/model attribution shown as a source badge. Consider a
  small persistent credits line if more is wanted.
- ☐ Default pattern params → student-friendly: 3:1 glide, 8 kts descent
  (current default: 9 mph descent, 3.0 GR — confirm intended units kts vs mph).
- ☐ Ground speed in point hover popup. (Deferred during polish batch —
  needs the user's speed-unit formatter threaded into the map tooltip,
  which currently only receives an altitude formatter; not a one-liner.)
- ☐ "Degrees rotated" (cumulative turn) in map hover for manoeuvre points.
- ☑ Ground wind arrow displays gusts (commit `be587a1`) — verify.
- ☑ Ground wind arrow Beaufort colors (commit `be587a1`) — verify.
- ◐ Beaufort colors elsewhere — wind table rows DONE (`185c2d8`, color dot
  per speed in the read-only table, shares `core/beaufortColor` with the
  map arrows). Wind summary (top bar AVG/GND) still uncolored.
- ☐ Icon next to DZs/locations that have ground wind (observed stations) available.

## Small features (days)

- ☐ **Export: winds as note + user notes field** — append wind table + free
  text to exported plan (KMZ/FlySight/etc.). Notes field on export dialog.
- ☐ **Improved KMZ export** (owner: unspecified what; gather wishes). ✎
- ☐ **Density altitude display** — needs temp/pressure (OpenMeteo has it).
- ☐ **Temperature readings/forecast display** — same data fetch as above.
- ☐ **Distance course: more markers** (120 m etc.) — render only when zoomed in.
- ☐ **Preset UX** — explicit "none"/default preset, clearer active-preset
  indication, dirty state. ✎ discuss desired behavior.
- ☑ **Cache elevation** — DONE Phase 4 (`c7d3776`); cached per rounded
  location via the versioned codec, no TTL.
- ☑ **Prefetch forecast for next few hours** — DONE Phase 4 (`99f6313`).
  One request fetches ≥24h (up to 168h); hour switching is local, cache
  keyed on location+model with a 30-min TTL; explicit refresh forces.
- ☑ **OpenMeteo model info** — DONE Phase 4 (`186c555`). Badge shows
  "OpenMeteo · <model> · valid <time>"; model selectable in Settings
  (best_match / GFS / ICON / ECMWF, all verified against live responses).
- ☐ **More pattern legs** (>3).
- ☐ **Course stats display** — distance to gates, angle vs course direction.
- ☐ **Measure tool: render line lengths** on the segments.
- ◐ **Map avg + ground wind arrows** — ground wind arrow near target exists
  (commit `0ea8894`); avg-wind arrow exists as setting. Owner wants both,
  maybe gated on observed wind availability. Review current state vs wish. ✎
- ☑ **De-couple ground wind from dropzones** — DONE Phase 4 (`0694842`).
  `fetchObservedStations(location)` resolves stations from coordinates via
  NWS gridpoint discovery; dropzone `nearbyStations` remains only as an
  AWOS supplement (e.g. KM08, which discovery misses), deduped.

## Medium features (weeks, self-contained)

- ☑ **Soundings as wind source** — DONE Phase 4 (`59fb9ec`). Iowa
  Environmental Mesonet RAOB (CORS-verified); nearest online station +
  newest-synoptic-with-fallback; selectable as the aloft source.
- ☑ **Weather station auto-discovery** — DONE Phase 4 (`0694842`). NWS
  `/points/{lat},{lon}` → gridpoint stations; verified live at a non-DZ
  location (Denver: 44 stations).
- ☐ **Improve DZ/target selection UI** — search, favorites, map-pick flow.
- ☐ **Expected GR & ground speed up high** — e.g. "at 4000 ft heading south
  expect GR 1.5" for comparison against wrist GPS in flight. Table/overlay
  of expected GR/speed by altitude+heading.
- ☐ **Generic "free"/explore mode** — Google-Earth-like: measure, annotate,
  drop markers; make measure tool actually useful.
- ☐ **Canopy + wing loading input** — pick canopy model + WL instead of raw
  GR/descent rate; canopy presets database. (Also serves student mode.)
- ☐ **Map rotation** — allow rotating map (north-up off); wind arrows and
  overlays need correction.
- ☐ **Long spot calculator** (coaching use-case) — how far out can students exit
  and still make it back: glide from exit alt vs winds. Related to wind cones.
- ☐ **Wind cones** — area reachable from current altitude flying in any
  direction given winds. Big safety/teaching value. Related: long spot.
- ☐ **Direction overlays** — average-wind arrow overlay, degree-circle
  (compass rose) around target.
- ☐ **Turn drift calculation** — drift accumulated during the turn itself.

## Large features (architecture-relevant)

- ☑ **Modes** — DONE Phase 3 (`d018bfe`, `340b7ae`). `src/modes/` declares
  modes as data (nav / mapLayers / defaults / features). `pattern` and
  `swoop` live; `flocking` + `explore` are disabled stubs. First-run
  picker, toolbar switcher, `?mode=` links, route guard, persisted via the
  versioned codec; user config survives mode switches.
  **Not a mode: coaching.** Owner (2026-07-13): a coach is just a user who
  switches between many setups (students, swoopers, flocking groups) —
  that's presets/plans, not a separate UI profile. Requirements instead:
  fast preset switching, and (future, tier 1) sharing presets between
  accounts. Note swoopers also keep multiple presets (per canopy).
- ☐ **Shareable setup links** — ⭐ owner-prioritized. A URL that opens an
  exact setup (target, pattern, manoeuvre, winds?, mode, possibly course).
  Needs a design session before building. Open questions ✎:
  - Encoding: whole Plan compressed into URL fragment (no server, links
    work forever, but long URLs and size limits — tracks won't fit) vs
    hosted snapshot (short links, anything fits, but requires storage
    with a permanence promise) vs hybrid (embed small stuff, host blobs).
  - Custom courses are small parameter sets → embeddable; built-in courses
    referenced by id. What else must be referencable "forever"?
  - What does the receiver get: read-only view, or "load into my app"
    (or both: preview → apply)?
  - Winds: share the snapshot, or refetch live at open time? (Probably
    both, labeled.)
- ☑ **Phone app = PWA** — DONE Phase 5 (`3c529d5`). vite-plugin-pwa:
  manifest + icons (any/maskable), service worker precaching the app shell
  with navigateFallback (offline route loading), NetworkFirst runtime
  caching for OpenMeteo/NWS/IEM so the last forecast survives offline.
  Google tiles intentionally uncached (ToS) — see MapLibre offline-tiles
  follow-up. Pending: higher-res brand icons (owner art).
- ☐ **Flocking mode** — beyond a port of flocking-wind-calculator.
  (Owner: plan in detail when we get there; wishlist so far:)
  - map plot: drift vectors, exit spot(s), jumprun line
  - jumprun configuration (direction, aircraft airspeed, groups/separation?)
  - parity checklist vs FWC: display drift, display average wind,
    "rotate into wind" action
  - **standard vs reverse build** — standard keeps aircraft direction;
    reverse does a 180 after deployment. Spot calculation for both.
  - **jump profiles** — today: fly straight. Add "runback" (leader resets
    behind the group ≈ full 360; estimate altitude/ground it consumes) and
    more complex patterns (turns at specified altitudes).
  - **quick handoff to landing planning** — flocking landings are fairly
    standardized; one tap from flocking plan → landing pattern with
    specific params.
  - **"don't cross" line / altitude-colored reachability zones** — green:
    comfortably make pattern entry from here; yellow: only by optimizing
    glide; red: can't. Same `core/reach/` primitive as wind cones.
- ☐ **XRW planning** — similar to flocking (wingsuit + canopy flying
  together); differences: may want a **90° jumprun** option, different
  speed/glide envelope. Design alongside flocking mode.
- ☐ **Logbook** — save complete plans (winds, time, settings, equipment),
  attach actual jump tracks later, compare plan vs jump. Foundation for
  scoring + analysis features.
- ☐ **User accounts + sync** — tracks, settings, presets synced across
  devices. Possible paid feature. Requires backend tier (NOTES.md §3.3).
- ☐ **Track analysis: quick manoeuvre stats/graphs** — max vspeed, altitude
  of max vspeed, time in turn, time in rollout, etc. Lightweight FlySight-
  Viewer-alternative for the common questions.
- ☐ **Multi-plot** — plot multiple jumps, or jump + plan, on one map.
- ☐ **Plan-vs-jump comparison** — automated comparison, possibly scored.
- ☐ **FlySight Viewer 2 integration** — "Open in viewer" button opening the
  viewer with a specific jump + plan loaded. Viewer 2 is an independent
  **desktop C++ app**; changes would go upstream. Options, in order of
  increasing upstream cooperation:
  1. FliP already exports plans in FlySight 2 track format — user downloads
     plan file, opens it in the viewer as another track (works today,
     manual file shuffle).
  2. **Custom URL scheme** — viewer registers a protocol handler (e.g.
     `flysight://open?...`); FliP's button launches the installed app with
     references to plan/track files (downloaded to a known location, or
     fetched by the viewer from a URL). Standard web→desktop handoff;
     needs an upstream PR.
  3. First-class "plan" concept upstream — distinct styling/comparison vs
     recorded tracks.
  Complements plan-vs-jump comparison: FliP does quick stats + scoring,
  viewer does deep analysis. ✎ gauge upstream maintainer interest first.
- ☐ **VCPS integration** (vcps.mustelinae.net — Virtual CP Series, owner's
  own platform: track upload + scoring for canopy piloting) — submit
  tracks to VCPS directly from FliP, e.g. "Submit to VCPS" on a track in
  the logbook. Owner controls both sides, so unlike the FlySight Viewer
  item this needs no third party: add an upload API + auth (token) to
  VCPS. Synergies ✎ to decide later:
  - shared scoring logic (FliP's "automated scoring" item) — score
    locally in FliP core vs authoritative scoring server-side in VCPS?
  - equipment metadata (canopy/size/WL) overlaps the planned canopy
    presets — one shared equipment description?
  - could VCPS accounts double as FliP tier-1 accounts (single sign-on)?

## Ideas / research (needs design)

- ☑ **MapLibre adapter** — DONE (2026-07-15, commits `bb2d5ec`…`b3885cb`).
  Second provider switchable in Settings; ESRI World Imagery satellite (no
  key); maplibre-gl confined to `src/map/maplibre/`; primitives are
  provider dispatchers. Follow-ups below.
  - ☑ MapLibre interaction spot-check (2026-07-15): verified in-browser —
    target drag handle moves the target (functional, not just visual),
    measure tool places points + shows distance ("658 ft"), map controls
    render (pointer-events fix), polylines + POM labels draw, zero console
    errors. Courses/tooltips/wind-arrows reuse the same validated
    primitives (MapPolyline/MapOverlay/MapControl/useMapClick) — not
    separately exercised but low-risk.
  - ☐ Offline PWA tiles via MapLibre — the original motivation. ESRI tiles
    are not currently precached by the service worker; wire runtime tile
    caching (respecting ESRI terms) so MapLibre works offline.
  - ☐ Map rotation (MapLibre supports it natively) — wire the rotation
    control + correct wind-arrow overlay for bearing (see "Allow map
    rotation" item).

- ☐ **Conditions delta since last jump** — "what changed since you last
  jumped": wind shift, direction change. Needs jump-time snapshots
  (logbook dependency).
- ☐ **Zone-acc entry speed solver** — compute speed decay to position for a
  55 mph gate entry. Needs a canopy speed-decay model. ✎ research.
- ☐ **Automated scoring: distance & speed courses** — from a track, compute
  official-style scores (gates, window, etc.).
- ☐ **"Wind code" above pattern** — fuzzy pattern-entry indication instead of
  a precise point. ✎ clarify concept.

---

## Phase-1 follow-ups (found during implementation, 2026-07-13)

- ☐ Extend versioned codecs to remaining unversioned storage:
  `flip.locations.custom` (CustomLocationsComponent), stored tracks
  (ManoeuvreTrackComponent), simple string keys.
- ☐ `setManoeuvreAltitude` (`src/core/manoeuvre.ts`) appears dead outside
  tests — confirm and remove.
- ☐ Manoeuvre param naming: `offsetXFt` is labeled "Back" (depth),
  `offsetYFt` "Offset" (lateral) — rename fields in a future schema
  version to match the labels.
- ☐ `createSafeCodec`/`createSimpleCodec` in `src/util/storage.ts` unused
  by app code after step 6 — remove once nothing else adopts them.
- (Same-path nav toggle flakiness — already covered by Phase 3 router work.)

## Phase-2 follow-ups (found during implementation, 2026-07-14)

- ☐ Target-edit handles overlap at mid zoom — heading handle's hit area
  beats the target handle when ~10px apart; needs separation or
  hit-priority for the target handle.
- ☐ `attachPlaceAutocomplete` re-attaches on every callback identity change
  with no listener cleanup (pre-existing bug, carried over) — effect should
  return a disposer; ref-stabilize the callback.
- ☐ Built-in courses are geographically anchored (e.g. Skydive Arizona);
  selecting one far from target shows nothing — add "jump to course".
- ☐ Leg tooltip body rows low-contrast over dark map theme — styling pass.

## Phase-3 follow-ups (found during implementation, 2026-07-14)

- ☐ Mode defaults resolution uses equals-global-default heuristic — a
  user can't Settings-force a mode-overridden value back to the global
  default (it re-applies the mode default). Replace with explicit
  "touched settings" tracking or per-mode overlays when defaults grow.
- ☐ Settings panel shows stored (not effective) values — add "set by
  mode" indicators; consider hiding swoop-only settings in pattern mode.
- ☐ `SECONDARY_PANELS` (Settings/About) split hardcoded in App.tsx —
  fold into the Mode shape as nav groups.
- ☐ Presets don't carry their mode yet (ARCHITECTURE: Plan carries mode)
  — part of the Phase-7 Plan document work.
- ☐ Selecting a course doesn't pan the map to it (pre-existing; more
  visible now) — same as the "jump to course" Phase-2 item.
- ☐ Mode picker cards are unnamed buttons (no accessible name) — a11y
  fix: aria-label per card.

## Phase-4 follow-ups (found during implementation + spot check, 2026-07-15)

- ~~Past forecast time → silent empty table~~ **(retracted — not a bug).**
  Initial spot-check hit this by calling the WindSource directly with a
  negative hourOffset, bypassing the app. In the real UI both the fetch
  hook (`Math.max(0, …)`, useFetchForecast.ts) and the picker
  (`next < minDate → null`, WindsComponent.tsx) clamp past times to "now",
  and fetch populates normally. Verified in-browser: table fills, source
  badge "OpenMeteo · Best match · valid …", NWS station discovery live.
- ☐ Remove now-redundant `KZPH` from ZHills `nearbyStations` (gridpoint
  discovery covers it; `KM08` still needs its supplement).
- ☐ Forecast-time picker is shown but inert for soundings (they ignore
  `hourOffset`) — hide or repurpose it in sounding mode.
- ☐ Elevation cache eviction is insertion-order, not true LRU — fine at
  500 entries; revisit only if it grows.
- ☐ Soundings can be dense in the low-altitude band — consider thinning
  levels for the table if it feels noisy.

## Process / engineering health

- ☐ **Improve documentation** — CLAUDE.md is stale (rewrite in Phase 0);
  add user-facing docs/help as features land.
- ☐ **Update dependencies** — general refresh; largest blocker (CRA → TS,
  jest, eslint) falls out of Phase 0. Then keep current routinely.
- ☐ **Grow test coverage continuously** — add tests whenever possible,
  especially before refactoring a module (migration phases 1–4 must land
  with tests that pin existing behavior first). Reduces risk of breaking
  working code.
- ☐ **Better usage observability** — replace Google Analytics. Owner wants
  suggestions; revisit later. Candidates:
  - **Plausible / Umami** — privacy-first page+event analytics, no cookie
    banner, lightweight script; both self-hostable (mustelinae infra) or
    cheap hosted. Good GA replacement for "how many users, which modes".
  - **PostHog** — product analytics (funnels, feature usage, retention),
    self-hostable; heavier but answers "do people use the wind scrubber".
  - **Matomo** — closest to GA feature-wise, self-hosted, aging UX.
  - Separate concern worth adding regardless: **error tracking** (Sentry
    or GlitchTip self-hosted) — today client errors vanish.
  Fit: event taxonomy per mode/feature; static tier must work with
  analytics blocked; PWA offline queueing nice-to-have.
- ☐ **Deployment note** — long-lived redesign branch deploys to
  **flip-next.mustelinae.net** for testing; merge to main deferred.

## Cross-cutting observations

- Analysis cluster (logbook, multi-plot, stats, scoring, plan-vs-jump,
  conditions delta) is a coherent second pillar of the app: **Plan** vs
  **Review**. Architecture should treat tracks as first-class data.
- Wind cluster (soundings, station discovery, model info, prefetch hours,
  temp/DA) argues for a **pluggable wind-source layer** with metadata
  (source, model, valid time, observed vs forecast) per row.
- Wind cones + long spot + expected-GR share one primitive: **reachability /
  glide integration against the wind profile**.
