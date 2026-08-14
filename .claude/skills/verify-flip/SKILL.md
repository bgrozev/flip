---
name: verify-flip
description: Verify a FliP change actually works, given this repo's real browser-automation limits. Use before committing anything with a runtime surface, especially map/flocking UI.
---

# Verify a FliP change

The always-run gate: `npm test`, `npm run lint` (0 errors, ≤ 50 known
warnings), `npm run build` — green before every commit.

Beyond that, **prefer a unit or hook test of the actual contract over a
browser check.** The pure core (`core/`) and the derive hooks
(`useFlockingPath`, `usePresets`, `useAppState`) are directly testable
with Vitest + RTL `renderHook`; a targeted test proves more, faster, than
driving the UI.

## The falsifiability rule (the important one)

**When an automated check passes, ask: would it have FAILED before the
change?** If not, it proved nothing.

To find out: stash the change, re-run the exact same check on the
pre-change code. Identical behavior ⇒ the check is worthless, and a
"pass" is a false positive. This session, a browser check appeared to
confirm a click-to-move fix; the old code behaved identically, because
automated map clicks never reach the handler at all. It was re-verified
with a unit test of the contract (`map/layers/TargetEditLayer.test.tsx` —
note the `vi.mock('..')` that stubs the provider-bound primitives).

## Browser automation limits here (measured, not guessed)

Reliable: DOM queries, `javascript_tool`, screenshots, reading
`localStorage` to confirm a state write, `read_page` refs for clicking
real DOM buttons.

Unreliable / broken:
- Coordinate clicks frequently do **not** reach the Google Maps click
  handler (so "clicked the map, nothing moved" proves nothing).
- Synthetic drags do **not** drive the map drag handles.
- Wheel-zoom can hang the tooling.
- `read_page` sometimes reports a 0x0 viewport on panel routes.
- Reading an input's value synchronously after dispatching an `input`
  event shows the pre-React value — `await` a tick first.

Testing UI state via localStorage: seed `flip.mode`, `flip.winds`,
`flip.flocking.params` etc. as `{schemaVersion:1, doc:{...}}` envelopes,
`location.href='/flocking'`, then read the panel via `data-testid`
(`flocking-spot`, `flocking-miss`, `flocking-deviation`) or
`input[aria-label=...]`, and read the params back out of localStorage to
confirm writes.

## Never yet exercised by a real pointer

These pass by unit test + DOM inspection but no automated drag can drive
them — flag for the owner rather than claim verified:

- Flocking free mode: the jumprun 2-D **move** handle, the **rotate**
  handle, the canopy-rotate handle at the flight's end.
- The **Spot Reference** drag (dragging pins it).
- The flocking target drag (click-to-move is deliberately off there).

## PWA

The service worker only exists in a production build — verify offline/PWA
behavior with `npm run build && npm run preview`, not the dev server.
