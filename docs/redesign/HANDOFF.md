# Redesign hand-off — start here

Entry point for a new session picking up the FliP redesign. Rewritten
2026-07-25 (winds indicator, trust banner, target + flocking map
interactions); updated 2026-07-28 at the end of the density-altitude,
per-place-memory and dropzone-data session, again same-day after the
dropzone import (59 -> 339 entries), and 2026-07-29 for the owner's
dropzone curation pass and nerd mode. The 2026-07-27 revision covered DZ
discovery, shortcuts and in-app help; 2026-07-19 covered the architecture
review, the wind-UX batch, and Phase 6 flocking.

**The owner's first dropzone curation pass landed** (`aa3c041`, `00e4ad4`):
212 entries promoted to hand-checked positions/headings, 69 removed, 4
renamed, 2 added — 339 -> **272 entries**. The conventions in "The
dropzone import" below still govern any further curation.

## Read order

1. This file.
2. `ARCHITECTURE.md` — the target design + the phased migration plan.
3. `BACKLOG.md` — everything outstanding, by scope. Kept current; the
   **"UX analysis (2026-07-22)"** section near the top holds the newest
   prioritised items.
4. `docs/ux/pain-points.md` + `docs/ux/roles-and-tasks.md` — a walkthrough
   of the running app: prioritised friction (P1–P9) and a role/task
   inventory with the trust-state, accounts-sync, and Nerd-mode concerns.
5. `NOTES.md` — running log: per-phase history, owner Q&A, commit refs.
   Read for "why is it like this", not for "what's next".
6. `UIUX.md` — UX improvements + feature ideas, ⭐ = owner-prioritized.

`CLAUDE.md` (repo root) describes the codebase and is current as of this
hand-off (structure, core modules, wind layer, flocking, indicator/banner).

## Where things stand

Branch `claude/flip-redesign-architecture-e767df`, in a worktree at
`.claude/worktrees/flip-redesign-architecture-e767df`. **Nothing is
merged to main and nothing is deployed** — deliberate (see Hard rules).

Baseline on the branch: **757 tests, 0 lint errors, 50 known lint
warnings, build green, tree clean.** (`.claude/launch.json` is untracked
on purpose — it is the local dev-server config.) Two `PlacePicker.test.tsx`
cases now run with a 15 s timeout instead of the 5 s default — the
unfiltered place-list render (still no grouping/limit — BACKLOG) scales
with dropzone count and jsdom is slow at 272 of them.

Done: **Phases 0–6.** Phases 0–5 (Vite/Vitest/TS5 · core extraction ·
map layerization · router + modes · wind subsystem · PWA) plus a
MapLibre provider and all of Phase 6 (flocking) landed earlier — see the
2026-07-19 history in NOTES.md.

This UX-iteration session (2026-07-19 → 25) added, roughly in order:

- **Compact winds indicator** (`WindMiniIndicator`): a map-corner overlay,
  every mode, showing GND + plan-relevant altitude bands (5k ceiling for
  pattern, 15k+ for flocking) with Beaufort arrows, a header refresh, a
  collapse-to-chip, tap-to-open the Wind panel, and the ground-wind
  station/forecast detail on hover. Gated by the `displayMapWinds` setting.
- **Winds subsystem changes**: fetch every OpenMeteo level to ~41k ft (200
  hPa, FWC-equivalent); the Wind panel table shows all of it; the
  "wind altitude limit" setting is gone; winds auto-fetch once on load
  (which also warms the scrubber cache).
- **Wind-trust banner** (`WindTrustBanner` + pure `core/windTrust`): one
  top-of-map verdict — none / manual / stale / fresh — that unified the
  old flocking "no-wind" text and the top-bar "verify" badge; hidden when
  fresh, amber otherwise. Fixed a related bug: unlocking winds dropped the
  top-bar avg/gnd summary.
- **Target interaction rework**: the target is now always draggable in all
  modes (no "Edit on map" mode); hover reveals the heading-rotate handle;
  shift-click the map jumps the target. The old average-wind arrow and the
  target-anchored ground-wind arrow were removed (the ground readout moved
  to the indicator hover).
- **Flocking map interactions** — see below.
- **Removed the measure tool** (to be reimplemented — BACKLOG).
- **Docs**: ported the UX-analysis docs into `docs/ux/`.

