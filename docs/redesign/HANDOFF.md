# Redesign hand-off — start here

Entry point for a new session picking up the FliP redesign. Last revised
**2026-08-08**, after a backlog re-check pass. Sessions are logged
newest-first below; each one says what changed and what it left open, and
`NOTES.md` has the reasoning behind every entry.

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
hand-off: structure, core modules, the wind layer, flocking and the spot,
the manoeuvre model, per-place memory, nerd mode, and the **UI conventions
table** — the one place that says which shared component to reach for.

## Where things stand

Branch `claude/flip-redesign-architecture-e767df`, in a worktree at
`.claude/worktrees/flip-redesign-architecture-e767df`. **Nothing is
merged to main and nothing is deployed** — deliberate (see Hard rules).

Baseline on the branch: **930 tests in 46 files, 0 lint errors, 52 known
lint warnings, build green, tree clean.** (`.claude/launch.json` is untracked
on purpose — it is the local dev-server config.) Two `PlacePicker.test.tsx`
cases used to need a 15 s timeout for the unfiltered place-list render; the
Location rework removed the unfiltered render and both are back on the
default.

Done: **Phases 0–6.** Phases 0–5 (Vite/Vitest/TS5 · core extraction ·
map layerization · router + modes · wind subsystem · PWA) plus a
MapLibre provider and all of Phase 6 (flocking) landed earlier — see the
2026-07-19 history in NOTES.md. Everything since has been UX iteration on
owner reports; the sessions below are that work, newest first.

The oldest of them, the UX-iteration session of 2026-07-19 → 25, added
roughly in order:

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

### Session 2026-08-08 (4) — Target becomes Location

**The panel no longer edits the target — the map does.** The final-heading
field and its "Upwind" button are gone (the last target-editing left in it),
the intro paragraph with them. It opens with a **hero card**: the active
place's name in display type, town/region/country, coordinates, star,
website, and how far the target has been dragged off the dropzone with a way
back. **Your places is ONE list**, saved first then recent — they overlap, so
two headed lists would show a used favorite twice, and the star on each row
both marks and moves a place between the halves. **Recents** are new
(`flip.places.recent`, six, snapshots not references — a geocoder hit is in
no database; only the picker writes them). **The dropzones only appear when
searched**, or under an "All dropzones" disclosure grouping all 274 by
country.

**The heading keeps the keyboard, and gained a fine step**: `<` `>` five
degrees, `,` `.` one, `u` into wind. Settings gave up `,` and took
`shift+s`. Since a phone has no keyboard, **clicking the map's rotate handle
snaps the heading into wind** — the owner picked that over a new map button.

Four bugs, each pinned by a test that fails without its fix:

- Confirming a row's rename dialog **also selected that row** — a portal is a
  DOM escape but a React child, so the click bubbled to the place row.
