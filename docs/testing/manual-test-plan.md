# FliP manual test plan

A repeatable walkthrough script for a human or agent to exercise the app
end to end. Organised by role (see `docs/ux/roles-and-tasks.md` for the
role definitions and the task inventory these scenarios draw on). Amend
this file as features change — it is a living script, not a report.

## How to run it

1. Dev server: `flip-dev` launch config (`.claude/launch.json`), which
   runs `npm start --prefix .claude/worktrees/flip-redesign-architecture-e767df`
   from the main repo, or `npm start` directly inside the worktree. Vite
   on `localhost:3000` (`autoPort` if 3000 is taken).
2. Run each scenario once at desktop width (~1280px) and once at mobile
   width (~375px) — see "Mobile adaptations" under each scenario for what
   changes. Reset state between full passes (`localStorage.clear()` +
   reload, or the Settings panel's reset) so scenarios don't inherit
   drift from a previous run.
3. Log findings inline in a run report, not in this file: what broke, what
   was unverifiable and why (see "Browser automation limits" below), and
   which scenario/step. This file stays the stable script.

### Browser automation limits (read before reporting a "bug")

Per `docs/redesign/HANDOFF.md` / the `verify-flip` skill, measured on this
codebase:
- Coordinate clicks/drags on the map frequently do **not** reach the
  Google Maps or MapLibre handlers. A "clicked the map, nothing moved"
  result proves nothing — it does not mean the feature is broken.
- Synthetic wheel-zoom can hang the tooling. Avoid driving zoom this way.
- `read_page` sometimes reports a 0x0 viewport on panel routes — use
  screenshots / `get_page_text` instead.
- A scripted `element.focus()` does not reach React's `onFocus`; dispatch
  `focusin`. Reading an input's value right after an `input` event shows
  the pre-React value — wait a tick.
- Clipboard writes (`useCopySpot`) need real user activation; a synthetic
  click reports failure and that is not a bug.
- Where a step can't be driven this way, mark it **"not exercised by a
  real pointer"** rather than pass/fail, and say so in the report — don't
  claim verification you didn't get. Cross-check against the running list
  in HANDOFF's "Never exercised by a real pointer" section first; if a
  step is already listed there, don't re-litigate it as a new finding.
- **Coordinate clicks can silently miss after any scroll or resize.**
  Raw pixel-coordinate clicks (from a screenshot or a stale `read_page`
  tree) landed on the wrong element repeatedly during this pass —
  especially right after scrolling a panel, opening a portal-rendered
  menu, or resizing to mobile (375×812 with `devicePixelRatio: 2` — a
  screenshot's apparent pixel position is not reliably the CSS pixel
  position `computer` expects). The failure mode is silent: no error, the
  screenshot just looks unchanged. Before concluding a control is broken,
  re-run `read_page` immediately before the click (not reused from
  earlier in the turn) and prefer clicking by `ref`; if that still doesn't
  land, fall back to `javascript_tool` locating the element by text/aria
  and calling `.click()` directly, which reliably reaches the app's
  handler for non-map DOM controls (map/canvas targets are a separate,
  documented limit — see above). Several apparent bugs during this pass
  (a course-search result not selecting, a forecast-time stepper not
  moving, a course type menu not opening) turned out to be this artifact,
  not app defects — confirmed by re-testing with a fresh ref or a JS
  click before it was written up as a finding.

---

## A. Standard pattern planning (regular jumper / student)

Mode: **Standard Pattern**. Covers tasks 1, 4, 6–13, 19–21, 28, 43–45, 50.

1. First run: confirm the mode picker appears and choosing **Standard
   Pattern** lands on a fresh state with a 300-600-900 ft pattern, 9 mph
   descent, GR 3, no settings touched.
2. **Set a new location** via the Location panel search, picking a result
   that resolves to a known dropzone (e.g. search "zhills" or "eloy").
   Confirm the hero card shows the place name, town/region/country,
   coordinates, and a website link if present.
3. **Move the target** by dragging it on the map, and **rotate the
   heading** via the hover-revealed rotate handle. Confirm the pattern
   redraws live and the hero card's "moved N ft from the dropzone" shows.
4. Use the keyboard heading nudges: `<`/`>` (5°) and `,`/`.` (1°) with the
   map focused; confirm the heading updates without a numeric field
   (Standard Pattern has no `headingField` — that's nerd-only). Click the
   rotate handle once to confirm it snaps the heading into wind.
5. **Adjust pattern legs and settings**: descent rate, glide ratio, leg
   altitudes in the Pattern panel. Confirm the leg-count selector is
   **absent** in this mode (task 9 / P9 — always 3 legs) and dashed
   (no-wind) vs solid (wind-corrected) paths both redraw.
6. **Move to a location that is not a pre-defined DZ** — free-text search
   for a street address or landmark, or shift-click open water/a field on
   the map. Confirm a target sets with no dropzone match, the hero card
   reflects "no place" cleanly (no stale DZ name/coordinates bleeding
   through — this is the `NO_PLACE` fix area, worth re-confirming), and
   the Location panel's "Your places" list doesn't misfile it.
7. **Shift-click the map** to jump the target to a new spot at the same
   location. Confirm it's remembered: navigate away (switch mode or
   dropzone) and back, target should still be at the shift-clicked spot
   (`flip.targets.byPlace`).
8. **Winds panel**: open it, confirm the forecast-time stepper heading
   line, fetch a forecast, scrub the time forward/back with the stepper
   and the scrubber, and confirm the wind table + map's `WindMiniIndicator`
   agree. Check the ground-wind observation appears when the DZ is within
   5000 ft of target (station card, hover for detail).
9. **Units**: Settings → change altitude/speed/distance units; confirm
   the pattern altitudes, wind table, and top bar all re-render in the
   new units.
10. **Wind-trust banner**: with no forecast fetched (fresh reload before
    step 8), confirm the trust banner/indicator shows a "not jump-real"
    state; confirm it clears once a forecast is fetched.
11. **Help**: open the `?` on the Pattern and Wind panels; confirm each
    deep-links to its own topic (`/help?topic=...`) rather than a generic
    page.

### Mobile adaptations (375px)

- Step 2–9: opening any panel splits the screen (map ~40% top, panel
  below, chevron to collapse the map strip to 88px). Confirm the map
  never fully disappears and the camera/zoom survives opening and
  closing a panel (it used to unmount and reset).
- Confirm the top bar's AVG/GND + mode switch + presets fit (it's
  documented as **two rows** at 375px — not a bug, a known tradeoff).