### Session 2026-07-26 → 27

Four things landed: DZ discovery (P6/F5), the leg-count fix (P9),
keyboard shortcuts, and the in-app help panel. NOTES has the reasoning
for each; the short version:

**DZ discovery (P6/F5)** — see the detail below.

**P9 — leg-count selector** hidden in Standard Pattern via a new
`patternLegCount` mode feature. The promotion to three legs is applied on
READ (`core/pattern.withFullPattern`), never written back, so a swooper's
stored two-leg choice survives a trip through the simple mode. The
pattern path moved from `useAppState` to App, which is the only place
that knows the mode.

**Target scope: place vs position** (owner report — "the DZ changes when
I switch modes"). Per-mode targets stay, but choosing a *place* (picker,
nearest-dropzone, loading a preset) now moves every mode via
`setTargetEverywhere`, which clears the per-mode overrides so even
never-opened modes follow. Dragging, shift-click and the heading input
stay per-mode.

**Winds re-fetch on a new place.** Moving beyond the 5 mi invalidation
threshold used to clear the winds and stop; the auto-fetch effect is now
keyed on where the winds were last fetched *for*, so it refetches. The
ref records the location last **attempted**, so a failing fetch cannot
spin.

**Keyboard shortcuts + `?` overlay.** `core/keymap.ts` is one table read
by both the handler (`hooks/useKeyboardShortcuts`) and the overlay
(`components/ShortcutsOverlay`), gated per mode, and it carries mouse
gestures with no keys so "how do I move the target" has an answer. `F`
hides everything but the map; `S` opens presets and 1-9 load one; `Esc`
steps back. The guard — ignore keys from inputs and from anything with
`role=menu|dialog|listbox` — is the feature, and it is what lets the
preset menu own the digits.

**Help panel** (`core/help.ts` + `components/HelpComponent`): topics as
DATA, one per panel plus How-it-works / Reading-the-map / Glossary /
Shortcuts / About. The `about` panel is gone; About is a topic and
`/about` redirects to `/help?topic=about`. Every panel header now has a
`?` deep-linking to its own topic. **The prose is placeholder** — see
"What's next".

### Session 2026-07-29 (most recent)

**Nerd mode** (`5ea378c`), and the design decision inside it: it is a
**flag, not a fourth mode**. A mode answers "what jump am I planning";
nerd answers "how much UI do I want", and they cross — manual wind entry
matters in flocking as much as under canopy, so as a mode it would have
needed nerd × 3 combinations. That also **retires the old explore /
"Winds Aloft & Data" mode** idea in BACKLOG and the roles doc; there is
no `explore` stub left to reframe.

It is applied as a *transform over the active mode* (`modes/nerd.ts`):
`withNerd(mode, nerd)` widens `features`/`nav`, so `hasFeature`, the nav,
the map layers and the keymap all gate on nerd **for free** — the `E`
shortcut and its overlay entry vanish with the Export button without
knowing nerd exists. Adding an item to nerd is one line in
`NERD_FEATURES` or `NERD_SETTING_KEYS`.

Two rules keep the gate real rather than cosmetic:

- **Hiding a control also suppresses its effect** — `applyNerdGate` at
  App's single `modeSettings` choke point. The everyday value is
  `DEFAULT_SETTINGS`, *not* "force false", with `NERD_OFF_OVERRIDES`
  holding the few exceptions: `interpolateWind` and `straightenLegs`
  default to true and must stay true, because hiding a switch must never
  silently change the path math. A test pins exactly that.
- **The gate ignores `flip.settings.touched`**, unlike mode defaults.
  Touched means "the user chose this", but with nerd off they cannot see
  the control, so a stale choice must not keep the advanced behaviour
  alive. Nothing is written back — the value is masked on read and
  returns when nerd does.

Behind it: manual wind (Unlock, Invert, row editing), both exports
(FlySight CSV, course KMZ), and two Settings rows. Off for everyone,
including upgrades. The toggle is at the **top** of Settings (toggling it
makes rows appear *below*; at the bottom the change would be off-screen)
and its only footprint outside Settings is a **NERD chip** in the
toolbar, shown only while on, which turns it off when clicked.