- Starring a dropzone **removed it from "All dropzones"** (and from its
  country's count).
- **`DEFAULT_TARGET` sat ~250 ft and 90° from the ZHills entry** it is paired
  with, so a fresh install opened saying "target moved 258 ft" with nobody
  having moved it. The dropzone entry wins.
- **MapLibre's drag handle fired `onClick` at the end of every drag**, against
  its own contract — which would have snapped the heading into wind after
  every rotate drag on that provider.

The **exact heading came back behind nerd mode** (`headingField` in
`NERD_FEATURES`), between the hero card and the search — it edits the same
value the handle does, so gating it changes no path math. Flocking suppresses
it regardless.

Side effect worth knowing: the suite went from **31s to 9s**, since both
`PlacePicker` 15-second timeouts are gone — the unfiltered 274-row render was
the cost.

⚠️ Not verified by a real pointer: the click-the-handle-for-upwind gesture.

### Session 2026-08-08 (3) — the phone toolbar, and an empty map explained

Three owner reports from using the split on a real phone.

**The top bar rendered badly.** The observed-conditions eye drew at 24px
because its `sx` sat on the Tooltip rather than the icon; the readings wrapped
under their own labels; and the group overflowed, clipping the density
altitude off the right edge. Fixed, and **DA is not shown in the bar at
375px** — it is the only item there that is also somewhere else (the winds
indicator's header, the Wind panel). The toolbar still takes **two rows** at
that width: AVG + GND + mode switch + presets are 344px of the 355px
available, so one row would mean losing a reading. Owner's call — BACKLOG
has it under Polish.

**Flocking could look broken.** In solve, when no corridor reaches the target
the map draws NOTHING and the top bar's spot goes with it — which is exactly
the state you land in after moving to another dropzone, since corridors never
travel. The map now says which it is (`MapNotice`, shared with the wind-trust
banner, and the two stack). This was the owner's "I only see the spot
reference and the target".

**Pressing the map closes the panel on a phone.** The click registry gave a
click to one handler only; a registration may now `observe` — always
notified, never consuming — so shift-click still moves the target. The
winner-selection rule moved to `map/clickDispatch`, shared by both providers
and now tested.

### Session 2026-08-08 (2) — three backlog items, re-checked

The owner named three entries and asked which still applied.

**The map now stays on screen when a panel is open on a phone** (P7/F2,
closed). They split the screen — map on top at 40%, panel scrolling below,
a chevron on the divider collapsing the map to an 88px strip. The panel used
to render INSTEAD of the map, which also **unmounted** it on every panel
visit: tiles reloaded and the camera was lost. A split rather than a
floating bottom sheet, because the map's corner furniture (the fullscreen
control is bottom-right) would end up under a sheet, and because a sheet
needs camera padding that neither provider exposes; 88px rather than zero,
so the provider is never handed a zero-sized viewport. The winds indicator
takes a `compact` prop for the strip: chip form, no expand chevron, stored
preference untouched.

Fixed on the way: **the app bar overhangs `main` by ~34px at 375px** —
Toolpad reserves one toolbar height and the bar's contents wrap to a second
row — which had been hiding the winds indicator's own header (refresh
included) on the mobile map view too. `useAppBarOverlap` measures it.

**Select-on-focus got a rule and the fields it had missed.** It was done for
numbers (`NumberField`); the same argument covers fields that cannot be one
— a course's name and lat/lng, a corridor's name, the export dialog's ground
elevation, and both rename dialogs, which open on the current name.
`components/selectOnFocus` is the one handler, listed in CLAUDE.md's
conventions table. Free text and native date/time inputs are excluded on
purpose.

**The Phase-N follow-up lists were re-checked entry by entry.** Two were
already fixed (the target/heading handle overlap — solved by placing the
rotate handle 44 **pixels** out rather than a fixed distance in metres; the
mode-picker cards' accessible names) and one was obsolete
(`attachPlaceAutocomplete` is gone — place search is a promise API); at the
owner's instruction those were **deleted from BACKLOG rather than ticked**,
along with the manoeuvre offset bug, which emptied the Phase-2 and Bugs
sections outright. NOTES keeps the reasoning. One entry turned out to be
**latent rather than live**: Settings does show stored rather than effective
values, but all three modes declare `defaults: {}`, so nothing is overridden
today and there is no discrepancy to indicate. `SECONDARY_PANELS` is left
open with an argument against doing it.

⚠️ Worth a real device: the split's default 40% and whether the divider
should be draggable rather than a two-state toggle. A toggle was chosen
because a drag is one more thing automation here cannot verify.

Verification note worth keeping: **a scripted `element.focus()` does not
reach React's `onFocus`** in this browser tooling — the page is not the
platform's focused window, so no focus event fires at all. Dispatch
`focusin` instead. A green check from `.focus()` would have proved nothing.

### Session 2026-08-08 — UI consistency, and three small ones

**The panels were audited end to end and the drift removed.** One numeric
field (`components/NumberField`, replacing three implementations), one
section heading (`PanelSection`), one disclosure (`DisclosureRow`), one
button vocabulary, one reset idiom, and one map-label style
(`map/layers/labelStyles.mapLabel`) in place of thirteen. `NumberInput` is
deleted, and the Flocking panel's remount-key counter went with it: a
controlled field re-syncs on its own. Two structural fixes came out of it —
Courses was rendering its own title under the panel header's (the panel
said "Courses" twice), and the panel container was centring text with an
`alignItems: 'left'` that is not a value `align-items` takes, so every
panel undid it by hand and anything that forgot came out centred.

