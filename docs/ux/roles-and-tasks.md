# FliP Roles & Task Inventory

A user-centred map of **who** uses FliP and **what** they come to do. Companion
to `docs/redesign/UIUX.md` (flow-level improvement ideas) and
`docs/redesign/BACKLOG.md` (owner's raw list). This file is the stable
reference the two draw on: the role definitions and the tagged task list.

Next phase (not yet in this file): walk each task's actual UI path in the app
and record friction per surface.

---

## Legend

**Status** — how well the task is served by the code on the
`flip-redesign-architecture` branch:

- `[S]` supported — a clear path exists
- `[P]` partial — possible but awkward, indirect, or incomplete
- `[B]` backlog — not built

**Surface** — where the task must be good:

- `M` mobile-critical — happens on a phone, often at the DZ / loading area / plane
- `D` desktop-primary — setup/analysis work, density is acceptable
- `M+D` both matter

---

## Roles

| # | Role | Core goal | Notes |
|---|------|-----------|-------|
| 1 | **Student** | Learn to plan a pattern, including *without* the app. Zero-fiddle default. | Should get a correct student pattern (student descent rate/speed, 300-600-900 ft) with no settings changes. App should teach, not just compute. Usually has a coach alongside. |
| 2 | **Regular jumper** | Plan a standard pattern, fast, mostly on a phone. | Priority: find my DZ and refresh the forecast in the loading area seconds before boarding. Will change a few settings; won't dig deep. Canopy presets would help. |
| 3 | **Swooper** | Plan a high-performance landing. | Needs the manoeuvre, winds aloft, custom GR and pattern altitudes, courses. Wants to save plans. Likely multi-canopy → presets. Will spend setup time; still wants it intuitive + documented. Strong fit for account sync: configure on a laptop, pull it up on the phone at the loading area. |
| 4 | **Coach** | Teach, usually several students. | Presets for multiple students. Compare wind models. Manipulate pattern/wind/GR *live* as a teaching tool. Plan the spot for a long-spot jump. **Not planned as its own mode** — see below. |
| 5 | **Demo jumper** | Plan a landing at a custom location. | Clean custom-location UI + save location. Winds aloft matter. Wants a saved/shareable report for the team. Drawing hazards on the map is of interest (possibly monetizable). No dedicated features yet. |
| 6 | **Flocker** | Figure out the spot; communicate it to DZ/pilot. | Wants the jumprun description to hand off, a visual of the expected ground track, and quick "what-if" wind scenarios (e.g. 70 kt up high, calm low). |
| 7 | **Nerd** | Play with the data. | Export, invert wind, model/sounding compare, manual per-level wind. Higher effort threshold is acceptable — mode opt-in *is* that threshold. |

---

## Cross-cutting concern: planning-validity (trust) state

**Owner requirement.** The UI must make it *obvious* when the current picture is
**not safe to plan a real jump on**. Planning on a live, fresh forecast is one
thing; planning on stale/absent/hand-fudged winds is another, and the two must
not look the same.

This is **not** a mode — it applies in every mode, and it matters *most* for the
nerd/flocker/coach flows where winds get inverted, hand-edited, or scrubbed to a
different time. It is currently **`[B]`**: the data exists but nothing surfaces a
single trust verdict.

Conditions that should downgrade trust (each visible, ideally with a reason):

- **Stale forecast** — fetched too long ago for the selected forecast time.
- **No winds fetched** — still on the empty manual default.
- **Manual override** — one or more levels hand-entered (already tracked as
  per-row pencil provenance — see BACKLOG "Per-row source indication").
- **Inverted / synthetic wind** — the nerd "invert" path, explicitly unreal.
- **Scrubbed forecast time** — planning for a time far from now; observed
  ground stations are already cleared in this case (`useWinds`).
- **Silly manual values** — outside plausible bounds (validation clamps exist,
  but a clamp is silent; trust state should call it out).

Existing raw material to build on: `forecastTime`, station `observedAt`, the
`observed?` flag on ground wind, `windRowSourceKind` provenance, and the
geometry layer's own staleness window for cache reuse. Missing: a single,
prominent **"conditions are illustrative, not jump-real"** indicator that
aggregates these. Design owner: decide whether it's a map-corner badge tied to
`WindMiniIndicator`, a banner, or both.

---

## Cross-cutting concern: accounts & sync (monetization)

**Owner requirement, monetization vector.** An account that syncs a user's state
across devices. The anchor use case is the **swooper's laptop→phone loop**:
fiddle with the manoeuvre, GR, courses and presets on a laptop at home, then
open the phone in the loading area and have exactly that setup waiting — no
re-entry, no export/import dance.

Today all state is local (`useLocalStorageState` / versioned codecs in
`util/storage.ts`), so it is device-bound and lost on cache clear. Account sync
would put the persisted documents (presets, custom locations, settings, saved
plans) behind an identity and reconcile them across devices.

Scope / design notes for later:

- **What syncs:** presets, custom/saved locations, settings, and (once it
  exists) the saved-plan object — i.e. the things already flowing through the
  versioned codec pipeline. Live wind fetches stay per-session.
- **Conflict handling:** last-write-wins is probably fine for a single-user,
  two-device pattern; note it, don't over-build.
- **Relation to other monetizable features:** share-links (task 49), saved
  reports (47), and map annotations (48) all get stronger with an account
  behind them — an account is plausibly the paid tier these hang off.
- **Free vs paid line:** undecided. Local-only stays free; sync (and the
  above) is the candidate paywall. Owner to set the boundary.

Cross-device sync is `[B]` — no backend, no auth, no account model exists yet.
This is architecture-relevant (needs a design session, not just a panel).

---

## Mode decisions

Modes are declarative UI profiles over one engine (`src/modes/index.ts`).
Today: `pattern`, `swoop`, `flocking`.

### Explore / Data mode — **reconsidered, leaning yes**

Previously discarded; back under consideration. The case for it:

- Nerd tasks (invert wind, model/sounding compare, raw per-level edit, export)
  are **orthogonal to flying a pattern** and today are scattered across the Wind
  panel, Settings, and Export.
- A mode is cheap — just data (`nav` / `mapLayers` / `features` / `defaults`).
- Matches the owner's "higher effort is OK for nerds": opting into the mode *is*
  the effort threshold.

Risk: a mode that is just "swoop with a bigger export button" — nerd overlaps
swooper/coach heavily.

**Resolution to pursue:** give the mode a distinct *job* rather than a subset —
frame it as **"Winds Aloft & Data"**, serving **both the nerd and the demo
jumper**, since both want the winds-aloft view + export/report and neither needs
a landing pattern. That gives the mode its own identity (raw winds/soundings
view, export/report front-and-centre, pattern/manoeuvre hidden) instead of
"swoop-minus". Pairs naturally with the trust-state indicator above, which is
most relevant exactly here.

Open: confirm the name/scope, then draft the concrete `Mode` object and the
winds-aloft/soundings panel it needs. (Note: `UIUX.md` #1 lists a "Demo" mode;
this may be that mode, reframed around data + winds aloft.)

### Coach — **no dedicated mode**

Coaching is swoop/pattern used *live* as a teaching tool, not a separate screen.
The real coach needs are already-mode-independent:

- multi-student presets — `[S]` (presets exist)
- compare wind models — `[S]`
- fast pattern/wind/GR manipulation with instant feedback — an *interaction*
  quality, not a nav change
- a "why did the pattern shift" teaching affordance — `[B]`, build it in
  pattern/swoop for everyone

Only trigger that would justify a coach mode: a **presentation/projector
layout** (big map, minimal chrome, side-by-side before/after). Parked pending
owner interest.

---

## Task inventory

### Setup & location

| # | Task | Roles | Surface | Status | Notes |
|---|------|-------|---------|--------|-------|
| 1 | Pick local DZ from a list | student, regular, swooper, coach | M+D | S | Plain list, no search/filter/sort |
| 2 | Find nearest DZ via device location | regular, demo | M | B | No geolocation anywhere in code |
| 3 | Search / filter the DZ list | regular, coach | M+D | B | DZ picker is an unfiltered dropdown. A SEARCH tab exists but it's a free-text *location geocoder*, not a DZ-list filter |
| 4 | Set a custom landing location | demo, flocker, nerd | M+D | S | `CustomLocationsComponent` |
| 5 | Save / name a custom location for reuse | demo, flocker | M+D | S | Keyed by name |
| 6 | Set target by clicking the map | all | M+D | S | Map click handler |
| 7 | Set final-approach heading | student, regular, swooper | M+D | S | Drag or input |

### Pattern

| # | Task | Roles | Surface | Status | Notes |
|---|------|-------|---------|--------|-------|
| 8 | Plot a basic 300-600-900 student pattern with defaults, no settings | student | M+D | S | Verified in app: fresh state = 9 mph descent, GR 3, legs 300/300/300 → 300-600-900. Works with zero setting changes |
| 9 | Choose 1 / 2 / 3-leg pattern | swooper | M+D | S | Swooper-only control. Standard Pattern mode should hide the leg selector and hard-wire 3 legs — see pain-points P9 |
| 10 | Edit leg altitudes & descent rate | swooper, coach | D | S | |
| 11 | Set glide ratio / canopy speed | swooper, coach | D | S | |
| 12 | Toggle pattern-heading wind correction | swooper, coach | D | S | `correctPatternHeading` |
| 13 | See original vs wind-corrected path | all | M+D | S | Dashed vs solid — core concept, currently unexplained (UIUX #6/#7) |
| 14 | Understand *why* the pattern shifts (teaching) | student, coach | M+D | B | The key teaching gap |

### Manoeuvre (swoop)

| # | Task | Roles | Surface | Status | Notes |
|---|------|-------|---------|--------|-------|
| 15 | Build manoeuvre from parameters | swooper | D | S | `ManoeuvreParametersComponent` |
| 16 | Load manoeuvre from a sample track | swooper | D | S | `ManoeuvreSamplesComponent` |
| 17 | Upload own GPS track as manoeuvre | swooper, nerd | D | S | `ManoeuvreTrackComponent` |
| 18 | Set manoeuvre entry / initiation altitude | swooper | D | S | `ManoeuvreAltitudeControl` |

### Wind

| # | Task | Roles | Surface | Status | Notes |
|---|------|-------|---------|--------|-------|
| 19 | Fetch upper-wind forecast | all | M+D | S | OpenMeteo |
| 20 | Refresh the forecast fast on a phone | regular | M | P | Works; mobile ergonomics of the refresh action to audit (owner priority) |
| 21 | Fetch DZ ground-wind observation | regular, swooper | M | S | Station within 5000 ft of target |
| 22 | Manually enter / edit winds per altitude | coach, nerd, flocker | D | S | "Unlock" edit mode (BACKLOG wants read-only-first) |
| 23 | Compare wind models | coach, nerd | D | S | `windCompare` / `WindComparison` |
| 24 | Switch forecast vs sounding source | nerd, coach | D | S | `windAloftSource` |
| 25 | Invert / reverse wind ("what-if") | nerd, flocker | D | S | Should trigger trust downgrade (see cross-cutting) |
| 26 | "What-if" high-vs-low wind scenarios | flocker, coach | M+D | P | Only via manual edit; no dedicated scenario UI |
| 27 | Interpolate wind between levels | nerd, swooper | D | S | `interpolateWind` |
| 28 | View compact winds on a map overlay | regular, flocker | M+D | S | `WindMiniIndicator` |
| 29 | Scrub forecast time | swooper, coach, nerd | D | S | Clears observed stations; should feed trust state |

### Courses (swoop)

| # | Task | Roles | Surface | Status | Notes |
|---|------|-------|---------|--------|-------|
| 30 | Set up a distance course | swooper | D | S | |
| 31 | Set up a zone-accuracy course | swooper | D | S | |
| 32 | Set up a speed course | swooper | D | S | |
| 33 | Position landing relative to a course / offset | swooper | D | S | |

### Presets & saved plans

| # | Task | Roles | Surface | Status | Notes |
|---|------|-------|---------|--------|-------|
| 34 | Save current plan as a preset | swooper, coach | M+D | S | Full snapshot: target + pattern + manoeuvre + course |
| 35 | Switch between saved presets | swooper, coach | M+D | S | |
| 36 | Rename / update a preset | swooper, coach | D | S | |
| 37 | Canopy preset: type/size/wingloading → auto descent + speed | regular, swooper | M+D | B | Owner backlog; not the same as plan presets |
| 38 | Save a named plan for later reference | swooper, demo | M+D | P | Presets approximate this; no dated/archived "plan" object |
| 38a | Configure on laptop, pull up the same setup on phone | swooper | M+D | B | Account sync — the anchor monetization case; see cross-cutting above |

### Flocking / spot

| # | Task | Roles | Surface | Status | Notes |
|---|------|-------|---------|--------|-------|
| 39 | Compute the spot / exit point | flocker, coach | M+D | S | `flockingSolve` |
| 40 | Generate a jumprun description for DZ/pilot | flocker | M | P | Solver exists; verify a clean shareable text/handoff output |
| 41 | Visualize the expected ground track | flocker | M+D | S | Flocking layer |
| 42 | Plan a long-spot jump | coach | D | P | Via flocking; owner wants a better dedicated way |

### Mode / navigation

| # | Task | Roles | Surface | Status | Notes |
|---|------|-------|---------|--------|-------|
| 43 | Choose a mode on first run | all | M+D | S | Picker cards |
| 44 | Switch modes without losing config | all | M+D | S | `applyModeDefaults` respects touched keys |

### Export / report / share

| # | Task | Roles | Surface | Status | Notes |
|---|------|-------|---------|--------|-------|
| 45 | Export path as FlySight CSV | nerd, swooper | D | S | `ExportDialog` |
| 46 | Export as KMZ (Google Earth) | nerd, demo | D | S | `util/exportKmz` |
| 47 | Generate a shareable report (PDF / image) | demo, coach | M+D | B | Owner interest; possibly monetizable |
| 48 | Draw hazards / annotations on the map | demo | M+D | B | Owner interest; possibly monetizable |
| 49 | Share a setup via link | coach, flocker, demo | M+D | B | Owner-prioritized (UIUX #2 / BACKLOG) |

### Settings & trust

| # | Task | Roles | Surface | Status | Notes |
|---|------|-------|---------|--------|-------|
| 50 | Change display units | all | M+D | S | `UnitPreferences` |
| 51 | Toggle crab arrow / POMs / summaries | swooper, nerd | D | S | |
| 52 | Pick map provider (Google / MapLibre) | nerd | D | S | `mapProvider` |
| 53 | See at a glance that conditions aren't jump-real | all | M+D | P | Flocking mode already warns "No wind data loaded — no-wind spot"; pattern/swoop wind panel shows 0/0/0.0 silently. Propagate the flocking pattern — see above and walkthrough |

---

## Open questions for the owner

1. **Student defaults (task 8).** `pattern` mode ships `defaults: {}`. Confirm a
   fresh student actually sees 300-600-900 + a student descent rate/speed, or
   populate the mode defaults.
   Assume it's done
2. **Explore/Data mode.** Approve the "Winds Aloft & Data" framing (serving nerd
   + demo)? If yes, next step is the concrete `Mode` object + panel.
   Approve "Nerd Mode" (and I want the name). It enables manual wind selection/invert, the "export" function (both kmz and csv). And we'll see what else.
3. **Coach presentation layout.** Any interest in a projector/teaching layout —
   the one thing that would justify a coach mode?
   Keep it as an idea here, we'll merge with the main backlogs later.
4. **Trust indicator form.** Map-corner badge on `WindMiniIndicator`, a banner,
   or both?
   TBD.
5. **Accounts & sync.** Where's the free/paid line — is sync itself the paywall,
   with local-only staying free? Which documents must sync in v1?
   TBD.

---

## Walkthrough findings (localhost:3000, 2026-07-22)

Live pass over the running app on the `flip-redesign-architecture` branch,
all three modes, desktop + mobile. Browser-automation caveats (map
click/drag not driveable, panel routes report 0x0 to `read_page`) mean map
*interactions* were read from state/DOM, not synthetic pointer events — noted
where relevant.

### Confirmed working in the UI

Mode picker + per-mode nav gating (43, 44); pattern legs/descent/GR/turn
(8–12); target edit-on-map + heading with an **Upwind** helper (6, 7);
dropzone / my-locations / location-search tabs (1, 4, 5); manoeuvre
NONE/PARAMETERS/TRACK/SAMPLES incl. initiation altitude (15–18); wind fetch,
forecast-time scrub with ± steppers, manual table, INVERT, COMPARE SOURCES,
"Open in Windy" (19, 22, 23, 25, 29); settings toggles for observed ground
wind, interpolate, winds-on-map, winds-aloft source, forecast model, drift
arrows, map provider, full units block (12, 21, 24, 27, 28, 50, 51, 52);
courses NEW with type = Distance/Zone/Speed, depth/offset, approach angle,
per-course EXPORT KMZ (30–33, 46); FlySight CSV export dialog (45); presets
save/switch menu (34–36); flocking CLASSIC/FREE/SOLVE with spot + jumprun
readout (39, 41, 42).

### Corrections & nuances vs. the code-only reading

- **Task 8 (student default) → upgraded P→S.** Fresh app state already yields
  9 mph descent, glide ratio 3, legs 300/300/300 = 300-600-900, with no
  settings touched. The empty `defaults: {}` is fine because the *global*
  defaults are already student-shaped. Owner's "assume it's done" confirmed.
- **Task 53 (trust state) → upgraded B→P.** A precedent already ships: in
  Flocking, an empty wind profile shows an orange banner — *"No wind data
  loaded — this is the no-wind spot. Fetch winds in the Wind panel for a
  forecast."* The pattern/swoop Wind panel, by contrast, shows a silent
  `0 / 0 / 0.0` row and the map draws a no-wind path with no warning. The
  work is to **generalise the flocking banner into the shared trust
  indicator** across modes, not invent it from scratch.
- **Task 3 (DZ search) stays B.** The Target panel's SEARCH tab is a
  free-text *location geocoder* ("Search location"), useful for demo/custom
  targets — but the DZ picker itself is an unfiltered MUI dropdown. No
  in-list filter, no nearest-DZ, no geolocation anywhere (task 2 also B).
- **Task 40 (jumprun handoff) stays P.** The jumprun *is* computed and shown
  ("Jumprun 0° · 3.61 mi prior", on the map pill too), but there is no
  copy/share affordance to hand a pilot — it must be read off-screen.
- **Export split.** FlySight CSV = the toolbar download dialog (whole path);
  KMZ = only inside the Courses panel (course-scoped). There is no
  general path→KMZ from the toolbar. Worth reconciling for the nerd/demo
  export story (45/46).

### Friction findings (new — candidates for UIUX.md)

- **F1 — Settings is not mode-filtered.** A Standard-Pattern student sees the
  full settings surface: forecast model, interpolate winds, drift arrows,
  "highlight corresponding pre-wind point", map provider. Directly at odds
  with "a student shouldn't have to fiddle." Modes gate *nav* and *map
  layers* but not the Settings panel contents. Consider gating settings
  rows by mode/feature too.
- **F2 — Mobile panels are full page-swaps.** Opening Wind (or any panel) on
  mobile replaces the map entirely; you lose the spot/pattern while editing.
  This breaks the core see-map-while-editing loop and is exactly UIUX #3.
  Partly mitigated for the regular-jumper refresh loop: a top-bar refresh and
  the WINDS mini-indicator refresh both work from the map view without
  opening the panel.
- **F3 — Wind table has no read-only-first state.** In the empty state the
  manual Alt/Dir/Speed row is directly editable (no "unlock"). Matches the
  BACKLOG "Winds tab: read-only first" ask — viewing should be the default,
  editing an explicit secondary mode. (Behaviour once a forecast is fetched
  not re-verified this pass.)
- **F4 — No staleness/So-what signal outside flocking.** See task 53. The
  pattern/swoop path renders identically whether winds are fresh, absent, or
  hand-entered.
- **F5 — DZ discovery is weak.** Unfiltered dropdown only; no search-in-list,
  no nearest-DZ, no geolocation. This is the regular jumper's *first* action
  at the DZ and currently the clunkiest step on mobile (tasks 1–3).
- **F6 — Mobile Wind panel is sparse.** Large empty vertical space below
  COMPARE SOURCES; layout is desktop-shaped, not density-tuned for a phone.

### Environment notes (not app defects)

- Google map imagery loads slowly / greys out on rapid route changes in this
  preview (referrer/key sandboxing). Vector overlays (pattern, manoeuvre,
  courses, flocking) always render; imagery did resolve when left alone.
- Panel routes report a 0x0 viewport to `read_page`; screenshots +
  `get_page_text` used instead.