A second pass the same day (`3e86140`) widened it and reworked the wind
actions:

- **"Fetch forecast" and the toolbar's refresh-wind button are both
  gone.** Fetching is a refresh icon in the *Wind panel's header* (beside
  the `?`), costing no layout space; refreshing now lives next to what it
  changes, there and on the map indicator.
- **Reset moved down beside Unlock** and is nerd-only — it clears the
  profile, so it belongs with the editing actions.
- **Pattern-point hover is nerd-only** (`pointTooltips`). This was not
  just a settings row: `FlightPathsLayer` made POMs hoverable
  *regardless* of `showPomTooltips` ("POMs always have hover"), so gating
  the setting alone still left everyday users with tooltips.
  `showPomTooltips` keeps its old meaning — whether hover extends to the
  non-POM points — and now only applies when the feature is on.
- **Seven more settings** behind the flag: correct-heading, straighten
  legs, winds aloft source, forecast model, interpolate winds, observed
  ground wind, map provider. Pattern became entirely nerd-only, so an
  empty section is now dropped rather than left as a bare header.
- Their everyday value is **`DEFAULT_SETTINGS`** ("otherwise the default
  settings apply" — owner), with `NERD_OFF_OVERRIDES` holding only the
  exceptions. That is what keeps the geometry-affecting ones honest:
  leaving nerd mode gives the same paths as never entering it.

A third pass (`a07c8d6`) reworked the wind table and the comparison:

- **The Wind panel table opens as the map indicator's summary** (GND +
  the plan bands) and expands to every level and back. The sampling is
  pure `core/wind.sampleWindBands()`, called by *both* surfaces with the
  same band list from App, so "the same summary" is structural.
- **Comparison**: the sounding column was headed with its raw station id
  ("_TBW"), which told nobody the column was the radiosonde — it is
  "Sounding" now, station in the tooltip, and the footnote says what the
  comparison contains. It ignored the forecast time entirely
  (`fetchOpenMeteoComparison` hardcoded hourOffset 0, and the view only
  loaded on open); it now follows it. The self-renaming button became a
  chevron disclosure row.
