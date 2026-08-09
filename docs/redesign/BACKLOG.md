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
- ☐ **Re-selecting the active preset does nothing** (spotted while
  verifying the above) — `PresetSelector.handleSelect` skips `onSelect`
  when the id is already active, so once you have wandered off a preset
  there is no way to reload it. Pre-existing; wants a "revert to preset"
  affordance rather than just dropping the guard.
- ☑ **P7 / F2 · Mobile: panels page-swap the map** (UIUX #3) — DONE
  2026-08-08. The map and the panel now split the screen: the map keeps the
  top 40%, the panel scrolls below, and a chevron on the divider collapses
  the map to an 88px strip when a long form needs the room (never to zero —
  the map is not unmounted or given a zero-sized viewport, so the tiles and
  camera survive). The winds indicator is forced to its chip form while the
  split is on (`MapComponent.compactOverlays` → `WindMiniIndicator.compact`),
  without touching the stored collapse preference.
  Fixed on the way, because it was hiding the indicator's header on the
  mobile map view too: the app bar overhangs `main` by ~34px at 375px, since
  Toolpad reserves one toolbar height and the bar's contents wrap to a second
  row. `useAppBarOverlap` measures it and pads it out.
  Still open ✎: whether 40% is the right default, and whether the split
  should be free-dragged rather than a two-state toggle (a toggle was chosen
  because a drag is one more thing automation cannot verify).
- ☑ **P8 / task 40 · Jumprun handoff copy/share** — DONE 2026-08-03. The
  spot is now built by one formatter (`core/spotText`) and shown as the
  panel's sticky hero, in the top bar (replacing the wind summary in
  flocking) and as a pill on the map; the first two copy it, or open the
  share sheet where there is one. Text is the spot alone, per the owner:
  no dropzone, corridor name or forecast time.
- ☐ **F6 · Mobile Wind panel density** — desktop-shaped layout, large empty
  space below COMPARE SOURCES on a phone.
- ☐ **task 14 · "Why did the pattern shift" teaching affordance** — the key
  teaching gap; build in pattern/swoop for everyone (also a coach need).

### Cross-cutting concerns (design-level, architecture-relevant)

- ☐ **Accounts & sync** (task 38a; owner monetization vector) — sync the
  persisted documents (presets, custom locations, settings, saved plans)
  behind an identity; anchor case = swooper's laptop→phone loop. Needs a
  backend/auth/account model (none exist). Candidate paywall; free/paid line
  TBD. Ties into share-links (49), saved reports (47), annotations (48).
- ☑ **Nerd Mode** updates
  - ✎ **Candidates the owner explicitly kept OUT**, recorded so they are
    not re-proposed: forecast-model selection and comparison, all unit
    pickers, `showPreWind` (the dashed pre-wind line), `showCrabArrow`.
    The full 41k ft wind table needs addressing but **outside** nerd.
  - ☐ Candidates not yet ruled on: custom course *authoring*. Adding one
    is a single line in `NERD_SETTING_KEYS` or `NERD_FEATURES`.
  - ☐ Nerd's own positive content, so it is not only a gate: a
    diagnostics view (per-row wind provenance, fetch times, station ids,
    raw JSON, "copy diagnostics" for bug reports) and numeric path stats
    from `core/pathStats`. The planned Export panel lands in
    `NERD_PANELS`, which is wired and currently empty.

### New monetizable/report items (owner interest)

- ☐ **task 47 · Shareable report (PDF / image)** — for demo/coach.
- ☐ **task 48 · Map hazard drawing / annotations** — for demo.
- ☐ **Reconcile export paths** — FlySight CSV is the toolbar dialog (whole
  path); KMZ lives only in the Courses panel (course-scoped). No general
  path→KMZ from the toolbar (tasks 45/46).

---

## From the 2026-07-28 session

- ◐ **Import the owner's dropzone list, then curate all of it** — import
  DONE (2026-07-28): 280 new entries from the owner's CSV, 59 -> 339,
  30 CSV rows dropped as duplicates of existing entries. The import was NOT done properly -- dropzones for which I defined different targets for modes 1 and 2 only have 1 mode. Need to revisit with the localStorage dump.
- ☐ **Dropzone `timezone`** — deferred, not rejected. Forecast times render
  in *browser* local time, so a coach or traveling jumper planning a DZ two
  zones away is reading the wrong clock. One IANA string per entry.
- ☐ **Temperature aloft** — the ground reading is done; per-level
  temperature is available (`temperature_{hPa}hPa`, and soundings already
  carry it) and would give density altitude at altitude, not just at the
  DZ. 

## Polish (trivial)