**The table in CLAUDE.md ("UI conventions") is the vocabulary.** Reach for
a shared piece before writing a new look; that table is the whole list.

Three small items the same day:

- **A sounding says how far away it is, from the target now.** The distance
  it used to print was measured at fetch time, from wherever the profile
  was fetched for — and a profile outlives a move to another dropzone.
  `meta.stationLocation` is stored, the panel re-measures, and older
  profiles fall back to the fetched number with "away" instead of "from the
  target".
- **`Shift+X` mirrors the manoeuvre** (`core/manoeuvre.mirrorManoeuvre`:
  flip `turnDirection` for a parametric turn, `sampleLeft` for a sample,
  the points themselves for a recorded track). This needed `eventToCombo`
  to stop folding shifted letters onto their unshifted binding — a change
  with one cost, pinned by a test that used to assert the opposite:
  **`Shift+P` no longer opens the Pattern panel**, and no shifted letter
  falls through any more.
- **Beaufort colour reaches the top bar**, closing that backlog item.

⚠️ Noticed and left alone: **Settings has no `?` in its header** while every
other panel does — it needs either a help topic or a decision to drop the
icon there.

### Session 2026-08-03 — the spot, the ghost, and a storage hole

**The spot became flocking's headline** (P8 closed). One formatter,
`core/spotText.formatSpot`, writes "Jumprun 248˚ · 3.41 mi prior · 0.42 mi
left" for every surface: the panel's sticky hero (display type, top of the
panel), the top bar — which in flocking shows the spot INSTEAD of avg/gnd
wind, since the map's winds indicator already carries that — and the map's
pill at the exit. The first two copy on click (or open the share sheet);
the map label deliberately does not, because Google's `overlayLayer` pane
takes no mouse events and the panes that do would shadow the drag handles
beside it. The copied text is the spot alone, by the owner's call: no
dropzone, corridor name or forecast validity. A `verdict` ("MISSES by 0.80
mi") shows beside the spot everywhere and is never copied — it describes
the jumper's setup, not where the plane should fly.

**"No place" could not be stored** (owner report: pick a Google result with
no dropzone matches, get a stale Spot Reference and a "1000 mi PAST"
spot). Toolpad's `useLocalStorageState` deletes the key when handed null,
and a deleted key reads back as the key's default — ZHills, for
`flip.place.active`. So a geocoder hit left the app believing it was at
ZHills from the next render on, and every later edit (target drag, pinned
reference, course) was filed under that dropzone; returning to it restored
another continent's coordinates. **Not flocking-specific** — flocking is
just where the number is printed; the same write corrupts every mode's
per-place target and points the Courses panel at the wrong dropzone.
Fixed by storing "nowhere" as `NO_PLACE` (`''`), plus `nearbyMemory`,
which ignores a remembered target or reference more than 25 mi from its
place and so heals storage the bug already wrote. Only that one key had
the hole; the others' defaults are null anyway.

**The initiation handle moved to the still-air path** (the dashed pre-wind
line). It sat on the wind-corrected path, which inverted the direction the
app runs in: a turn is set up in still air and the correction is the
OUTPUT, so the handle was an input dressed as a result. Only the frame was
wrong — the drag was already resolved in still air, and that arithmetic
was exact rather than approximate (the drift over the turn depends only on
altitude and duration, so it is the same vector wherever the handle lands:
measured at 0.005 ft over a 300 ft drag).

**Flocking's no-wind ghost is drawn from the exit** (`anchorAtExit`). The
model builds both paths sharing an END, because `addWind` holds the
landing point and walks the drift backwards — right for measuring, wrong
for drawing: the ghost began at the exit you would have needed in still
air and finished on the target. It now leaves the aircraft where you do,
and the gap at the far end is the drift. `flockingVectors` and
`averageWind` keep the end-aligned pair, since both measure the gap
between the two paths.

⚠️ **Left open**: `ManoeuvreHintLayer`'s entry arrow and rotation label
still anchor to the drawn path, so they no longer sit at the initiation
handle — the two ends of one turn are drawn on different lines. Anchoring
the hint to the still-air path is the consistent move for a parametric
turn; for a recorded track the drawn line is the one that was flown.
Owner's call.

### Session 2026-07-30 — the manoeuvre's parameters

**The manoeuvre's parameters were reworked** (`0328ddb`, `c5bd838`), on an
owner report that left/right was described relative to the target when it
should be relative to the final direction of flight. Three defects sat
behind that in one small model — `left` named the target's side rather
than the turn (its `left: true` geometry was a right-hand 90), the offsets
ran along local axes rather than the final heading, and the sign of
`offsetXFt` was folded into the final bearing, so a negative depth rotated
the whole manoeuvre 180 degrees instead of moving the rollout. Rotation was
hardcoded to 90, so a 270 could only be approximated.

Now `turnDirection` + `rotationDeg` + `depthFt` + `offsetFt`, in the frame
of the final heading, entry heading derived. The path is a solved arc plus
a rollout (closed form; for a 90/270/450 the radius equals the offset).
The offset is signed against the TURN, not absolutely — the absolute
convention does not merely read badly, it is unflyable when you flip the
direction. Stored values are not migrated (owner's call). The `none`
manoeuvre type is gone: that is Standard Pattern.

Also: the Manoeuvre panel was reordered and moved to compact Courses-style
fields, with rotation as preset buttons; a new `ManoeuvreHintLayer` draws
the final axis, the entry heading and the rotation on the map (measured
from the path, so tracks and samples get it too), behind
`showManoeuvreHint`. See NOTES for the reasoning, the two bugs it
surfaced, and why `pipeline.test.ts` now holds its manoeuvre as literal
data.

☑ **The `correctPatternHeading` kink was fixed** the same week, in
`4eda10b`: App passes `correctPatternHeading && manoeuvreConfig.type !==
'parameters'`, so the ±90 snap survives for tracks and samples (which are
a few degrees off and want it) and never touches a parametric turn (which
knows its entry heading exactly). `reposition` still takes paths rather
than the config, so the decision is made where the config is known — at
the one call site, and it is not covered by a test.

### Session 2026-07-29

**Courses are per-dropzone.** `CourseParams.placeId` (a `Place.id`) scopes
the shipped courses and the user's own with *one* field — the alternative,
putting shipped courses in `Dropzone.modes.swoop` beside flocking's
corridors, would have needed a second mechanism for custom ones, since a
user cannot edit `util/dropzones.ts`. The Courses panel lists only what is
at the active place, grouped under its name; "New" creates a course there;
choosing another dropzone drops a selection belonging to the one being
left (in `selectPlaceTarget`, not an effect — see NOTES for why). Two
escapes keep it lossless: a course with no `placeId` belongs nowhere and
is offered everywhere (that is every custom course saved before this), and
`Preset.placeId` restores dropzone and course together, with
`PlaceSelection.useGivenTarget` so the preset's target still beats what the
place remembers. Built-in ids are unchanged so stored selections resolve;
their names lost the DZ prefix. Owner decisions are recorded below.

Owner report the same day: a fresh load sat at ZHills (`DEFAULT_TARGET`'s
coordinates) but showed no courses — `flip.place.active` defaulted to
`null`, and courses now filter on it. Fixed by defaulting that key to
ZHills' place id (`DEFAULT_ACTIVE_PLACE_ID` in `useAppState.tsx`) rather
than null; `resetAll` restores the same pairing. Only applies before any
place is ever explicitly stored.

**The Courses panel was reworked** on top of that: the list is a radio
list (only ever a handful at one DZ), "New" is a type menu that names and
orients the course for you, the selected course's fields render inline
under its row, and "Target" became "Relative Position" with one field per
line. Positioning a course on the map is an explicit "Position on map"
mode which suppresses target dragging while on — a course centre is
metres from the landing spot, so their handles overlap. That last part
*reverses* a same-day decision to make courses always draggable; see
NOTES for why the analogy with the target's retired "Edit on map" mode
did not hold. Closes P5 and the stale-course-id backlog item.

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

A fourth pass (`d26307e`): the comparison's sounding column links to
IEM's station page, Windy became an icon on the conditions row, and the
panel body lost 32px of dead space above its title. Verification note
worth keeping: `/archive/raob/?station=<sid>` returns 200 and **ignores**
the parameter — only loading it in a browser showed the station select
still on KABR. Curl would have passed it.

A fifth pass (`5379653`): the comparison's column headers pick the active
wind source (sounding included), and "Best" is now "OpenMeteo Best". This
is also the first time the nerd masking rule had to give way —
`windAloftSource` and `windModel` are gated in Settings but no longer
masked, because the comparison table writes them and is available to
everyone. **The general form: a gated setting may only be masked while
every control that writes it is behind the same gate.** Selecting cannot
refetch from the click handler (`fetchWinds` closes over the settings it
is replacing), so App refetches on a source change — which also fixed
Settings' model picker leaving the old profile on screen until a manual
refresh.

⚠️ Unresolved: twice a screenshot after selecting a source showed the
comparison collapsed, though `aria-expanded` read true seconds earlier;
not reproducible across five attempts and a 30 s watch. Worth a look if
the owner sees it.

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

Nothing is half-finished in the tree: every session above ended green, and
the items here are new work, not loose ends. Two exceptions, both flagged
in their sessions and repeated here: the **`ManoeuvreHintLayer` anchor**
question and **Settings' missing `?`**.

**The immediate one: the help text.** `core/help.ts` has a topic per panel
with placeholder prose written by an agent from reading the code. The
structure is done and tested; the words are the owner's to write. Two
entries need his eye before anyone trusts them:

- **Courses** — the distance / zone-accuracy / speed descriptions were
  inferred from type names and geometry, not from how they are judged.
  Treat as unverified.
- **How FliP works** — this is the P1 teaching text. It should sound like
  the owner explaining it to a student, not like an agent's paraphrase.

**The second: a real pointer on the drag handles.** The list under "Never
exercised by a real pointer" has only grown; a lot of recent work is
drag-shaped and none of it has been touched by a human hand.

Then, owner priorities most-ready first:

| Item | Notes |
|---|---|
| **Owner feedback on what shipped** | The spot readout, the UI pass, the place picker, shortcuts, help panel — all browser-verified, none used in anger |
| **Per-mode dropzone data** | The CSV import dropped the per-mode targets the owner had defined for some DZs; BACKLOG has it, and it needs his localStorage dump to redo |
| **P1's other half** | The Help topic gives dashed-vs-solid a home, but only for someone who goes looking. A legend or first-run pointer ON the map is still the higher-reach half |
| **Trust banner → help link** | The banner says "don't trust this"; "why?" has an answer now (`/help?topic=winds`) but nothing links to it. Small and obvious |
| **Flocking shortcuts** | Rotate jumprun, step the exit along it, cycle sub-mode, toggle a corridor by number. The keymap is ready for them |
| **Corridor direction ranges** | "anything 250–290°" — solver structure supports it, schema stores fixed headings. Small |
| **Landing headings for the remaining DZs** | 60 of 272 still have no `direction`; promote them as they are checked against imagery |
| **Dropzone `timezone`** | Deferred by the owner. Forecast times render in *browser* local time, so a coach planning a DZ two zones away reads the wrong clock |
| **UX-analysis items** | Remaining: mode-filtered Settings (P4), wind panel read-only-first (P3). P5–P9 are done |
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
handlers here). This is the **top verification priority** and the list has
only grown — a lot of recent work is drag-shaped. Ask the owner to try, or
verify another way:

- **All flocking map handles** (the reworked set above): exit-translate,
  jumprun-rotate (at the run start), end-of-CF and middle-of-CF canopy
  rotates, in both free and classic. Confirm: rotation handles stay pinned
  on their line (no flicker), the free finish doesn't drift across repeated
  middle-handle rotations, the classic exit translates everything, and the
  camera never scrolls while dragging any handle.
- **The manoeuvre's initiation handle** (swoop, parametric turns): drag to
  set depth and offset — on the dashed still-air line as of 2026-08-03.
  Confirm it tracks the pointer rather than springing
  back, that it clamps at the edge of what can
  be drawn instead of jumping, and that it withdraws rather than stealing
  the target's drags when the two are close or the map is zoomed out.
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
  presets without also switching mode. Since 2026-08-08 also confirm the
  shifted letters: `Shift+X` mirrors the turn, plain `X` still flips the
  pattern, and no shifted letter falls through to its plain binding.
- **Focus map (`F`) and the help `?` icons on a phone.** Verified at
  375px in the preview, not on a real handset.
- **Pressing the map to close the panel on a phone** (2026-08-08). The
  dispatch rule is unit-tested, but automated clicks never reach the Maps
  click handler here, so the tap itself has never happened. Confirm it also
  does NOT fire when panning the map.
- **Clicking the heading rotate handle to land into wind** (2026-08-08). The
  layer logic is unit-tested (the click snaps, a drag does not, no wind is
  inert), but automated clicks do not reach map markers here.
- **The mobile map/panel split** (2026-08-08). Verified at 375x812 in the
  preview — both states, the compact winds chip, the app-bar overlap — but
  not on a real handset, where the open questions are whether 40% is enough
  map and whether the divider wants to be draggable.
- The **winds indicator hover** works via real DOM (not a marker), so it
  *was* verified — ground-station detail shows on GND-row hover.
- **Copying the spot** was verified through the browser's real input path
  (panel and top bar). Note for the next attempt: a scripted
  `element.click()` reports "Could not copy the spot" and is not a bug —
  `clipboard.writeText` needs transient user activation, which a synthetic
  click does not carry.

## Owner decisions recorded (most recent first)

Recorded here because they were judgement calls, not deductions.

**2026-08-08:**

- The manoeuvre mirror is bound to **`Shift+X` only** — one shortcut, not
  two; `Z` was tried and dropped.
- The copied spot is the spot alone: no dropzone, no corridor name, no
  forecast validity. The Spot Reference is agreed offline and set on the
  map, so it is not named in the text either.
- Of the UI-consistency options put to him, the map HUD card and the
  big-type "in the aircraft" view were dropped; the rest were taken.

**2026-07-29 (courses):**

- Custom courses saved before scoping stay **unassigned** and are offered
  at every dropzone — not auto-assigned to the nearest one, which would be
  an unundoable guess.
- Changing dropzone **clears** a course selection that belongs to the one
  being left.
- A preset **records the dropzone** it was saved at, so its course is
  still one the panel lists when it is loaded.

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

- **The manoeuvre hint's anchor** and **Settings' missing `?`** — both in
  BACKLOG's polish list, both one-line decisions.
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
