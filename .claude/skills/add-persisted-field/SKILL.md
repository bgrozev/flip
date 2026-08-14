---
name: add-persisted-field
description: Add a field to a persisted FliP document (Settings, FlockingParams, PatternParams, a new store, ...) through the versioned-codec pipeline. Use when adding any user-facing option that must survive a reload.
---

# Add a persisted field to FliP

Every persisted document goes through a **versioned codec**
(`util/storage.ts createVersionedCodec`) whose `migrate*` loader lives in
`core/model.ts` and **must never throw** — old/corrupt localStorage has to
degrade gracefully. Skipping any step below breaks a test; do them all.

## Adding a field to an EXISTING document (the common case)

1. **Type** — add the field to the interface in `core/` (e.g.
   `FlockingParams` in `core/flocking.ts`, `Settings`/`UnitPreferences`,
   `PatternParams`).
2. **Default** — add it to the `DEFAULT_*` constant in `core/model.ts`.
   Distances persist in **statute miles**; express nm/km defaults via
   `displayToMiles(x, 'nm')`, not a magic number.
3. **Migration** — add the field to the matching `migrate*` in
   `core/model.ts`, using the existing helpers so garbage never throws:
   - number in a range → `limitedNumber(r.x, d.x, LIMITS.xxx)`
   - free number → `finiteNumber` / `normalizeDirection`
   - enum/string set → `oneOf(r.x, ALLOWED, d.x)`
   - boolean → `booleanOr(r.x, d.x)`
   - string → `stringOr(r.x, '')`
   - nested/array → a dedicated `migrateX` that filters bad entries.
4. **Limits** — if it needs bounds, add a `LIMITS.xxx` entry in
   `core/validation.ts`.
5. **Tests** — in `core/model.test.ts`:
   - the garbage cases already assert `migrateX(g).toEqual(DEFAULT_X)`;
   - the **"keeps valid params"** test does `.toEqual(fullObject)` — you
     MUST add your field to that fixture or it fails;
   - add a case: valid value kept, out-of-range clamped, missing → default.
6. **Wire the UI** — thread it: `App.tsx` → component props → the control
   (usually `NumberInput`/`Switch`/`ToggleButton`). Direction fields use
   `NumberInput`'s `wrap={360}`; ring/offset fields round with
   `roundDist(.., unit, 2)`.

## Adding a WHOLE NEW persisted store

Also do, in `hooks/useAppState.tsx`:

7. `const [storedX, setStoredX] = useLocalStorageState<X>('flip.x', DEFAULT_X,
   { codec: createVersionedCodec(SCHEMA_VERSION, migrateX) });`
   then `const x = storedX ?? DEFAULT_X;` (wrap in `useMemo` if it's an
   object/array read by a `useCallback`, or lint flags the dep).
8. Add `x` + its setter to the context **interface**, the value **memo**
   (both the object and its dependency array), and clear it in `resetAll`.
9. If the codec's stored type includes `null` (a "never set yet" state),
   widen the codec generic — and if a parenthesized `keyof` generic trips
   the `indent` lint rule, hoist it to a `type` alias first.

## Gotchas seen repeatedly

- Adding to the type but not the default/migration → a `tsc` "missing
  property" error or a failing `.toEqual` test. Add all three together.
- `SCHEMA_VERSION` does not change for an additive field — the migration
  fills the default for old envelopes.
- A field only relevant to one mode still persists in the one shared
  document; gate its *use*, not its storage (e.g. flocking corridors).

## Verify

`npm test`, `npm run lint` (0 errors, ≤ 50 warnings), `npm run build` all
green before committing. Commit the slice immediately (per the branch's
working agreement).

### Regenerating golden values

If a core-math change shifts pinned test numbers (as the `addWind` fix
did), don't hand-edit them: write a throwaway `*.test.ts` that runs the
pipeline and `console.log`s the new values, paste them in, delete the
scratch test. Same trick works for any large pinned fixture.