- ☐ **No way to type an exact final heading.** The field left with the Target
  panel, so the heading is the map's rotate handle plus `<` `>` (5°), `,` `.`
  (1°) and `u`/handle-click for into wind. Fine for flying; a coach wanting
  "set final to 247" has no way in. The Location hero card is where a small
  editable heading line would go, if the owner wants one. ✎
- ☐ **The phone toolbar still takes two rows** (375px). Nothing is clipped
  any more and the density altitude was dropped there to make room (it is in
  the map's winds indicator and the Wind panel), but AVG + GND + the mode
  switch + the presets menu are 344px of the 355px available, so the actions
  wrap to a second line. One row needs one of them to go — the owner's call
  which, if any: the readings could leave the bar entirely and live only on
  the winds indicator, at the cost of AVG, which is nowhere else.

- ☐ **Settings has no `?` in its panel header** while every other panel
  does (spotted in the 2026-08-08 UI pass). Either give it a help topic in
  `core/help.ts` or decide the icon does not belong there — as it stands it
  reads as missing.
- ☐ **The manoeuvre hint and the initiation handle sit on different
  lines.** Since the handle moved to the still-air path (2026-08-03),
  `ManoeuvreHintLayer`'s entry arrow and rotation label are the only part
  of the turn still anchored to the drawn one. Anchoring the hint to
  still-air is consistent for a parametric turn; for a recorded track the
  drawn line is the one that was flown. ✎ owner's call.
- ☐ **The map's spot label is not clickable** — copy lives in the top bar
  and the panel hero instead. Google's `overlayLayer` pane takes no mouse
  events, and the panes that do sit above every marker, so a clickable
  label would shadow the drag handles beside it. Fixable with an
  `interactive` flag on `MapOverlay` plus separation from the exit, if the
  owner wants it.

- ☐ **Round altitude/number display in both feet and metres** — labels and
  readouts should land on round numbers in the active unit (e.g. 1000 ft
  ↔ ~300 m shown as a clean 300 m, not 305 m), rather than converting an
  exact value and showing an odd figure. Affects POM altitude labels, the
  winds indicator, tables, hovers. Pick round-number targets per unit.
- ☑ Input fields UX — highlight/select content on click. DONE 2026-08-08,
  finished the same day. Every numeric field is `components/NumberField`,
  which selects on focus; the remaining prefilled fields — a course's name
  and lat/lng, a corridor's name, the export dialog's ground elevation, and
  the preset and place RENAME dialogs, which open on the current name —
  now share one handler, `components/selectOnFocus` (the wind table's local
  copy folded into it). The rule is in CLAUDE.md's UI conventions table:
  a field that arrives with a value the user replaces wholesale. Free text
  (the manoeuvre's description, the place search box) and native date/time
  inputs are deliberately excluded.
- ☐ Default pattern params → student-friendly: 3:1 glide, 8 kts descent
  (current default: 9 mph descent, 3.0 GR — confirm intended units kts vs mph).
- ☑ Beaufort colors elsewhere — DONE. Wind table rows (`185c2d8`, a colour
  dot per speed) and, as of 2026-08-08, the top bar's AVG/GND arrows. All
  of it shares `core/beaufortColor` with the map arrows, so a wind's
  strength reads the same wherever it appears.

## Small features (days)

- ☐ **Export: winds as note + user notes field** — append wind table + free
  text to exported plan (KMZ/FlySight/etc.). Notes field on export dialog.
- ☐ **Improved KMZ export** (owner: unspecified what; gather wishes). ✎
- ◐ **Temperature readings/forecast display** — GROUND temperature is done
  with the above. Still open: temperature *aloft* (OpenMeteo can return
  `temperature_{hPa}hPa` per pressure level, and soundings already carry
  it per row) and anything forecast-shaped beyond the selected hour.
- ☐ **Distance course: more markers** (120 m etc.) — render only when zoomed in.
- ☐ **Preset UX** — explicit "none"/default preset, clearer active-preset
  indication, dirty state. ✎ discuss desired behavior.
- ☐ **Course stats display** — distance to gates, angle vs course direction. Speed.
- ☐ **Replay animation** — animate a dot along the plan (later: a recorded
  track) over time. Teaching/demo value; cheap over the memoized paths.
  (2026-07-16 review.)
- ☐ **Better wind visualization (perhaps windy-like)** — the wind table
  and the single ground arrow are a poor picture of a wind field. Explore
  a windy.com-style rendering: animated particle streaks / flow lines
  over the map, a colour ramp for speed, and the ability to see the
  profile change with altitude (tie into the altitude band the plan
  actually uses). ✎ design; owner request 2026-07-19.

## Medium features (weeks, self-contained)

- ☑ **Improve DZ/target selection UI** — search, favorites, map-pick flow.
  Second pass DONE 2026-08-08: the Target panel became **Location** (hero
  card for the active place, one starred-first list of favorites and recents,
  search-first with a country-grouped browse), and the final-heading field
  left with it — the map's rotate handle and the keyboard own the heading
  now. The two deferrals below are closed by it:
  - ☑ **Recently used places** — DONE 2026-08-08 as part of the Location
    rework: `flip.places.recent`, six entries, in one list with the saved
    ones (see below).
  - ☑ **Cleanup UI** — DONE 2026-08-08: the dropzones only render when
    searched, or under a country-grouped "All dropzones" disclosure.
- ☐ **Expected GR & ground speed up high** — e.g. "at 4000 ft heading south
  expect GR 1.5" for comparison against wrist GPS in flight. Table/overlay
  of expected GR/speed by altitude+heading.
- ☐ **Generic "free"/explore mode** — Google-Earth-like: measure, annotate,
  drop markers; make measure tool actually useful.
- ☐ **Canopy + wing loading input** — pick canopy model + WL instead of raw
  GR/descent rate; canopy presets database. 
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
  design open for owner iteration. 
  Open for iteration ✎: visual form (arrows vs barbs vs mini-hodograph),
  compare at the selected forecast hour instead of "now", per-cell
  outlier emphasis, showing sounding age more prominently.

## Large features (architecture-relevant)

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
- ◐ **Flocking mode** 
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

## Ideas / research (needs design)

- ☑ **MapLibre adapter** 
  - ☐ Offline PWA tiles via MapLibre — the original motivation. ESRI tiles
    are not currently precached by the service worker; wire runtime tile
    caching (respecting ESRI terms) so MapLibre works offline.

- ☐ **Conditions delta since last jump** — "what changed since you last
  jumped": wind shift, direction change. Needs jump-time snapshots
  (logbook dependency).
- ☐ **Zone-acc entry speed solver** — compute speed decay to position for a
  55 mph gate entry. Needs a canopy speed-decay model. ✎ research.
- ☐ **Automated scoring: distance & speed courses** — from a track, compute
  official-style scores (gates, window, etc.).
- ☐ **"Wind cone" above pattern** — fuzzy pattern-entry indication instead of
  a precise point. ✎ clarify concept.
- ☐ **DZ wind climatology** — OpenMeteo historical API: typical winds by
  month/hour at a DZ, "is today unusual?". For demos and traveling
  jumpers. (2026-07-16 review.)

---

Re-checked against the code on **2026-08-08**. What was already fixed has
been deleted rather than ticked — `NOTES.md` keeps the reasoning, and a list
of solved problems is not a backlog. The Phase-2 section is gone entirely for
that reason, along with the manoeuvre offset bug and the mode picker's missing
accessible names.

## Phase-3 follow-ups (found during implementation, 2026-07-14)

- ◐ Settings panel shows stored (not effective) values — TRUE of the code
  (App passes `settings` to `SettingsComponent` while the app runs on
  `modeSettings`) but **not observable today**: all three modes declare
  `defaults: {}`, so `applyModeDefaults` changes nothing, and the nerd gate
  only masks settings whose controls it also hides. The discrepancy appears
  the moment any mode declares a default — worth an indicator then, not
  before. The other half (hiding swoop-only settings in pattern mode) is
  live and tracked as **P4 · mode-filtered Settings** above.
- ✎ `SECONDARY_PANELS` (Settings/Help) split hardcoded in App.tsx — still
  hardcoded (`App.tsx`), and arguably right where it is: "Settings and Help
  are secondary" is a fact about the app, not about a mode, so moving it
  into `Mode` would have all three modes repeat the same pair. Worth doing
  only if a mode ever needs a different secondary group. Owner's call
  whether to keep the item open.
- ☐ Presets don't carry their mode yet (ARCHITECTURE: Plan carries mode)
  — still true (`Preset` has target/pattern/manoeuvre/course/place, no mode);
  part of the Phase-7 Plan document work.

## Phase-4 follow-ups (found during implementation + spot check, 2026-07-15)

- ☐ Elevation cache eviction is insertion-order, not true LRU — still
  accurate (`data/wind/elevation.ts` deletes from the front of
  `Object.keys` past `MAX_ENTRIES = 500`). Deliberately left: at 500 entries
  the difference cannot be felt. Revisit only if the cap grows.
- ☐ Soundings can be dense in the low-altitude band — still open; no
  thinning anywhere in `data/wind/soundings.ts`. Needs a judgement about
  the table, not a fix.

## Architecture-review follow-ups (2026-07-16)

Weak spots from a full-code review of the redesigned branch (Phases 0–5
done). Fix opportunistically or as prerequisites for the features above.
Ordered by importance.

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