- **Off-by-one in the forecast hour** (found because the new footnote
  printed the sampled hour next to the profile's valid time): the offset
  indexes an hourly series whose row 0 is the *current hour*, but was
  measured from the wall clock, so at 11:55 a request for 13:00 rounded
  to 1 and returned the 12:00 forecast. `forecastHourOffset` in
  `core/wind` is now the one definition, shared by the main fetch and the
  comparison.

Owner ruled these **out** of nerd, recorded so they are not
re-proposed: model selection/comparison, unit pickers, `showPreWind`,
`showCrabArrow`. The full 41k ft wind table still needs addressing, but
outside nerd. See BACKLOG for what is still open under it.

Verification note worth keeping: every browser check was run in **both**
states, so the pairing itself proves the gate rather than one green
reading (the same discipline as "re-run the check against the pre-change
code"). The two new component test files were also confirmed to fail with
the gate removed.

### Session 2026-07-28

Five commits, `7c3b867`..`779afff`. Every one browser-verified before
committing, and the browser caught two things the unit tests could not
(noted below, because that pattern keeps paying off).

**Temperature, humidity and density altitude** (`7c3b867`). New pure
`core/atmosphere.ts`: station pressure estimated from field elevation via
the ISA standard atmosphere, virtual temperature folds humidity in, the
ISA density relation inverted. Shown in the Wind panel, the top bar and
the map indicator, with an em-dash where a source has nothing so
"unknown" reads differently from "zero". Sourcing prefers the observed
station, then the forecast; NWS humidity is derived from temp+dewpoint
(the API never sends it, which is why the station card's Humidity row had
always been blank). DA is tinted by delta above field elevation
(>=1000 caution, >=3000 warning); temperature absolutely
(<=5 C, >=28 C, >=35 C — owner's numbers). All thresholds are named
constants and the tests assert against them, not literals.

**Places remember** (`3128d21`). Owner report: adjust the target at
Kapowsin, go to ZHills, come back, adjustment gone. It was lost on the way
*out* — selecting a place wiped `flip.targets.byMode`, the only home for a
shift-click. Now `flip.targets.byPlace` keyed by `Place.id`, with the
active one in `flip.place.active`; every positioning edit writes through
immediately, so there is no snapshot-on-leave to go stale. The pinned Spot
Reference rides along (a second owner report: a spot reading "4538.02 mi
prior" after a DZ change — it is the only other absolute coordinate in the
app, so left behind it was measured against the new dropzone).

**Dropzones seed each mode** (`3128d21`, refined in `cb01dd0`).
`Dropzone.modes` keyed by mode id: a swoop pond away from the student LZ,
a flocking end point, and for flocking the DZ's corridors and canonical
Spot Reference. Precedence is user edits -> what the DZ declares -> the
DZ's plain coordinates. Corridors never travel: a place that declares none
and has no edits has none, and "Reset to default" in the Corridors section
discards the edits. Speeds, window altitudes and ring radii deliberately
stay out — they describe the flock, not the place.

**Pattern params are per-mode** (`cb01dd0`), `flip.pattern.byMode` falling
back to the shared legacy value. A swooper's descent rate no longer
follows them into Standard Pattern. This also dissolved a bug the previous
session had flagged as an open question: Standard Pattern used to write
`type: 'three-leg'` back into shared storage, clobbering a swooper's leg
count. With per-mode storage that write lands in pattern mode's own entry
and is simply correct, so no decision was needed.

**Dropzone data** (`aa123df`, `779afff`). Optional `website`, linked from
the picker row. Structured `town` / `region` / `country` instead of a
keyword bag — the terms the owner wanted ("eloy", "zephyr", "arizona")
are all location, and as fields they also give the picker a subtitle.
Short forms live in one table (`core/regions.ts`), not repeated per entry.
Search scores each field separately and takes the best, and drops
subsequence-only hits once anything matches properly — "eloy" used to
return *Skydive Pink Klatovy*.

**Two things only the browser caught.** Both had a green test suite and
correct localStorage at the time:
- Temp/humidity vanished on any forecast change. `migrateStoredWinds`
  whitelists fields for the `flip.winds` round-trip and predated the new
  ones, so every `setWinds` silently stripped them. First fetch looked
  fine; scrubbing an hour did not.
- The Pattern panel kept showing the previous mode's numbers after a mode
  switch. Its number fields are uncontrolled (`initialValue`), so the panel
  is now keyed on `mode.id`.

### DZ discovery, in detail (P6/F5)

- **Dropzone data**: FWC's list ported in, 14 → 58 dropzones. The
  imported ones have ~100 m coordinates and no landing heading, so
  `Dropzone.direction` is now optional and a place with no heading lands
  **into wind** on select.
- **The place picker** (`components/PlacePicker.tsx` + pure
  `core/places.ts`): the three-tab Locations panel became one search box
  over one list — saved places first, then dropzones, then the geocoder's
  hits in the same list. Star a dropzone to save it (favorites are stored
  as *names*, so dropzone-data fixes reach them); custom places rename /
  move-to-current-target / delete in place.
- **Geolocation exists now** (`hooks/useGeolocation.ts`), opt-in behind
  "Nearest dropzone": nothing runs until it is tapped, and denial,
  timeout or no-geolocation-at-all all leave the picker fully usable.
- **Place search is a promise API** (`searchPlaceSuggestions` +
  `resolvePlaceSuggestion`) instead of the old attach-to-an-input widget,
  and it **loads the Maps API itself** — see NOTES: on mobile the panel
  replaces the map, so the geocoder used to be silently dead exactly
  where it mattered most.

### Flocking, in its current shape

Three sub-modes in one panel (see CLAUDE.md for the module map):
**classic** (FWC parity), **free** (you place the jumprun, exit and
canopy direction), **solve** (describe corridors, the app picks).

The solver is analytic, not brute force: per canopy-direction sample the
best exit is the clamped projection of `target − Δ` onto the corridor
rectangle, and the canopy arc is sampled at 0.5° centre-outward. Its
*selection rule* matters as much as its math — misses are tiered by the
green/yellow rings, and corridors that both reach green are separated by
which run is most into the wind. That was the fix for a real complaint:
scrubbing the forecast used to flip the answer between a north and a
south corridor on noise. A brute-force oracle test guards the math; a
13-point wind sweep guards the stability.

Corridors are nameable and individually enable-able ("North / South /
East", untick East at ZHills). Disabled ones stay configured, leave the
solve and vanish from the map. Names are labelled on the map at each
corridor rectangle's far edge; corridor rows collapse (checkbox + verdict
stay visible). The spot readout on the map now includes the crosswind
offset. POM altitude labels thin out by zoom (max one per 1000 ft).

### Flocking map handles (2026-07-25 — still unverified by a real pointer)

The drag-handle set was reworked and is the least-tested part.

- **Free**: exit (green) translates the run; a white handle at the jumprun
  *start* rotates the run about the exit; a cyan handle at the *end* of the
  canopy flight rotates the canopy about the exit (jumprun static); a
  magenta handle at the *middle* of the flight rotates the canopy about the
  *finish* (finish held, exit repositioned via `core/flocking.exitForFixedEnd`
  using the exact no-wind flight length so it doesn't drift).
- **Classic**: exit (green) translates everything (moves the target); the
  magenta middle-of-CF handle rotates about the target.
- Rotation handles are **`pinned`** (a `MapDragHandle` mode): they stay on
  their line and the drag only feeds the angle. The middle-of-CF handle
  anchors to the actual (wind-curved) path midpoint.
- Map handling during a handle drag: the camera never pans
  (`MapInteractions.setHandleDragging` suppresses the target-follow `panTo`;
  a per-handle centre-freeze also cancels Google's edge auto-pan). These
  were bug fixes this session (a stack overflow from the freeze, a marker
  left at the drop point, the camera chasing the target on the classic exit
  drag) — all fixed but **unverified by a real drag**.

### Two real bugs an earlier session found and fixed

- **`addWind` curved paths.** Drift was accumulated in polar form
  (distance + a bearing re-derived spherically each step); the bearing
  wandered a fraction of a degree, which was invisible normally but
  amplified into ~14° of curvature when the drift nearly cancels the
  flown line (flocking straight into a strong wind). Now a flat
  east/north vector sum; a regression test pins uniform wind to < 0.05°
  of bearing spread. Golden values shifted sub-foot.
- **FWC's left/right flag inverts for PAST exits.** Its formula expands
  to `along × side`, so the reported side flips with prior/past even
  though the exit never changes sides of the line. FliP now reports the
  geometric side always. **The same bug is still live in FWC itself** —
  worth fixing upstream (owner's call).

## The dropzone import (done 2026-07-28) — curation next

The owner's list (`/tmp/flip-dropzone-candidates.csv`, 310 rows, mixed
USPA-directory and OSM sourcing) is imported: 280 new entries, 30 rows
dropped as duplicates of the existing 59 (matched by name, then by real
haversine distance under ~1 km — not just the test's `toFixed(2)`
coordinate-rounding guard, which would have missed several: e.g. "Kapowsin
Air Sports" vs "Skydive Kapowsin", "SkyDance SkyDiving" vs "Skydive Davis",
"Jumptown/MSPC, Inc." vs "Jumptown" — same DZ, different operator/business
name in the source data). 59 -> 339 entries.

Fields filled per row: `country` always; `region` from the CSV `state`
column, expanding US-state and Canadian-province abbreviations and the
UK's bilingual forms ("Alba / Scotland" -> "Scotland") to match the
existing full-name convention; `website`, upgrading `http://` to
`https://` unconditionally (required by `dropzones.test.ts`, not
individually verified — a curation item). `town` was **only** filled for
the ~33 rows whose source was structurally reliable (OSM "town-level
fallback" query results, which by construction resolved to the town
itself) — left blank everywhere else rather than guess from multi-language
free-text address strings (the CSV's `notes` column), which is what the
previous 34-town batch already flagged as unverified. All 280 are
bulk/~100-500 m precision with no landing heading, same shape as the
existing FWC-ported set.

**Curation still open** (this was always going to be a second pass):

- Verify/tighten coordinates and add landing headings — the bulk of it.
  325 of 339 have no `direction` yet (only 14 were ever hand-checked).
- Spot-check the `http`->`https` upgrade on the ~230 sites it touched —
  not fetched or verified, just string-substituted.
- Consider filling `town` for the ~230 rows that have no town at all
  (mostly `USPA directory` and `OSM sport=parachuting` rows, which carry
  no locality data in the source — would need a separate geocoding pass,
  not a notes-field guess).
- A few CSV rows had odd `state`-column data worth a second look during
  curation: Abu Dhabi Skydive's region is literally "Al Smeih Area" (a
  district, not an emirate) and Venezuela's row packed town+region into
  one quoted field ("Higuerote, Estado Miranda") — both were parsed
  through, not verified against a source.

What the importer had to satisfy — all of it enforced by
`src/util/dropzones.test.ts`, which is the cheapest way to check an import,
and still the checklist for hand-curating individual entries going forward:

- **No duplicate names, and no two entries within ~0.01 deg** of each
  other. The second one is the real guard: the same DZ under two spellings
  is exactly what a bulk import produces. Expect collisions with the 339
  entries already there.
- **The list is sorted by name** for display.
- **`country` is set on every entry.** The other location fields are
  best-effort and only shape-checked.
- **`website` must be `https://...`** if present.
- **`modes` keys must be real mode ids**, and a per-mode entry must have
  both `lat` and `lng` or neither.
- Headings are `0 <= direction < 360`; `0,0` is rejected (it was the FWC
  "CUSTOM" sentinel).

Conventions worth keeping straight during curation:

- An entry with a **`direction`** is hand-checked against imagery — the
  coordinates are the landing area and the heading is the usual landing
  direction. An entry **without** one came from a bulk import (FWC
  originally, now also the owner's CSV) at ~100-500 m precision, and
  selecting it lands into wind. Promoting an entry means tightening the
  coordinates *and* adding the heading. 325 of 339 are still unpromoted;
  that is the bulk of the curation.
- **`town` is filled for 74 entries and blank for 265.** The blanks are
  deliberate, not forgotten — most of the CSV rows had no locality data at
  all (`USPA directory` / `OSM sport=parachuting` sourcing), and the ones
  that did weren't guessed from free-text addresses unless the source was
  structurally reliable (see the import section above). The town values
  that *are* filled are a mix of provenance: some from a previous agent's
  own knowledge cross-checked against coordinates (**not from a checked
  source**), some parsed straight from the CSV's OSM data — both worth
  spot-checking during curation. Kapowsin is the one to check first
  (recorded as Shelton, WA on the basis that it relocated).
- The **flocking corridors on ZHills** are the same N/S pair that is still
  `DEFAULT_FLOCKING_PARAMS.solveCorridors`. Now that a DZ can declare its
  own, that app-wide default is arguably in the wrong place — worth
  raising when the list is being curated.

Likely worth doing as part of the import, if the owner agrees: a
`verified` flag or equivalent, so "hand-checked" stops being inferred from
the presence of `direction`.

## What's next

**The immediate one: the help text.** `core/help.ts` has a topic per panel
with placeholder prose written by an agent from reading the code. The
structure is done and tested; the words are the owner's to write. Two
entries need his eye before anyone trusts them:

- **Courses** — the distance / zone-accuracy / speed descriptions were
  inferred from type names and geometry, not from how they are judged.
  Treat as unverified.
- **How FliP works** — this is the P1 teaching text. It should sound like
  the owner explaining it to a student, not like an agent's paraphrase.

Then, owner priorities most-ready first (the dropzone import above comes
before all of these — it is already agreed):

| Item | Notes |
|---|---|
| **Owner feedback on what shipped** | Place picker, shortcuts, focus map, help panel — all browser-verified, none used in anger |
| **P1's other half** | The Help topic gives dashed-vs-solid a home, but only for someone who goes looking. A legend or first-run pointer ON the map is still the higher-reach half |
| **Trust banner → help link** | The banner says "don't trust this"; "why?" has an answer now (`/help?topic=winds`) but nothing links to it. Small and obvious |
| **Flocking shortcuts** | Rotate jumprun, step the exit along it, cycle sub-mode, toggle a corridor by number. The keymap is ready for them |
| **Corridor direction ranges** | "anything 250–290°" — solver structure supports it, schema stores fixed headings. Small |
| **Landing headings for the imported DZs** | 44 of 59 have ~100 m coordinates and no heading; promote them as they are checked against imagery. Folds into the import/curation session |
| **Dropzone `timezone`** | Deferred by the owner this session. Forecast times render in *browser* local time, so a coach planning a DZ two zones away reads the wrong clock |
| **UX-analysis items** | Remaining: mode-filtered Settings (P4), wind panel read-only-first (P3), course Type up front (P5), mobile panels page-swap the map (P7), jumprun handoff copy/share (P8) |
| **Trust state — finish it** | `◐`: out-of-bounds "silly value" call-out, stale-age tuning |
| ⭐ **Shareable setup links** | Needs a *design session with the owner*; fragment-encoding proposal parked in BACKLOG |
| **Better wind visualization** | windy.com-like particle/flow rendering. ✎ design |
| **Phase 7 — documents & logbook** | Prerequisite for the backend tier and the whole Review pillar |
| **Flocking wishlist** | Reverse build, jump profiles (runback), groups/separation, handoff to landing pattern, reachability zones. `core/reach/` before the zones |

### Open design decisions (2026-07-27 session)

- **`G` for the flocking panel** is the one awkward key: `F` went to
  focus-map (global, more guessable). One line of data in `core/keymap.ts`
  if the owner wants them swapped.
- **`?` opens the shortcuts overlay, not the Help panel.** Deliberate: the
  overlay floats over what you are doing, and `?` is useless without a
  keyboard anyway. Contextual entry is the per-panel `?` icon instead.
  Owner has not yet said whether he agrees.

## Hard rules (these come from the owner — do not relax them)

- **Never push, deploy, or merge.** Local commits only.
- **Never deploy or prepare deployment for flip-next.mustelinae.net**
  unless the owner explicitly asks in that conversation.
- **Never force-push.**
- Dependency changes need a reason and are approved case-by-case. MUI is
  pinned at 7 while Toolpad is in use; `socket.io-client` stays 2.5.0
  (Spaceland speaks the v2 protocol). RTL + jsdom were added for tests.

## Working agreements that earned their keep

- **Commit every green slice immediately.** Agents on this branch have
  repeatedly been killed by API session limits and outages; the ones that
  committed per slice lost nothing. Keep `npm test`, `npm run lint`
  (0 errors, ≤ 50 warnings) and `npm run build` green per commit, and
  note in the body what was browser-verified.
- **Tests lead refactors** — pin current behavior before moving code.
- **Verify before building.** Every external dependency is checked
  against the real thing first (CORS, that a URL resolves, that a claim
  about a station is true).
- **Don't fix a phantom, and don't trust a green automated check
  blindly.** Two examples from this session: a "bug" that was really the
  automation clicking the wrong thing, and — more instructive — a
  browser check that *appeared* to confirm a fix but proved nothing,
  because automated map clicks never reach the Maps handler at all. The
  way that was caught: re-run the same check against the pre-change code
  and see whether it behaves identically. If it does, the check is
  worthless. Prefer a unit test of the actual contract.
- **`core/` may not import React, components, hooks, I/O or map code**,
  and `src/map/layers|components` may never import a concrete map
  provider. Both rules are currently clean — keep them so.

## Environment gotchas

- **Dev server**: use the `flip-dev` launch config (`.claude/launch.json`,
  untracked). Port 3000 is usually taken by the owner's own server;
  `autoPort` handles it. `.env` holds `VITE_GOOGLE_MAPS_API_KEY`.
- **One driver at a time.** Don't drive the browser or the worktree while
  an agent is working in it. A stray `npm test` launched in the *main*
  repo (not the worktree) hangs forever — that's the old CRA jest
  watcher; the worktree's `npm test` is Vitest and exits.
- **Browser automation limits, measured:** coordinate clicks frequently
  do not reach the Google Maps click handler; synthetic drags do not
  drive the map drag handles; wheel-zoom can hang the tooling;
  `read_page` sometimes reports a 0x0 viewport on panel routes. DOM
  queries, `javascript_tool` and screenshots are reliable. Reading
  values back synchronously after dispatching an input event shows the
  pre-React value — await a tick. React derives `onMouseEnter/Leave` from
  `mouseover/out` — dispatch those, not `mouseenter`, to trigger hovers.
- **Google Maps imagery is flaky in the preview**: it greys out / doesn't
  fully initialise on rapid reloads (referrer/key sandboxing). The vector
  overlays (paths, handles, markers) still render on the grey background,
  so most checks work; if `.gm-style` isn't found, wait and retry, or read
  the overlays regardless. The **fullscreen control was moved to
  bottom-right** but couldn't be visually confirmed for this reason.
- **Service worker only exists in a production build** — verify PWA
  behavior via `npm run build && npm run preview`.

## Never exercised by a real pointer

Everything below works by unit test and by DOM inspection, but automated
drags cannot drive them (Google-marker drags/hover don't reach the
handlers here). This is the **top verification priority** — a lot of this
session's work is drag-shaped. Ask the owner to try, or verify another way:

- **All flocking map handles** (the reworked set above): exit-translate,
  jumprun-rotate (at the run start), end-of-CF and middle-of-CF canopy
  rotates, in both free and classic. Confirm: rotation handles stay pinned
  on their line (no flicker), the free finish doesn't drift across repeated
  middle-handle rotations, the classic exit translates everything, and the
  camera never scrolls while dragging any handle.
- **Target handle** (all modes): drag to move, hover to reveal the
  heading-rotate handle, shift-click the map to jump it. The map must stay
  put while dragging.
- The **Spot Reference** drag (dragging pins it).
- **A real geolocation grant** ("Nearest dropzone" in the Target panel).
  The permission prompt cannot be answered from automation, so only the
  denied and unavailable paths were exercised in a browser; the granted
  path is unit-tested only.
- **Keyboard shortcuts under a real keyboard.** Every binding was driven
  by synthetic `KeyboardEvent`s, which bypass focus: in particular the
  guard that ignores keys inside menus and dialogs was only exercised by
  unit test, because synthetic events dispatched on `window` never have a
  menu as their target. Worth one real pass: type in a numeric field and
  confirm nothing fires, open the preset menu and confirm 1-9 load
  presets without also switching mode.
- **Focus map (`F`) and the help `?` icons on a phone.** Verified at
  375px in the preview, not on a real handset.
- The **winds indicator hover** works via real DOM (not a marker), so it
  *was* verified — ground-station detail shows on GND-row hover.

## Owner decisions recorded (most recent first)

Recorded here because they were judgement calls, not deductions.

**2026-07-28:**

- Temperature thresholds are the owner's: 5 C cold, 28 C hot, 35 C very
  hot. Density altitude is judged as a delta above field elevation, not
  absolutely.
- Target adjustments are **auto-remembered** per place (picked over an
  explicit "pin my spot here" button, and over telling users to save a
  custom place).
- Corridors are strictly per-dropzone and do **not** travel; a DZ with
  none configured shows none. "Reset to default" restores what the
  dropzone declares.
- Flocking's per-DZ config is position + corridors + Spot Reference, and
  deliberately **not** speeds, window altitudes or ring radii. No landing
  heading for flocking — it has no final-heading UI.
- Search uses structured `town`/`region`/`country` plus a shared
  abbreviation table, **not** per-entry keywords.
- `timezone` on dropzones: deferred, not rejected.

**2026-07-27:**

- Dropzone list: no distances in the picker results ("not useful"); keep
  Google Places rather than switching everything to Photon; no top-bar
  location chip (switching DZs is rare, the map already shows where you
  are); landing heading is not important — set it into wind when unknown.
- Panel shortcut keys are letters, not numbers. `Esc` behaviour was left
  to the agent's judgement (it is layered: leave focus map, else close the
  panel). The first-run "press ?" hint was wanted.
- Help absorbs About, and needs a reference entry for every panel's
  controls — "if a user doesn't understand a piece of UI they can find a
  reference" is the acceptance test for the content.

## Open questions for the owner

- Higher-res PWA icons (current ones are the pixel-art logo upscaled).
- "Initiation altitude not saved?" — could not reproduce; needs a repro
  or closure.
- Default pattern params: backlog says "3:1 glide, 8 kts descent" but the
  current default is 9 **mph** — the unit is ambiguous, unresolved.
- Should FWC itself get the PAST left/right fix?
- Should presets (and later share-links) snapshot `flockingParams` too?
  They currently do not.
- Improved KMZ export, preset UX, course stats, distance-course marker
  spacing, "wind code" — all need the owner's intent.
- Observability tool choice (replacing Google Analytics).
