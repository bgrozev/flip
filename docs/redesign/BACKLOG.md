# FliP Backlog

Owner's raw idea/bug list, organized by scope. Companion to `NOTES.md`.
Status legend: ☐ open · ◐ partially done · ☑ believed done (verify) · ✎ needs clarification

Categories: **Bugs** → **Polish** (trivial UI/text fixes) → **Small features**
(days) → **Medium features** (weeks, self-contained) → **Large features**
(architecture-relevant) → **Ideas / research** (unscoped, needs design).

---

## Bugs

- ☐ **Manoeuvre-from-params offset bug** — negative `offsetXFt` broken;
  code clamps `Math.max(offsetXFt, 3)` (`util/manoeuvre.ts:25`) so 0 and
  negative silently become 3 ft. Fix geometry so 0 works; support negative
  (offset to the other side) or validate with explicit UI feedback.
- ✎ **Initiation altitude not saved?** — `initiationAltitudeOffset` exists in
  `ManoeuvreConfig` and is persisted via localStorage. May be fixed already,
  or bug is in a specific mode (track vs samples vs params). Reproduce first.
- ☐ **No input limits** — absurd values (e.g. huge pattern altitude)
  effectively break the app. Add validation/clamps on all numeric inputs.
  (Related: `limitWind` setting exists for wind table only.)
- ☐ **Wind table number field too narrow** — custom values don't fit.
- ☐ **Wind direction interpolation wrap bug** (found during code read) —
  `Winds.getWindAt()` interpolates 350°→10° through 180°. `util/wind.ts:97`.

## Polish (trivial)

- ☐ Rename "crab angle" → "drift angle" (or similar) everywhere.
- ☐ Input fields UX — highlight/select content on click (focus behavior).
- ☐ Link to windy.com (at target/DZ coordinates, matching altitude?).
- ☐ Attribution for ground wind sources (NWS, CSC, Spaceland) in UI.
- ☐ Default pattern params → student-friendly: 3:1 glide, 8 kts descent
  (current default: 9 mph descent, 3.0 GR — confirm intended units kts vs mph).
- ☐ Ground speed in point hover popup.
- ☐ "Degrees rotated" (cumulative turn) in map hover for manoeuvre points.
- ☑ Ground wind arrow displays gusts (commit `be587a1`) — verify.
- ☑ Ground wind arrow Beaufort colors (commit `be587a1`) — verify.
- ◐ Beaufort colors elsewhere — wind table rows, wind summary. Not done.
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
- ☐ **Cache elevation** — `fetchElevation()` called on every forecast fetch
  (`forecast/openmeteo.ts:28`); cache per location (it never changes).
- ☐ **Prefetch forecast for next few hours** — one API call covers multiple
  hours; switch hour offset locally without refetch.
- ☐ **OpenMeteo model info** — display which model (GFS etc.), allow choosing.
- ☐ **More pattern legs** (>3).
- ☐ **Course stats display** — distance to gates, angle vs course direction.
- ☐ **Measure tool: render line lengths** on the segments.
- ◐ **Map avg + ground wind arrows** — ground wind arrow near target exists
  (commit `0ea8894`); avg-wind arrow exists as setting. Owner wants both,
  maybe gated on observed wind availability. Review current state vs wish. ✎
- ☐ **De-couple ground wind from dropzones** — observed-wind lookup should
  take a location, not a DZ entry. (NWS provider may already be
  location-based; CSC/Spaceland are inherently DZ-specific.)

## Medium features (weeks, self-contained)

- ☐ **Soundings as wind source** — fetch real soundings (radiosonde) in
  addition to model forecast winds; show alongside/instead.
- ☐ **Weather station auto-discovery** — automatic nearby-station discovery
  (NWS/METAR/Synoptic/WeatherFlow?) instead of hardcoded per-DZ lists.
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
- ☐ **Long spot calculator** (coach mode) — how far out can students exit
  and still make it back: glide from exit alt vs winds. Related to wind cones.
- ☐ **Wind cones** — area reachable from current altitude flying in any
  direction given winds. Big safety/teaching value. Related: long spot.
- ☐ **Direction overlays** — average-wind arrow overlay, degree-circle
  (compass rose) around target.
- ☐ **Turn drift calculation** — drift accumulated during the turn itself.

## Large features (architecture-relevant)

- ☐ **Modes** (from NOTES.md): Swooper / Pattern (student) / Flocking /
  Coach / Demo — gate tabs, map layers, defaults per mode.
- ☐ **Phone app = PWA** — installable, offline-capable (cache app shell,
  tiles?, last forecast).
- ☐ **Flocking mode** — beyond a port of flocking-wind-calculator:
  - map plot: drift vectors, exit spot(s), jumprun line
  - jumprun configuration (direction, aircraft airspeed, groups/separation?)
  - parity checklist vs FWC: display drift, display average wind,
    "rotate into wind" action
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

## Ideas / research (needs design)

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

## Cross-cutting observations

- Analysis cluster (logbook, multi-plot, stats, scoring, plan-vs-jump,
  conditions delta) is a coherent second pillar of the app: **Plan** vs
  **Review**. Architecture should treat tracks as first-class data.
- Wind cluster (soundings, station discovery, model info, prefetch hours,
  temp/DA) argues for a **pluggable wind-source layer** with metadata
  (source, model, valid time, observed vs forecast) per row.
- Wind cones + long spot + expected-GR share one primitive: **reachability /
  glide integration against the wind profile**.
