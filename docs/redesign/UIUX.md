# FliP UI/UX Improvements & New Feature Ideas

Companion to `ARCHITECTURE.md`. First: UX improvements to current flows.
Then: new feature ideas beyond the owner's backlog.

## UI/UX improvements

### Structure & navigation

1. **Modes as the front door.** First-run: "What are you planning today?"
   — Standard pattern / Swoop / Flock / Coaching / Demo. Persistent, one-tap
   switch in toolbar. Removes the biggest current problem: every user sees
   every tab.
2. **Real URLs.** Back button, deep links, shareable state. A coach texts a
   student a link that opens the exact plan.
3. **Mobile: bottom sheet over page-swap.** Today panels replace the map
   entirely on mobile. Better: map always visible, panels slide up as
   half-height sheets (peek/expand/dismiss). Editing target while seeing
   the map is the core loop — don't break it.
4. **Progressive disclosure in panels.** Each panel: essential controls
   visible, "advanced" collapsed (e.g. Pattern: legs + altitudes visible;
   descent rate/GR behind "canopy…" once canopy presets exist).

### Onboarding & first use

5. **Sane empty state.** New user today sees a default pattern in Florida.
   Better: geolocate (with permission) → nearest DZ suggestion → student
   defaults per chosen mode.
6. **Guided tour** (dismissable): what the two lines mean, what POMs are,
   where wind comes from. The dashed-vs-solid distinction is the app's core
   concept and is currently unexplained.

### Map

7. **Legend / explainer chip** — toggleable overlay explaining line styles,
   POM markers, arrows.
8. **Undo for drags.** Target/course/heading drag = easy to fat-finger.
   Toast with "undo" after each drag.
9. **Confidence ring around target** at forecast-only ground wind (no
   observation): visual hint of uncertainty rather than false precision.
10. **Compass rose overlay option** (backlog: degree circle) rendered
    around target; doubles as heading picker — drag the rose to set final
    heading instead of a number field.
11. **Wind profile strip on the map edge** — compact altitude ladder with
    arrows/colors (Beaufort), so you see shear at a glance without opening
    Wind panel. Tap → Wind panel.

### Forms & inputs

12. **Select-all on focus** for numeric fields (backlog item), larger touch
    targets, numeric keyboards on mobile (`inputmode`), unit suffix inside
    the field.
13. **Validation with limits** (backlog): clamp + inline error, never a
    broken map.
14. **Steppers with sensible increments** (altitude ±50 ft, heading ±5°),
    long-press to repeat.

### Wind panel

15. **Source badges per row** (forecast model / observed station / manual
    edit) with color; attribution line (NWS etc.).
16. **Time scrubber**: horizontal hour slider using prefetched hours;
    scrub and watch the pattern morph. Strong teaching tool.
17. **Beaufort coloring in the table** (backlog) and gust column.
18. **"Winds changed" nudge**: forecast auto-refresh staleness indicator —
    "fetched 43 min ago, refresh?".

### Presets / plans

19. **Named plans with dirty state** ("Sunset load — edited"), explicit
    "reset to saved", "save as copy". Replaces the confusing implicit
    active-preset behavior; becomes trivial once presets are Plan documents.

## New feature ideas (beyond owner's backlog)

### Planning

- **Exit/spot planner for pattern modes** — extend flocking drift math to
  full-altitude freefall drift: show recommended exit point and full-jump
  drift line for a solo/belly jump. (Student value: "why did I land out?")
- **Pattern envelope, not just line** — render the corridor reachable
  within ±X seconds of each POM; teaches that a plan is a band, not a rail.
- **What-if wind slider** — "ground wind +5 kts / rotated 30°": scrub and
  see pattern sensitivity. Cheap once pipeline is memoized.
- **Off-DZ landing helper** (safety): tap anywhere → instant mini-pattern
  to that point with current winds + wind cone from current altitude.
- **Obstacle/hazard layer per DZ** — power lines, swoop pond, no-land
  zones drawn on map; warn when plan crosses them. Crowdsourced per DZ
  (tier-1 candidate).
- **Sunset/light calculator** — civil twilight at DZ, "last load in
  daylight" (demo + general use).

### Flocking / coach

- **Group separation planner** — given jumprun, airspeed, winds at exit:
  seconds between groups for X ft separation. Natural neighbor of the
  flocking math; useful to every organizer, not just flockers.
- **Class dashboard (coach mode, tier 1)** — coach sees students' saved
  plans; pushes a plan to the group; compares the group's tracks after the
  load.

### Analysis / logbook

- **Auto-match track↔plan** by time+location when importing tracks.
- **Swoop consistency view** — overlay N tracks of the same manoeuvre;
  spread visualization (initiation altitude scatter, rollout distance
  distribution). More useful than single-jump analysis for training.
- **"Conditions this jump" auto-snapshot** — every time winds are fetched
  and a jump is logged, snapshot conditions; powers the backlog item
  "what changed since last jump".

### Data

- **Winds ensemble view** — fetch 2–3 models (GFS/ECMWF/ICON via OpenMeteo)
  and show disagreement; disagreement = low confidence, plan conservatively.
- **Balloon/PIBAL entry mode** — quick manual entry flow for DZs that do a
  wind drift indicator or balloon observation (common at demo jumps).

### Reach / safety (shared `core/reach/` primitive)

- **Decision altitude rings** — at what altitude must I commit to
  target A vs alternate B, given winds. Inverse of the wind cone.
- **Accuracy trick overlay** — the "no-motion point" concept visualized:
  where the target should sit in your view if you're on glide.

## Monetization candidates (tier 1)

Free forever: all planning, winds, map, export, single-device persistence.
Paid candidates: sync + logbook history, team/coach features, multi-model
ensemble, advanced analysis (consistency view, scoring), hazard layers.
Principle: safety-relevant features stay free.
