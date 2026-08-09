# FliP Pain Points

Prioritised UX friction found by walking the running app (localhost:3000,
`flip-redesign-architecture` branch, all modes, desktop + mobile, 2026-07-22).
Companion to `roles-and-tasks.md` (the role/task inventory those `Pn` items map
back to) and `docs/redesign/UIUX.md` (improvement ideas).

Each item: who feels it, the friction, and why it matters. Grouped by *type* of
pain — worst first within each group.

> **This is a dated observation record, not a tracker.** The findings below
> describe the app as it was on 2026-07-22 and are left unedited so the
> walkthrough stays honest. For what has since been FIXED, read
> `docs/redesign/BACKLOG.md` — as of 2026-08-08, P5, P6, P7, P8 and P9 are
> done, and P1 has its Help topic but still wants a map-side affordance.
> P2, P3 and P4 are open as written.

---

## Not intuitive (unclear what to do / hidden / misleading)

### P1 — Dashed vs solid path is unexplained · tasks 13, 14 · **all, esp. student**
The app's whole point — original vs wind-corrected path — has no legend, no
label, no teaching. A new user can't tell which line is which or why they
diverge. A student can *plot* a pattern but not *understand* it, which defeats
the teaching goal. Highest-impact issue: every user, core concept, cheap to fix.

### P2 — No signal the plan isn't jump-real · task 53 · **all**
Pattern/swoop silently draws a complete path on `0 / 0 / 0.0` wind. Nothing says
"no forecast loaded." A user can plan an entire jump on nothing and not notice.
Flocking already solves this (orange "No wind data loaded — no-wind spot"
banner); pattern/swoop just doesn't. Safety-relevant.

### P3 — Wind panel: fetch vs manual is ambiguous · F3 · **regular, student**
The empty state shows an editable "Manually entered" `0` row *and* a separate
FETCH FORECAST button. Which is the intended path? It looks like you must
hand-type winds. No read-only-first framing (already flagged in
`BACKLOG.md` "Winds tab: read-only first").

### P4 — Settings dumps everything on everyone · F1 · **student, regular**
A Standard-Pattern student sees the full settings surface: forecast model,
interpolate winds, drift arrows, "highlight corresponding pre-wind point," map
provider. They can't tell what is safe to touch. Modes gate nav and map layers
but not Settings contents. This is the exact effort/role mismatch the mode
system is meant to prevent.

### P5 — Course type is buried · tasks 30–32 · **swooper**
"+ NEW" creates a generic "New Course"; the Type selector
(Distance / Zone / Speed) lives inside the **Edit** expander, two levels down.
Type is the first real decision but it's hidden. Depth / Offset / Approach-angle
(-270 default) are unlabelled in meaning.

### P9 — Leg-count selector shown in Standard Pattern · task 9 · **regular, student**
Standard Pattern mode exposes the NONE / 1 / 2 / 3 leg selector. A normal jumper
should never pick a leg count — it's always a 3-leg (downwind-base-final)
pattern. The selector is a swooper/coach control leaking into the simple mode
(a specific instance of P4). Fix: hide leg-count in `pattern` mode, hard-wire 3
legs; keep the selector only in `swoop`. Removes a decision the regular jumper
shouldn't have to make and reinforces the "this is what a pattern *is*" teaching.

---

## Harder than necessary (too many steps / too much effort)

### P6 — Finding your DZ · tasks 1–3, F5 · **regular jumper (mobile-critical)**
Unfiltered dropdown only. No search-in-list, no nearest-DZ, no geolocation. This
is the regular jumper's *first* action at the dropzone, on a phone, and it's the
clunkiest step in the primary flow. A SEARCH tab exists but it geocodes arbitrary
locations — it does not filter the DZ list.

### P7 — Mobile edit loop swaps out the map · F2 · **all mobile, regular**
Opening any panel on mobile replaces the map entirely. Tweak wind/target → map
disappears → tap back to see the effect → repeat. The see-while-editing loop is
broken on the surface that matters most. (Refresh-at-loading-area itself is fine:
the top-bar refresh and the WINDS mini-indicator refresh both work from the map
view without opening a panel.) This is `UIUX.md` #3.

### P8 — Jumprun handoff can't be shared · task 40 · **flocker**
The whole flocking deliverable — jumprun heading + distance-prior — is shown as
read-only text ("Jumprun 0° · 3.61 mi prior"). To give it to the pilot you read
it off the screen and re-type it into radio/chat. No copy/share. The one output
flockers exist for is not exportable.

---

## Already intuitive — keep and model after

Upwind heading helper; "Open this location in Windy" link; COMPARE SOURCES
table; per-mode nav gating; flocking's no-wind banner; the zero-config student
default (9 mph / GR 3 / 300-600-900 out of the box). Note P2's fix already
exists in flocking — copy it rather than invent it.

---

## Top 3 to fix first

1. **P1** — legend / teaching for dashed-vs-solid. Biggest reach, cheapest,
   serves the student mission head-on.
2. **P6** — DZ discovery (search + geolocation / nearest). Unblocks the regular
   jumper's mobile first step.
3. **P2** — propagate the flocking trust banner to all modes. Safety, and the
   code already exists to model from.