- Tap-to-open the `WindMiniIndicator` and confirm it opens the Wind panel
  directly.
- Note: map drag/click reliability from automation is worse on emulated
  mobile than desktop in this tooling — expect more "not exercised by a
  real pointer" outcomes here, not necessarily real bugs.

---

## B. Swooper (High Performance Landing mode)

Mode: **High Performance Landing**. Covers tasks 9–12, 15–18, 22–33, 45,
46, 51.

1. Switch to High Performance Landing from the toolbar mode switch.
   Confirm the leg-count selector (NONE/1/2/3) **is** present here (the
   inverse of scenario A step 5), and pattern params are stored
   separately from Standard Pattern's (`flip.pattern.byMode`) — set a
   different descent rate here, switch to Standard Pattern, confirm it
   didn't follow.
2. **Build a manoeuvre from parameters**: Manoeuvre panel → Parameters,
   set `turnDirection`, `rotationDeg` (try a preset like 270 and a custom
   value), `depthFt`, `offsetFt`. Confirm the drawn arc updates and the
   entry-heading readout is derived, not editable.
3. Drag the **initiation handle** on the map (the still-air/dashed path).
   Confirm depth/offset fields track the drag and clamp at the feasible
   boundary rather than jump or spring back (per HANDOFF, this is
   drag-shaped and likely "not exercised by a real pointer" from
   automation — note that rather than failing it outright).
