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
- ☐ **Winds tab: read-only first** — in the vast majority of uses the tab is
  read-only; the "unlock" button is used very rarely. Redesign around
  viewing (colors, source badges, summary); editing becomes an explicit,
  secondary mode.
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
- ☐ **Long spot calculator** (coaching use-case) — how far out can students exit
  and still make it back: glide from exit alt vs winds. Related to wind cones.
- ☐ **Wind cones** — area reachable from current altitude flying in any
  direction given winds. Big safety/teaching value. Related: long spot.
- ☐ **Direction overlays** — average-wind arrow overlay, degree-circle
  (compass rose) around target.
- ☐ **Turn drift calculation** — drift accumulated during the turn itself.

## Large features (architecture-relevant)

- ☐ **Modes** (from NOTES.md): Swooper / Pattern (student) / Flocking /
  Demo / Explore — gate tabs, map layers, defaults per mode.
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
- ☐ **Phone app = PWA** — installable, offline-capable (cache app shell,
  tiles?, last forecast).
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
