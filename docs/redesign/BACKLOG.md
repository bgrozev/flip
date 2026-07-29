# FliP Backlog

Owner's raw idea/bug list, organized by scope. Companion to `NOTES.md`.
Status legend: ☐ open · ◐ partially done · ☑ believed done (verify) · ✎ needs clarification

Categories: **Bugs** → **Polish** (trivial UI/text fixes) → **Small features**
(days) → **Medium features** (weeks, self-contained) → **Large features**
(architecture-relevant) → **Ideas / research** (unscoped, needs design).

---

## UX analysis (2026-07-22)

From a walkthrough of the running app across all modes, desktop + mobile.
Full write-ups in `docs/ux/pain-points.md` (Pn items) and
`docs/ux/roles-and-tasks.md` (role/task inventory, cross-cutting concerns).
Items below are the *specific* actionable findings; each notes the source
tag. Some overlap existing entries elsewhere in this file (cross-referenced).

**Top 3 to fix first** (pain-points.md): P1, P6, P2 — in that order.

### Not-intuitive / teaching

- ◐ **P1 · Explain dashed vs solid path** (tasks 13/14; UIUX #6/#7) —
  it now has a HOME: the Help panel's "How FliP works" topic opens with a
  drawn dashed/solid legend (`core/help.ts`, `pathLegend` block). Still
  open: the owner's own words for it, and an affordance ON the map (a
  legend or a first-run pointer) — the panel only helps someone who goes
  looking. **Still top priority for the map-side half.**
- ☑ **P2 / F4 / task 53 · Propagate the "not jump-real" signal to all
  modes** — DONE. Unified the flocking no-wind text and the top-bar
  "verify conditions" badge into one top-of-map status banner
  (`WindTrustBanner`), driven by a pure `core/windTrust` verdict, shown in
  every mode and hidden when the forecast is fresh. See the trust-state
  concern below for what remains.