4. **Load a manoeuvre from a sample track** (Manoeuvre → Samples), then
   switch to **upload a GPS track** (Manoeuvre → Track) using one of the
   files under `src/samples/`. Confirm both compute a manoeuvre path and
   that `correctPatternHeading` behaves per type (applies to
   tracks/samples, not parametric turns — toggle the setting and confirm
   only the track-based manoeuvre reacts).
5. Set the **manoeuvre entry/initiation altitude** and confirm the
   pattern rescales.
6. **Courses**: Courses panel → "+ New" → pick a type (Distance / Zone
   Accuracy / Speed). Confirm the course is auto-named and pointed along
   the final heading. Set Relative Position (depth, offset, approach
   angle) and confirm the course positions relative to the target.
7. **Position a course on the map**: toggle "Position on map", drag the
   course (or, if pointer drag is unreliable, nudge via the numeric
   fields), confirm the target's own drag handle is suppressed while
   this mode is on and restored when it's off.
8. Drag the target after positioning a course, then verify the course's
   depth/offset/approach-angle fields in the panel updated to match
   (2026-08-08 bug fix area) rather than showing stale numbers or
   snapping the target sideways on the next edit.
   **Not a bug:** editing Relative Position marks the setup "unsaved
   **target**", not "unsaved course". Those three fields *are* the target
   expressed in course-relative coordinates — `handleDepth` / `handleOffset`
   / `handleApproachAngle` all call `onTargetChange` — so the target really
   did move and the label is right. `setupDiff`'s `course` flag tracks only
   *which* course is selected (`site.selectedCourseId`); a course's own
   geometry is a separate place-scoped document, not part of the setup.
   Reported as a defect once during the 2026-08-14 pass and withdrawn on
   reading the code; do not re-file it. When checking this, read the
   TARGET's coordinates (the map's "Open this area in Google Maps" link is
   the easiest handle) — the panel's Lat/Lng fields are the COURSE centre
   and correctly stay put while the target moves around it.
9. **Export**: FlySight CSV from the toolbar export dialog (whole path);
   KMZ from inside the Courses panel (course-scoped only — confirm
   there's no whole-path KMZ from the toolbar, that's documented as a gap
   not a bug).
10. **Presets/setups**: save the current pattern + manoeuvre + target +
    course as a setup. Rename it. Switch to a different setup, confirm
    unsaved-changes indicator (amber dot + tooltip naming what's unsaved)
    appears when you then tweak something, and that Discard reverts with
    an Undo snackbar.
11. **Copy to another dropzone**: use the setup's "Copy to <dropzone>"
    action, confirm the course-relative position (depth/offset/approach
    angle) is preserved against the destination course rather than the
    literal coordinates.
12. Toggle **crab arrow** and **POM/summary** display settings; confirm
    the map annotations follow.

### Mobile adaptations

- Course "Position on map" + drag is a poor fit for a phone — confirm the
  numeric-field fallback works well even if the drag itself can't be
  automated.
- Setup switching (task 34–36) should work from the mobile panel same as
  desktop; confirm the split-screen map doesn't get in the way of reading
  the setup menu.

---

## C. Coach

No dedicated mode — coaching is Standard Pattern / High Performance Landing
used live, plus presets. Covers tasks 10–12, 22–24, 29, 34–36, 42.

1. **Multi-student presets**: create 2–3 setups representing different
   students (different descent rates / canopy labels), confirm they're
   distinguishable in the setup list (dropzone chip if bound to different
   DZs, or the canopy label if not) and switching between them during a
   single session is fast (no full reload, panel stays open).
2. **Compare wind models**: Wind panel → Compare Sources / Compare
   Models. Confirm the comparison table follows the currently scrubbed
   forecast hour (not hardcoded to "now" — this was a fixed bug, worth a
   regression check) and headers reflect the active source.
3. **Live manipulation as a teaching tool**: with a student's setup
   loaded, change glide ratio and descent rate live and confirm the
   pattern/path redraws instantly with no perceptible lag — this is
   explicitly called out as an interaction-quality requirement, not just
   "it eventually updates."
4. **Manual wind entry** (requires Nerd flag — see scenario E first, or
   turn it on here): unlock the wind table, hand-enter a value at one
   level, confirm the trust banner reflects "manual" and the path
   recomputes using the edited value.
5. **Plan a long-spot jump**: switch to Flocking mode, use it to plan
   a spot for a jump run — confirm the mode switch preserves the target
   place (per-mode target rules) and doesn't strand you at the wrong DZ.
6. Note (don't test as a bug): there is **no dedicated coach mode or
   projector layout** — confirm this matches current expectations, not
   an oversight, before flagging anything about "coach mode" as missing.

### Mobile adaptations

- A coach is more likely to be on a tablet/phone circulating among
  students at the DZ — repeat steps 1–3 at 375px and note whether preset
  switching remains fast inside the split-screen panel.

---

## D. Flocking organizer

Mode: **Flocking**. Covers tasks 39–42.

1. Switch to Flocking (or click the **wordmark** — confirm it toggles
   FliP↔FloP and switches to/from flocking, remembering which
   non-flocking mode to return to across a reload).
2. **Classic sub-mode**: set a canopy flight direction, confirm the
   jumprun line, exit point, and spot readout ("Jumprun N° · X mi prior ·
   Y mi left") appear in the sticky SpotHero, the top bar (replacing the
   avg/gnd wind summary in this mode), and the map's pill label — all
   three must agree exactly.
3. **Free sub-mode**: switch to Free, set the jumprun direction + lateral
   offset independently of canopy direction. Try the drag handles (exit
   translate, jumprun-rotate at the start, end-of-canopy-flight rotate,
   middle-of-flight rotate) — expect these to be *hard to verify by
   synthetic pointer* (flagged in HANDOFF as never exercised by a real
   pointer); check via the numeric readouts instead and note handle
   testing as unverified rather than failed if drags don't register.
4. **Solve sub-mode**: define 2+ named corridors (e.g. "North"/"South"),
   enable/disable them individually, confirm disabled ones drop off the
   map and out of the solve without losing their configuration. Confirm
   the picked corridor is stable across small forecast-time scrubs (not
   flapping between two corridors on noise — this was a fixed
   stability bug).
5. **What-if wind scenarios**: manually edit wind at a couple of levels
   (e.g. strong wind aloft, calm low) via the unlocked wind table
   (requires Nerd flag) and confirm the spot/jumprun recomputes
   sensibly and the trust indicator flags it as manual/inverted.
6. **No-corridor-reaches state**: move to a dropzone with no configured
   corridors (or disable all of them) and confirm `MapNotice` explains
   the empty map rather than it looking broken (2026-08-08 fix — "I only
   see the spot reference and the target").
7. **Jumprun description handoff**: use the copy/share action on the spot
   (top bar or SpotHero). If automation can't trigger clipboard writes,
   verify the button's presence/label rather than claiming pass/fail on
   the copy itself. Confirm the copied text is the spot line alone — no
   dropzone name, corridor name, or forecast time (owner's explicit call).
8. **Spot Reference**: confirm it's pinned at a DZ-specific landmark; move
   to a different dropzone and confirm it does *not* travel (or reads
   "unpinned" rather than showing a wildly wrong distance — this was the
   "4538 mi prior" bug).
9. Drift/what-if: invert wind (Nerd flag) and confirm the trust banner
   downgrades and the ghost/no-wind path anchors from the exit, not the
   target (`anchorAtExit`).

### Mobile adaptations

- The spot readout in the top bar is the flocker's single most important
  mobile artifact (handoff to the pilot/DZ) — confirm it's legible and
  present at 375px without opening a panel.
- Repeat step 7 (copy) at mobile width specifically, since that's the
  realistic in-the-loading-area use case.

---

## E. Nerd

Global **Nerd** flag (Settings, top toggle), not a mode — layer this on
top of any of A–D. Covers the nerd-only surface: manual wind edit/invert,
exports, POM tooltips, wind source/model, several settings rows,
`headingField`.

1. Toggle Nerd on in Settings; confirm the **NERD chip** appears in the
   toolbar and clicking the chip turns it back off.
2. Confirm nerd-only rows now visible in Settings: interpolate winds,
   straighten legs, forecast model, winds-aloft source, observed ground
   wind, map provider, correct-heading, plus `pointTooltips` /
   `showPomTooltips`. Confirm these were hidden before toggling on.
3. **Manual wind**: Wind panel → Unlock, hand-edit a row, confirm Reset
   appears beside Unlock (nerd-only) and clears back to fetched data.
   **Invert**: confirm it flips the wind and the trust banner reflects an
   unreal/synthetic state.
4. **Exports**: confirm FlySight CSV (toolbar) and course KMZ (Courses
   panel) are both available; toggle Nerd off and confirm the export
   controls disappear (not just visually — try triggering via the
   keyboard `E` shortcut with Nerd off and confirm nothing happens).
5. **Location panel's exact heading field**: with Nerd on, confirm a
   numeric heading field appears between the hero card and search
   (desktop and — check specifically — that Flocking suppresses it
   regardless of the flag, per HANDOFF).
6. **The masking-vs-gating boundary**: confirm `windAloftSource` and
   `windModel` remain selectable via the Compare Sources table even with
   Nerd off (documented exception — a gated setting may only be masked
   while every control that writes it is behind the same gate).
7. **Gate correctness, not just visibility**: with Nerd off, confirm the
   geometry-affecting settings (`interpolateWind`, `straightenLegs`) still
   behave as if **on** (their `NERD_OFF_OVERRIDES` default), i.e. turning
   Nerd off must not silently change the computed path — compare a
   pattern's coordinates with Nerd on vs off, same inputs, expect
   identical output.
8. Toggle Nerd off with a manually-edited/inverted wind active; confirm
   the masked value is preserved (not discarded) and reappears correctly
   when Nerd is turned back on.
9. Map provider switch (Google ↔ MapLibre, nerd-only setting): confirm
   the map re-renders on the alternate provider with the same overlays
   (path, handles, target) present.

### Mobile adaptations

- Settings panel length grows substantially with Nerd on — confirm it's
  still scrollable/usable in the mobile split view without the panel
  fighting the collapsed map strip for space.

---

## F. Cross-cutting (any role, any mode)

Run once, desktop only unless noted.

1. **Mode switching preserves config**: touch a setting in one mode,
   switch modes, switch back — confirm the touched setting survived
   (`flip.settings.touched`) rather than reverting to the mode default.
2. **Keyboard shortcuts**: open the `?` overlay, spot-check a handful
   against `core/keymap.ts` — `F` (focus map), `X` (flip pattern turns),
   `Shift+X` (mirror manoeuvre), `S` (open presets) + a digit (load one),
   `Esc` (step back). Confirm shortcuts are ignored while typing in a
   numeric field or with a menu/dialog open.
3. **Help panel**: browse a few topics beyond the ones touched above;
   confirm every panel header has a `?` (note: Settings is a known
   exception per HANDOFF, don't re-report it).
4. **Wind-trust banner** across states: none (no fetch) / manual (edited)
   / stale (old fetch, forecast time scrubbed far) / fresh. Confirm each
   renders distinctly and "fresh" hides the banner.
5. **Undo**: trigger a setup load that discards unsaved changes, confirm
   the Undo snackbar restores the prior state.
6. **Reset all**: Settings → reset, confirm it returns to a clean first-
   run state including default place/mode, and doesn't strand any
   per-mode target/pattern data in a broken form.

### Mobile adaptations

- Re-run steps 2–3 at 375px: shortcuts panel and Help should still be
  reachable and legible in the split view.