- ☑ **P9 · Hide the leg-count selector in Standard Pattern** (task 9) —
  DONE. New `patternLegCount` mode feature: `swoop` has it, `pattern` does
  not. Standard Pattern hides the NONE/1/2/3 group and always flies three
  legs (`core/pattern.withFullPattern`, applied on read in App so a
  swooper's stored choice survives a trip through the simple mode). The
  pattern path is now derived in App rather than `useAppState`, which had
  no way to know the mode.
- ☐ **P4 / F1 · Mode-filter the Settings panel** — modes gate nav + map
  layers but not Settings; a Standard-Pattern student sees forecast model,
  interpolate, drift arrows, map provider, etc. Gate settings rows by
  mode/feature.
- ☐ **P3 / F3 · Wind panel read-only-first** — the empty state shows an
  editable manual row alongside FETCH FORECAST; ambiguous which is intended.
  Same ask as the existing "Winds tab: read-only first" (Bugs).
- ☐ **P5 · Surface course Type up front** — "+ NEW" makes a generic course;
  the Distance/Zone/Speed Type selector is buried two levels into Edit.
  Type is the first real decision. Also label Depth/Offset/Approach-angle
  meanings.

### Harder-than-necessary

- ◐ **P6 / F5 · DZ discovery** (tasks 1–3) — FIRST VERSION DONE. The
  three-tab Locations panel became one search box over one list
  (`components/PlacePicker.tsx` + pure `core/places.ts`): saved places
  first, then the 58 dropzones (44 of them ported from FWC), then the
  geocoder's hits in the same list. Star a dropzone to pin it; custom
  places rename / move / delete in place. Geolocation now exists
  (`hooks/useGeolocation.ts`) behind a "Nearest dropzone" button — opt-in,
  never prompts on load, and every failure path leaves the list working.
  Google Places moved to a promise API and now loads without the map,
  which is what makes search work on mobile at all.
  Still open ✎: distances/nearest-first ordering were deliberately left
  out (owner: not useful); recents and DZ country/region are below.
- ☑ **The dropzone changed when switching modes** (owner report,
  2026-07-26) — FIXED. Per-mode targets are deliberate, but a *place* is
  not per-mode: `setTargetEverywhere` now backs place selection (picker,
  nearest-dropzone, preset load) and clears the per-mode overrides, while
  drag / shift-click / heading stay per-mode.
- ☐ **Re-selecting the active preset does nothing** (spotted while
  verifying the above) — `PresetSelector.handleSelect` skips `onSelect`
  when the id is already active, so once you have wandered off a preset
  there is no way to reload it. Pre-existing; wants a "revert to preset"
  affordance rather than just dropping the guard.
- ☐ **P7 / F2 · Mobile: panels page-swap the map** (UIUX #3) — opening any
  panel on mobile replaces the map, breaking see-while-editing. (The
  top-bar + WINDS-indicator refresh already work from the map view.)
- ☐ **P8 / task 40 · Jumprun handoff copy/share** — the flocking
  deliverable ("Jumprun 0° · 3.61 mi prior") is read-only text; no way to
  copy/share to the pilot. The one output flockers exist for isn't
  exportable.
- ☐ **F6 · Mobile Wind panel density** — desktop-shaped layout, large empty
  space below COMPARE SOURCES on a phone.
- ☐ **task 14 · "Why did the pattern shift" teaching affordance** — the key
  teaching gap; build in pattern/swoop for everyone (also a coach need).

### Cross-cutting concerns (design-level, architecture-relevant)

- ◐ **Trust / planning-validity state** (task 53; owner requirement) —
  FIRST VERSION DONE: `core/windTrust` aggregates into one verdict
  (`none` / `manual` / `stale` / `fresh`) covering no-fetch, manual/
  inverted/unlocked winds, forecast-time far from now, and stale fetch age;
  rendered as a top-of-map `WindTrustBanner` (form chosen: banner, hidden
  when fresh, manual flagged amber). Also fixed a related bug: unlocking
  winds flips the profile to manual and used to drop the top-bar avg/gnd
  summary — now the summary shows for any real wind, fetched or manual.
  Still open ✎: explicit out-of-bounds / "silly manual value" call-out
  (validation clamps are silent); tuning the stale-age threshold; whether
  to also tint the `WindMiniIndicator` by level.
- ☐ **Accounts & sync** (task 38a; owner monetization vector) — sync the
  persisted documents (presets, custom locations, settings, saved plans)
  behind an identity; anchor case = swooper's laptop→phone loop. Needs a
  backend/auth/account model (none exist). Candidate paywall; free/paid line
  TBD. Ties into share-links (49), saved reports (47), annotations (48).
- ☐ **"Nerd" mode** (owner-approved, name = **Nerd Mode**) — a data-first
  mode enabling manual wind selection/invert and export (KMZ + FlySight
  CSV), and more TBD. Reframes the disabled `explore` stub around
  winds-aloft + data rather than "swoop-minus"; pairs with the trust
  indicator. Next step: the concrete `Mode` object + a winds-aloft/data
  panel. (Coach stays *not* a mode — parked unless a projector layout is
  wanted.)

### New monetizable/report items (owner interest)

- ☐ **task 47 · Shareable report (PDF / image)** — for demo/coach.
- ☐ **task 48 · Map hazard drawing / annotations** — for demo.
- ☐ **Reconcile export paths** — FlySight CSV is the toolbar dialog (whole
  path); KMZ lives only in the Courses panel (course-scoped). No general
  path→KMZ from the toolbar (tasks 45/46).

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
- ☑ **Compact winds indicator outside the Wind panel** (owner request) —
  DONE. `components/WindMiniIndicator.tsx`, a map-corner overlay (via the
  `MapControl` portal) visible in every mode. Expanded: a column of GND +
  the plan-relevant bands (flocking window top/bottom, or the pattern leg
  altitudes — `keyWindAltitudesFt` in App), each with a Beaufort-coloured
  downwind arrow, direction and speed, plus the forecast hour in the
  header. Collapses to a ground-wind chip (state persisted under
  `flip.ui.windIndicatorCollapsed`); tapping the body opens the Wind
  panel. Gated by the new `displayMapWinds` setting (default on).
  Browser-verified: GND+300 at ZHills, collapse/expand + persistence, tap
  → /wind. Follow-ups ✎: hide when winds are the empty manual default;
  owner may want different default bands.
- ☐ **Wind table number field too narrow** — custom values don't fit.
- ☐ **Winds tab: read-only first** — in the vast majority of uses the tab is
  read-only; the "unlock" button is used very rarely. Redesign around
  viewing (colors, source badges, summary); editing becomes an explicit,
  secondary mode. (Partly served: Beaufort dots + source badges landed;
  per-row source indicators landed too — see below.)
- ☑ **Per-row source indication in the wind table** — DONE. Read-only rows
  show a muted provenance icon (cloud = forecast/sounding, pencil =
  manually entered) and the observed-station ground row a green sensors
  icon, with detail (station id, age) in the tooltip.
  `core/wind.windRowSourceKind` classifies row provenance, with tests.
  Closes the ARCHITECTURE §2 ask; browser-verified (NWS ground row
  distinct from OpenMeteo rows).
- ☑ **Wind direction interpolation wrap bug** — FIXED Phase 1 (`4e76aa4`).
  `getWindAt` now interpolates the wind vector (u/v components), so
  350°→10° goes through north and speeds cancel correctly.

## From the 2026-07-28 session

- ☐ **Import the owner's dropzone list, then curate all of it** — agreed as
  the next session's task; he has the file. See HANDOFF "Next up: the
  dropzone import" for the invariants an import has to satisfy and the
  conventions to keep straight. Absorbs the "landing headings for the
  imported dropzones" item below.
- ☐ **Dropzone `timezone`** — deferred, not rejected. Forecast times render
  in *browser* local time, so a coach or traveling jumper planning a DZ two
  zones away is reading the wrong clock. One IANA string per entry.
- ☐ **A `verified` flag on dropzone entries** — "hand-checked against
  imagery" is currently *inferred* from the presence of `direction`, which
  conflates two different facts (we know the heading / we trust the
  coordinates). Worth making explicit as part of the import.
- ✎ **Move the default corridors off ZHills** — `DEFAULT_FLOCKING_PARAMS.
  solveCorridors` is the ZHills N/S pair, which is now also declared on the
  ZHills entry itself. Decide whether the app-wide default should be empty.
- ☐ **Temperature aloft** — the ground reading is done; per-level
  temperature is available (`temperature_{hPa}hPa`, and soundings already
  carry it) and would give density altitude at altitude, not just at the
  DZ.
- ☐ **Group the place picker by region** — the data now exists; only the
  grouping is missing.

## Polish (trivial)

- ☐ **Round altitude/number display in both feet and metres** — labels and
  readouts should land on round numbers in the active unit (e.g. 1000 ft
  ↔ ~300 m shown as a clean 300 m, not 305 m), rather than converting an
  exact value and showing an odd figure. Affects POM altitude labels, the
  winds indicator, tables, hovers. Pick round-number targets per unit.
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
- ☑ Ground speed in point hover popup — DONE. `core/pathStats.
  groundSpeedKts` (tested): centered difference over the two adjacent
  path points, single-sided at the ends. Displayed in the point tooltip
  via the user's wind-speed unit formatter (browser-verified: 23.2 kts
  became 11.9 m/s after switching the unit setting).
- ☑ "Degrees rotated" (cumulative turn) in map hover for manoeuvre points —
  DONE. `core/pathStats.cumulativeTurnDeg` (tested, incl. 360°-wrap and
  >180° sums) + `headingDeltaDeg`; point tooltip shows e.g. "Rotated:
  87° left" for manoeuvre-phase points. Browser-verified with the
  Sample 90 manoeuvre (4° right at +2 s, 87° left at the end).
- ☑ Ground wind arrow displays gusts (commit `be587a1`) — verify.
- ☑ Ground wind arrow Beaufort colors (commit `be587a1`) — verify.
- ◐ Beaufort colors elsewhere — wind table rows DONE (`185c2d8`, color dot
  per speed in the read-only table, shares `core/beaufortColor` with the
  map arrows). Wind summary (top bar AVG/GND) still uncolored.
- ☐ Icon next to DZs/locations that have ground wind (observed stations) available.

## Small features (days)

- ◐ **Keyboard shortcuts** — FIRST VERSION DONE. `core/keymap.ts` is one
  table that the handler (`hooks/useKeyboardShortcuts`) and the `?` overlay
  (`components/ShortcutsOverlay`) both read, so the list cannot drift from
  the bindings; entries are gated by panel/feature/heading so each mode
  binds and lists only its own. Bound: panel letters (P/M/T/W/C/G/`,`),
  modes 1-3, `R` refresh, `[`/`]`/`\` forecast hour, arrows nudge the
  target (shift = coarse), `<`/`>` heading, `U` upwind, `E` export, `S`
  presets (then 1-9), `F` hides everything but the map, `Esc` steps back,
  `?` the list. Map gestures are documented in the overlay too. A one-time
  "press ?" hint shows on desktop (`components/ShortcutHint`).
  Still open ✎: flocking-specific bindings (rotate jumprun, step the exit
  along it, cycle sub-mode, toggle a corridor); map zoom is left to the
  provider. `G` for the flocking panel is the one awkward key — `F` went to
  focus-map, which is global and more guessable; flip it in the table if
  the owner prefers.
- ☐ **Export: winds as note + user notes field** — append wind table + free
  text to exported plan (KMZ/FlySight/etc.). Notes field on export dialog.
- ☐ **Improved KMZ export** (owner: unspecified what; gather wishes). ✎
- ☑ **Density altitude display** — DONE (`7c3b867`). Pure `core/atmosphere`
  (ISA pressure from elevation, virtual temperature for humidity, inverted
  ISA density relation); shown in the Wind panel, top bar and map
  indicator, tinted by delta above field elevation. Temperature and
  humidity flow with it, preferring the observed station over the
  forecast; NWS humidity is derived from temp+dewpoint.
- ◐ **Temperature readings/forecast display** — GROUND temperature is done
  with the above. Still open: temperature *aloft* (OpenMeteo can return
  `temperature_{hPa}hPa` per pressure level, and soundings already carry
  it per row) and anything forecast-shaped beyond the selected hour.
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
- ☐ **Measure tool — REMOVED, to be reimplemented.** The old MeasureLayer
  (ruler button + click-to-add points + cumulative distance) and its
  `showMeasureTool` setting / `measure` map layer were deleted (owner
  wants a fresh take later). When rebuilt: also render per-segment line
  lengths, not just cumulative.
- ☑ **Wind time scrubber** — DONE. MUI Slider under the forecast-time
  picker; range = hours the prefetch cache covers from now
  (`openmeteo.prefetchedWindowHours`, tested — mirrors the fetch's own
  freshness rules), exposed via `useWinds.scrubHours`. Scrubbing sets the
  forecast time + refetches, which the cache serves locally; scrubbing to
  a non-now hour clears observed injection exactly like the picker.
  Hidden for soundings (with the picker) and until a fetch fills the
  cache. Browser-verified: dragging 0→+12h swung the table/profile with
  zero fetch() calls (instrumented); back to "now" refired only NWS
  station discovery, as the picker does.
- ☑ **Persist last winds + staleness banner** — DONE. The wind profile
  (fetched or manual) persists under versioned key `flip.winds`
  (`core/model.migrateStoredWinds`, tested: revives Dates from JSON,
  tolerates garbage). The source badge shows "· fetched N min ago";
  past 30 min it turns warning-colored and grows a "refresh" link.
  Browser-verified: fetched table and manual edits both survive reload.
  Interim until Plan documents (Phase 7).
- ☐ **Replay animation** — animate a dot along the plan (later: a recorded
  track) over time. Teaching/demo value; cheap over the memoized paths.
  (2026-07-16 review.)
- ☐ **Better wind visualization (perhaps windy-like)** — the wind table
  and the single ground arrow are a poor picture of a wind field. Explore
  a windy.com-style rendering: animated particle streaks / flow lines
  over the map, a colour ramp for speed, and the ability to see the
  profile change with altitude (tie into the altitude band the plan
  actually uses). ✎ design; owner request 2026-07-19.
- ✎ **Side profile view** — altitude-vs-distance elevation plot of the
  plan below the map (pure SVG from existing path data; no map provider
  involved). Explains descent/glide better than top-down. Owner wants to
  understand the concept better first — sketch/demo before building.
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
- ◐ **Improve DZ/target selection UI** — search, favorites, map-pick flow.
  In progress: see P6 / F5 above. Deferred out of that work, owner's call:
  - ☑ **Country/region on dropzone entries** — DONE (`779afff`), and it
    became `town`/`region`/`country` plus a shared abbreviation table
    (`core/regions.ts`) rather than per-entry keywords, which was the
    owner's original framing. Search scores each field separately and
    drops subsequence-only hits once anything matches properly, so "eloy"
    stops returning Skydive Pink Klatovy. Also shown as the picker's
    subtitle. Data: country on all 59, region on all US/CA, town on 34 —
    the towns are unverified and want a spot-check during curation.
    Grouping by region is still not implemented.
  - ☐ **Recently used places** — a short recents list/chips in the place
    picker's empty state. Favorites cover most of this need.
  - ☐ **Landing headings for the imported dropzones** — the 44 entries
    ported from FWC have no `direction` (and ~100 m coordinates). Selecting
    one sets the final heading into the wind instead. Promote them as they
    get checked against imagery.
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
  (2026-07-16: build the shared `core/reach/` primitive *before* Phase 6 —
  flocking's reachability zones want the same math.)
- ☐ **Direction overlays** — average-wind arrow overlay, degree-circle
  (compass rose) around target.
- ☐ **Turn drift calculation** — drift accumulated during the turn itself.
- ◐ **Model/sounding comparison view** — FIRST PASS DONE; visualization
  design open for owner iteration. What landed:
  - Data: `openmeteo.fetchOpenMeteoComparison` (tested) fetches any model
    read-only w.r.t. the prefetch cache — serves from it when the model
    matches, never stores, so a comparison sweep can't evict the window
    behind the scrubber. `useWindComparison` fetches all 4 models + the
    nearest sounding concurrently; per-source failures degrade to a note.
  - Math: `core/windCompare` (tested): profiles sampled on a 0..limit
    500 ft ladder with the app's own vector interpolation; no upward
    extrapolation (sparse sources like ECMWF show "—" above their top
    row); named thresholds DIRECTION_DISAGREEMENT_DEG=15,
    SPEED_DISAGREEMENT_KTS=5, and DIRECTION_MIN_SPEED_KTS=3 (directions
    of near-calm winds are noise, not disagreement).
  - UI: "Compare sources" toggle in the wind panel → read-only table,
    one column per source (Best/GFS/ICON/ECMWF/station id), per-cell
    direction arrow + speed in the user's unit, disagreeing bands
    highlighted, spread in the row tooltip. Active profile untouched.
  - Live-verified at ZHills: 4 models + _TBW sounding side by side;
    ECMWF's 5-level coverage interpolates cleanly; ground band flagged.
  Open for iteration ✎: visual form (arrows vs barbs vs mini-hodograph),
  compare at the selected forecast hour instead of "now", per-cell
  outlier emphasis, showing sounding age more prominently.

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
  - 2026-07-16 proposal as design-session input: compressed Plan in the
    URL fragment (lz-string; ~500 bytes without tracks), permanent, no
    server; receiver gets a preview → "apply" flow; hosted snapshots
    deferred until the Phase-8 backend exists anyway.
- ☑ **Phone app = PWA** — DONE Phase 5 (`3c529d5`). vite-plugin-pwa:
  manifest + icons (any/maskable), service worker precaching the app shell
  with navigateFallback (offline route loading), NetworkFirst runtime
  caching for OpenMeteo/NWS/IEM so the last forecast survives offline.
  Google tiles intentionally uncached (ToS) — see MapLibre offline-tiles
  follow-up. Pending: higher-res brand icons (owner art).
- ◐ **Flocking mode** — beyond a port of flocking-wind-calculator.
  (2026-07-17: the FWC port itself is DONE — commits `8e67e98`,
  `85f6c81`, `5d9acd8`, `be85cee`, `244e567`; see NOTES.md Phase 6.
  FWC parity checklist: display drift ☑ · display average wind ☑
  (toolbar avg over the window + per-POM wind in hover) · rotate into
  wind ☑ (Into-wind toggle with live resolved degrees). The wishlist
  below remains open.) What landed:
  - ☑ core math `src/core/flocking.ts` (tested, DriftTest.kt parity +
    closed-form uniform-wind pipeline check): `makeFlockingPath` (1 s
    steps, POMs inserted exactly at round altitude multiples, interval
    parameterized for metric), `intoWindDirection`, `flockingVectors`
    (wind/canopy/combined), `spotDescription` (FWC prior/PAST +
    left/right conventions line-for-line, incl. FWC's PAST side flip).
    Wind application deviates from FWC deliberately: FliP's `addWind`
    (vector interpolation) instead of the per-level stepwise sum.
  - ☑ params document: `FlockingParams` (window top/bottom ft, descent +
    horizontal mph, direction number | 'into-wind', distance unit
    mi/nm/km, optional reference point) with FWC defaults, LIMITS
    clamps, `migrateFlockingParams` + tests (versioned key
    `flip.flocking.params` wired with the mode).
  - ☑ mode enabled + panel: flocking selectable in picker/switcher/?mode=;
    nav [flocking, target, wind, settings, about]; `useFlockingPath` hook
    (derivation only runs in flocking mode; pattern/manoeuvre derivation
    skipped there); wind fetch limit extends to windowTopFt;
    FlockingComponent with FWC presets (Flow/Float/XRW/CRW), window +
    speed inputs in user units, N/E/S/W + Into-wind (resolved degrees
    shown live), mi/nm/km toggle, FWC-shape results text. Browser-
    verified at ZHills: into-wind resolution, preset/cardinal quick-sets,
    prior + offset signs, fetch to 12k ft.
  - ☑ map layer `src/map/layers/FlockingLayer.tsx` (adapter primitives
    only): cyan (#29b6f6) corrected descent line + dashed white no-wind
    ghost; POMs at round altitudes with labels + hover tooltips (alt,
    time since exit, wind at altitude); 3 nm jumprun line ENDING at the
    exit with arrowhead barbs; distance markers at round mi/nm/km
    *prior* distances relative to the reference projection (marker "2"
    = where the spot text would read "2.00 prior"); spot one-liner
    label at the exit. Browser-verified: full picture at zoom 12,
    POM hover tooltip (260 s since exit matches hand calc), markers
    4/5/6 behind the 3.16-mi-prior exit. Known polish item ✎: POM
    altitude labels overlap at low zoom (same as pattern's, but the
    flocking path is longer).
  - ☑ reference point C (owner design): "Pin reference" in the panel
    pins C at the current target B; spot text/label/markers stay
    relative to C while B remains free to move; amber ring+dot "C"
    marker on the map; Unpin reverts to C = B. Browser-verified: pinned
    C, moved B 1 mi north, spot went 3.16 -> 2.18 mi prior (matches
    hand calc) with vectors unchanged; unpin restored 3.16.
  - ☑ 2026-07-17/18 iteration round (owner feedback): flocking default
    zoom 12 via the new Mode.defaultZoom (`d771b73`); descent line cyan
    -> magenta; "Spot Reference" naming; addWind curve bug fixed
    (`c95d93b` — polar drift accumulation wobbled the bearing, amplified
    when drift nearly cancels the flown line; now a flat E/N vector sum,
    uniform wind exactly collinear); PAST left/right confirmed an FWC
    bug and fixed geometrically (`ba3b681`).
  - ☑ **jumprun decoupled from canopy flight** (owner design, v1) —
    commits `1edc5e5` (core: windDriftVector agreeing with the path
    pipeline, solveCanopyFlight, reachableJumprunSegment circle/line
    intersection, line helpers), `4733710` (params: JumprunConfig
    auto/pinned + targetRadiusMi + showGrid, migration + limits),
    `8afe7dc` (derivation: pinned exit position on the line, canopy
    heading/speed SOLVED from the fixed drift, path anchored at the
    exit; ends in the target circle when reachable, best-effort at max
    speed when not), `b6132a0` (panel: Auto/Pinned section, direction +
    offset + target radius in distance units, exit "best"/along readout,
    "Fly 297˚ · needs 43 of 50 mph" green / "UNREACHABLE · short X" red),
    `f2d45d1` (map: full pinned line with the reachable interval thick
    green, exit drag handle constrained to the line, target-area circle,
    red unreachable state, jumprun-aligned distance grid ±3×±2 units
    with signed labels). Browser-verified with manual 40 kt @ 10˚:
    into-wind pinned run puts the best exit at required speed 0 (pure
    drift-back, 3.32 mi PAST — correct); green window, grid and POM
    ladder render; zero console errors. Not automation-verified (wheel
    zoom hangs the tooling): exit-handle dragging — owner, give it a
    pull. Constraint DESCRIPTIONS (ZHills "1.5 mi max west" searched by
    a solver) are v2 ✎ — the pinned-run + green-window flow covers the
    workflow manually.
  - ☑ **classic/free sub-modes** (owner rethink, 2026-07-18) — commits
    `fa64105` (derivations: classic = FWC's unique solution, end at
    target; free = user owns jumprun line + exit position + canopy
    direction with 'follow-jumprun' default and a >15° deviation
    warning) and `01ea225` (panel: Classic|Free selector, collapsible
    sections, exit slider; map: green run in both modes, free-mode
    handles — exit slides on the line, white handle rotates the run,
    amber translates it, magenta rotates the canopy flight). Iteration
    history the same day: exit-solver-only variant (`2fd0225`) replaced
    by this; miss display (red MISSES + connector + distance) kept.
    Browser-verified vs hand calcs; handle DRAGGING needs an owner pass.
  - ☑ **solve sub-mode (restricted corridors)** — DONE (2026-07-18):
    `008c68a`/`179060b` (core/flockingSolve: analytic solver — best
    exit per canopy sample is the clamped projection of target − Δ onto
    the corridor rectangle, φ sampled 0.5° center-outward with
    strict-improvement tie-breaks so flat optima resolve to the least
    canopy deviation; brute-force oracle agreement over seeded random
    scenarios), `5e0868a` (params: persisted solveCorridors list,
    default = the ZHills N-or-S pair; solve derivation renders the
    winner exactly like free mode), `74c02cb` (panel: Corridors section
    with per-corridor hits/misses verdicts and the best highlighted;
    map: dotted corridor rectangles). Also `9ca3d30`: free-mode run
    shortened to 3 nm ending at the exit, rotate handle at the far end,
    translate at the midpoint. Browser-verified (west wind, N/S
    corridors): solver picked the north run, offset 0.97 mi left +
    canopy 11° into wind — exactly cancelling the 1.66 mi drift, 'On
    target (0.00 mi off)'; both corridor verdicts shown. Direction
    RANGES per corridor (e.g. 'anything from 250 to 290') are a small
    follow-up ✎ — the solver structure supports them, the schema stores
    fixed headings today.
  - ☑ **per-DZ corridor presets** — DONE (`3128d21`, semantics fixed in
    `cb01dd0`). `Dropzone.modes.flocking.solveCorridors` seeds the solve
    sub-mode on arrival; edits stay with that place and "Reset to default"
    restores the declared set. Corridors never travel between dropzones.
    Only ZHills is populated (the N/S pair). ✎ The app-wide
    `DEFAULT_FLOCKING_PARAMS.solveCorridors` is still that same
    ZHills-flavored pair — arguably wrong now that DZs declare their own.
  - ☑ **UI iteration round 2** (owner feedback, 2026-07-18/19): compact
    vector rows with bearing arrows (`b1da95b`); direction fields wrap
    360->0 via a NumberInput `wrap` modulus and distances display to 0.1
    (`0c8c721`); grid recoloured light blue with emphasized centre lines
    (`2794c61`); the mi/nm/km unit moved into general Settings as a
    UnitPreferences field (`56c7490`); the Spot Reference is draggable on
    the map, dragging pins it (`15a2c0d`); the two 1-D jumprun handles
    became one 2-D move handle and the rotate handle no longer flips
    ~180 degrees or vanishes (`1190656`, core helper `jumprunFromExit`);
    flocking keeps the target permanently draggable with the heading UI
    hidden, and each mode now stores its own target under
    `flip.targets.byMode` falling back to the shared legacy one
    (`e6744b8`). All browser-verified.
  - ☑ **owner iteration rounds 3–4 (2026-07-18/19)** — classic/free/solve
    sub-modes; analytic corridor solver; solver STABILITY via green/yellow
    tiers + an into-wind preference (`6f1f302` — fixes forecast-scrubber
    flip-flopping between N/S corridors); Green/Yellow radius renamed,
    moved to Display and applied in all three modes (`c71aa43`), default
    0.25 nm / 0.5 nm (`3f237b1`); canopy-vs-jumprun deviation shown on the
    map, 'Spot' heading (`c77e06a`); corridors nameable + individually
    enableable (`3526254`); flocking target drags only, never click-moves
    (`b916cc3`). Still ✎: corridor direction RANGES, per-DZ corridor
    presets. Corridor names on the map: DONE — enabled, named corridors
    are labelled at their exit-rectangle centroid (FlockingLayer
    `corridorLabels`). Per-corridor collapse also added (the checkbox,
    name and verdict stay visible while collapsed).
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
- ☐ **Live GPS mode** — the PWA on a phone uses device GPS: current
  position vs plan in the aircraft, spot indicator. Safety-sensitive —
  presentation needs care (this is the feature that makes the PWA
  matter). ✎ design. (Accepted 2026-07-16 — "interesting one".)
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
- ☐ **DZ wind climatology** — OpenMeteo historical API: typical winds by
  month/hour at a DZ, "is today unusual?". For demos and traveling
  jumpers. (2026-07-16 review.)
- ✎ **METAR/TAF display** — nearest airport METAR + TAF. Observation side
  overlaps the existing observed stations (NWS stations are largely the
  same airport METAR reporters); the genuinely new part is **TAF** — a
  human-written short-term airport forecast, nothing in the app covers
  that. Verify CORS on aviationweather.gov before building; scope vs
  existing stations to be decided.

---

## Phase-1 follow-ups (found during implementation, 2026-07-13)

- ☑ Extend versioned codecs to remaining unversioned storage — DONE
  (`7f2de97`, `94db1b8`). `flip.custom_locations` and
  `flip.manoeuvre.track.tracks` (note: the real key names, not the ones
  this list guessed) now use `createVersionedCodec` with
  `migrateCustomLocations` / `migrateStoredTracks` in `core/model.ts`;
  their element types moved to `types/index.ts` so core owns the loaders
  without depending on components. Legacy bare arrays and corrupt values
  verified in-browser: good entries survive, unusable ones are dropped, no
  crashes. Simple string keys audited: `flip.location.tab` stays a plain
  string with a validating fallback (wrapping it would reset every existing
  user's tab, and the fallback fixed a real bug — an unrecognized value
  rendered an empty panel); `flip.courses.selected` / `flip.presets.active`
  left alone (ids whose validity depends on a separate user-mutable list,
  consumers already fall back gracefully); `flip.mode` was already
  versioned.
- ☑ `setManoeuvreAltitude` — confirmed dead and removed (`f885113`). The
  feature it once served is alive via a different path; that logic (offset
  + ±15% clamp) moved out of `useAppState` into
  `core/manoeuvre.applyInitiationAltitudeOffset` with tests, fixing a
  core-dependency-rule violation.
- ☐ Manoeuvre param naming: `offsetXFt` is labeled "Back" (depth),
  `offsetYFt` "Offset" (lateral) — rename fields in a future schema
  version to match the labels.
- ☑ `createSafeCodec`/`createSimpleCodec` — DONE (`db814f8`), after the
  versioned-codec migration above unblocked them. `deepMerge` went too
  (it was `createSafeCodec`'s private helper). `createVersionedCodec` kept.
- ☑ `CODEC_JSON` — removed with its tests (`8a9f2f5`, 2026-07-16).
- ☐ A stale `flip.courses.selected` id renders the raw id in the Courses
  Select (`renderValue` falls through to the id) instead of "None".
  Cosmetic and pre-existing; not fixable by a codec — needs the course list
  cross-referenced at load time.
- (Same-path nav toggle flakiness — already covered by Phase 3 router work.)

## Phase-2 follow-ups (found during implementation, 2026-07-14)

- ☐ Target-edit handles overlap at mid zoom — heading handle's hit area
  beats the target handle when ~10px apart; needs separation or
  hit-priority for the target handle.
- ☐ `attachPlaceAutocomplete` re-attaches on every callback identity change
  with no listener cleanup (pre-existing bug, carried over) — effect should
  return a disposer; ref-stabilize the callback.
- ☑ Built-in courses are geographically anchored (e.g. Skydive Arizona);
  selecting one far from target shows nothing — FIXED ("jump to course"):
  selecting a course pans the map to it, deselecting pans back to the
  target; the camera is not re-anchored (free drag still works). App.tsx
  derives a `mapCenter`; MapComponent gained a `cameraCenter` prop so the
  stations layer stays anchored at the target. Verified in-browser.
- ☑ Leg tooltip body rows low-contrast over dark map theme — FIXED:
  shared TOOLTIP_STYLE now near-opaque with a hairline border and 12px
  full-white body text; secondary (coords) line brightened. Applies to
  point/leg/manoeuvre and station tooltips alike.

## Phase-3 follow-ups (found during implementation, 2026-07-14)

- ☑ Mode defaults resolution — FIXED (`0e8f6da`, 2026-07-16) with explicit
  touched-settings tracking; see "Settings layering" in the
  architecture-review section.
- ☐ Settings panel shows stored (not effective) values — add "set by
  mode" indicators; consider hiding swoop-only settings in pattern mode.
- ☐ `SECONDARY_PANELS` (Settings/About) split hardcoded in App.tsx —
  fold into the Mode shape as nav groups.
- ☐ Presets don't carry their mode yet (ARCHITECTURE: Plan carries mode)
  — part of the Phase-7 Plan document work.
- ☑ Selecting a course doesn't pan the map to it — FIXED with the
  "jump to course" Phase-2 item (see there for the commit).
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
- ☑ Remove now-redundant `KZPH` from ZHills `nearbyStations` — already
  done in `eb56277`; verified gone 2026-07-16 (`KM08` supplement kept).
- ☑ Forecast-time picker is shown but inert for soundings — the picker is
  hidden when the sounding source is selected (was already in place;
  verified), and the new time scrubber lives inside the same conditional
  so it hides too.
- ☐ Elevation cache eviction is insertion-order, not true LRU — fine at
  500 entries; revisit only if it grows.
- ☐ Soundings can be dense in the low-altitude band — consider thinning
  levels for the table if it feels noisy.

## Architecture-review follow-ups (2026-07-16)

Weak spots from a full-code review of the redesigned branch (Phases 0–5
done). Fix opportunistically or as prerequisites for the features above.
Ordered by importance.

- ☑ **Error surface + don't wipe winds on failed fetch** — DONE
  (`cf21e1e`). Failed fetch now keeps the previous profile;
  `useFetchForecast` exposes an error state; new `NotificationsProvider`
  (MUI Snackbar) is the app-wide error channel, wired in App.tsx.
- ☑ **Extract a `useWinds` facade from App.tsx** — DONE (`6a88205`).
  Wind orchestration (fetch + observed + composition + forecast-time/
  observed-reset coupling + error notification + wind summary, now
  memoized) lives in `hooks/useWinds.ts`; App.tsx keeps only the
  path-derived maxAlt plumbing. `CustomAppTitle` rendered as an element
  instead of a plain function call. Pure refactor.
- ☑ **Finish the core/ layering** — DONE (`07f6268` pinning tests,
  `4610819` move, `a15e4a7` dedupe). `pathStats` and `courses` moved to
  core/ (both were pure); drift-angle formula deduped into
  `core/pathStats.driftAngle` with wrap tests; `PointData` now exported
  from core and shared. Exporters deliberately left in util/ — they
  trigger downloads/DOM; a pure-serialization split wasn't clean enough
  to pay for itself.
- ☑ **Component/hook tests** — DONE (`19bf4f5`). RTL + jsdom added as
  devDependencies (jsdom opt-in per test file); usePresets round-trip
  (incl. persistence across remount) and PatternComponent render +
  clamping covered. Route guard was already covered in
  app/routing.test.ts. Suite now 390 tests. Growing this further stays
  under the standing "grow test coverage" item.
- ☑ **Settings layering** — DONE (`0e8f6da`). Explicit touch tracking:
  `flip.settings.touched` (versioned doc) lists keys the user changed;
  `setSettings` marks changed keys; resolution is touched-always-wins /
  untouched-takes-mode-default; `resetAll` clears. Pre-tracking users
  seeded from every key whose stored value differs from the global
  default (old behavior preserved until their next change). The trap is
  fixed: a mode-overridden setting can now be forced back to the global
  default. Closes the matching Phase-3 follow-up.
- ☐ **Path rendering won't scale to tracks** — every path point renders
  2–3 MapCircles (FlightPathsLayer). Fine at ~100 pattern points; will
  not survive multi-thousand-point GPS tracks (multi-plot, logbook).
  Decimation or a canvas layer; flag for Phase 7.
- ☐ Minor: `openmeteo.ts` module-level `prefetched` singleton (acceptable;
  has a test reset). `fetchWinds` filters rows above the altitude limit
  at set time, so raising the limit needs a refetch (the prefetch cache
  mostly hides it). Both accepted as-is 2026-07-16; dead `CODEC_JSON`
  removed (`8a9f2f5`).

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
