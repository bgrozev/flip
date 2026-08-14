// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BUILT_IN_PARAMS } from '../core/courses';
import {
  DEFAULT_FLOCKING_PARAMS,
  DEFAULT_MANOEUVRE_CONFIG,
  DEFAULT_PATTERN_PARAMS,
  DEFAULT_TARGET
} from '../core/model';
import { SetupSnapshot } from '../core/setups';
import { Target } from '../types';

import { useSetups } from './useSetups';

const ELOY: Target = { target: { lat: 32.8092, lng: -111.5806 }, finalHeading: 90 };
const ZHILLS_PLACE = 'dz:Skydive City';
const ELOY_PLACE = 'dz:Skydive Arizona';

function makeSetters() {
  return {
    applyTarget: vi.fn(),
    setModeId: vi.fn(),
    setPatternParamsForMode: vi.fn(),
    setManoeuvreConfig: vi.fn(),
    setFlockingParams: vi.fn(),
    setSelectedCourseId: vi.fn()
  };
}

function snapshot(over: Partial<SetupSnapshot> = {}): SetupSnapshot {
  return {
    modeId: 'swoop',
    patternParams: DEFAULT_PATTERN_PARAMS,
    manoeuvre: DEFAULT_MANOEUVRE_CONFIG,
    flockingParams: DEFAULT_FLOCKING_PARAMS,
    target: DEFAULT_TARGET,
    placeId: ZHILLS_PLACE,
    selectedCourseId: null,
    ...over
  };
}

function render(
  setters: ReturnType<typeof makeSetters>,
  initial: SetupSnapshot = snapshot()
) {
  return renderHook(
    (props: { snapshot: SetupSnapshot }) => useSetups({ ...props, ...setters }),
    { initialProps: { snapshot: initial } }
  );
}

describe('useSetups', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts empty with nothing active', () => {
    const { result } = render(makeSetters());

    expect(result.current.setups).toEqual([]);
    expect(result.current.activeSetup).toBeNull();
    expect(result.current.dirty).toBe(false);
  });

  it('create → load round-trips through localStorage', () => {
    const setters = makeSetters();
    const first = render(setters, snapshot({ target: ELOY, placeId: ELOY_PLACE }));

    act(() => first.result.current.createSetup({ name: 'Eloy Distance', includeSite: true }));

    expect(first.result.current.setups).toHaveLength(1);
    expect(first.result.current.activeSetup?.name).toBe('Eloy Distance');
    first.unmount();

    const second = render(makeSetters(), snapshot());
    const stored = second.result.current.setups[0];

    expect(stored.site?.target).toEqual(ELOY);
    expect(stored.site?.placeId).toBe(ELOY_PLACE);
  });

  // Pattern params are per-mode, so a setter bound to the mode that was
  // active would file a swooper's numbers under Standard Pattern — React has
  // not re-rendered by the time the pattern is applied.
  it('applies the pattern to the setup’s own mode, not the one on screen', () => {
    const setters = makeSetters();
    const { result, rerender } = render(setters, snapshot({ modeId: 'swoop' }));

    act(() => result.current.createSetup({ name: 'Swoop', includeSite: false }));
    const id = result.current.setups[0].id;

    rerender({ snapshot: snapshot({ modeId: 'pattern' }) });
    act(() => result.current.loadSetup(id));

    expect(setters.setModeId).toHaveBeenCalledWith('swoop');
    expect(setters.setPatternParamsForMode).toHaveBeenCalledWith('swoop', DEFAULT_PATTERN_PARAMS);
  });

  it('leaves the target alone when the setup travels', () => {
    const setters = makeSetters();
    const { result } = render(setters, snapshot());

    act(() => result.current.createSetup({ name: 'Comp canopy', includeSite: false }));
    act(() => result.current.loadSetup(result.current.setups[0].id));

    expect(result.current.setups[0].site).toBeNull();
    expect(setters.applyTarget).not.toHaveBeenCalled();
    expect(setters.setSelectedCourseId).not.toHaveBeenCalled();
  });

  it('moves you to the place a site-bound setup names', () => {
    const setters = makeSetters();
    const { result, rerender } = render(setters, snapshot({ target: ELOY, placeId: ELOY_PLACE }));

    act(() => result.current.createSetup({ name: 'Eloy', includeSite: true }));
    const id = result.current.setups[0].id;

    rerender({ snapshot: snapshot() });
    act(() => result.current.loadSetup(id));

    expect(setters.applyTarget).toHaveBeenCalledWith(ELOY, ELOY_PLACE);
  });

  it('goes dirty on an edit, and clean again when saved', () => {
    const setters = makeSetters();
    const { result, rerender } = render(setters, snapshot());

    act(() => result.current.createSetup({ name: 'ZHills', includeSite: true }));
    expect(result.current.dirty).toBe(false);

    const edited = snapshot({
      patternParams: { ...DEFAULT_PATTERN_PARAMS, glideRatio: 2.4 }
    });

    rerender({ snapshot: edited });
    expect(result.current.dirty).toBe(true);
    expect(result.current.diff.pattern).toBe(true);

    act(() => result.current.saveChanges());
    expect(result.current.dirty).toBe(false);
    expect(result.current.setups[0].patternParams.glideRatio).toBe(2.4);
  });

  it('puts the stored values back when changes are discarded', () => {
    const setters = makeSetters();
    const { result, rerender } = render(setters, snapshot());

    act(() => result.current.createSetup({ name: 'ZHills', includeSite: true }));
    rerender({
      snapshot: snapshot({ patternParams: { ...DEFAULT_PATTERN_PARAMS, glideRatio: 2.4 } })
    });
    act(() => result.current.discardChanges());

    expect(setters.setPatternParamsForMode)
      .toHaveBeenLastCalledWith('swoop', DEFAULT_PATTERN_PARAMS);
  });

  // A setup from another mode describes a pattern that is not the one on
  // screen, so it cannot be dirty or saved — and it comes back when you do.
  it('goes dormant in another mode and returns to its own', () => {
    const setters = makeSetters();
    const { result, rerender } = render(setters, snapshot({ modeId: 'swoop' }));

    act(() => result.current.createSetup({ name: 'Swoop', includeSite: true }));
    const id = result.current.setups[0].id;

    rerender({ snapshot: snapshot({ modeId: 'pattern' }) });
    expect(result.current.activeSetup).toBeNull();
    expect(result.current.activeSetupId).toBe(id);
    expect(result.current.dirty).toBe(false);

    rerender({ snapshot: snapshot({ modeId: 'swoop' }) });
    expect(result.current.activeSetup?.id).toBe(id);
  });

  // Found in the browser: standing at another dropzone read as "unsaved
  // place, target and course", so Save would have quietly moved the ZHills
  // setup to Eloy. Being away is not an edit.
  it('goes dormant at another dropzone rather than dirty', () => {
    const setters = makeSetters();
    const { result, rerender } = render(setters, snapshot());

    act(() => result.current.createSetup({ name: 'ZHills', includeSite: true }));
    const id = result.current.setups[0].id;

    rerender({ snapshot: snapshot({ placeId: ELOY_PLACE, target: ELOY }) });

    expect(result.current.dirty).toBe(false);
    expect(result.current.activeSetup).toBeNull();
    expect(result.current.awaySetup?.id).toBe(id);
    // And it is exactly what "copy it to here" would copy.
    expect(result.current.copyCandidate?.id).toBe(id);

    rerender({ snapshot: snapshot() });
    expect(result.current.activeSetup?.id).toBe(id);
    expect(result.current.awaySetup).toBeNull();
  });

  // A setup that travels applies at every dropzone, so it never goes dormant
  // for having moved — and copying it here is how you bind one to a place.
  it('keeps a portable setup live at any dropzone', () => {
    const setters = makeSetters();
    const { result, rerender } = render(setters, snapshot());

    act(() => result.current.createSetup({ name: 'Comp canopy', includeSite: false }));
    rerender({ snapshot: snapshot({ placeId: ELOY_PLACE, target: ELOY }) });

    expect(result.current.activeSetup?.name).toBe('Comp canopy');
    expect(result.current.awaySetup).toBeNull();
    expect(result.current.copyCandidate?.name).toBe('Comp canopy');
  });

  it('undoes a load, unsaved changes and all', () => {
    const setters = makeSetters();
    const { result, rerender } = render(setters, snapshot());

    act(() => result.current.createSetup({ name: 'A', includeSite: true }));
    act(() => result.current.createSetup({ name: 'B', includeSite: true }));

    const edited = snapshot({
      patternParams: { ...DEFAULT_PATTERN_PARAMS, glideRatio: 2.4 }
    });

    rerender({ snapshot: edited });
    act(() => result.current.loadSetup(result.current.setups[0].id));
    act(() => result.current.undoLoad());

    expect(setters.setPatternParamsForMode)
      .toHaveBeenLastCalledWith('swoop', edited.patternParams);
    expect(result.current.setups[1].name).toBe('B');
  });

  it('detaches without changing anything', () => {
    const setters = makeSetters();
    const { result } = render(setters, snapshot());

    act(() => result.current.createSetup({ name: 'ZHills', includeSite: true }));
    setters.applyTarget.mockClear();
    act(() => result.current.detach());

    expect(result.current.activeSetup).toBeNull();
    expect(setters.applyTarget).not.toHaveBeenCalled();
  });

  it('only stores flocking params for a flocking setup', () => {
    const setters = makeSetters();
    const { result, rerender } = render(setters, snapshot({ modeId: 'swoop' }));

    act(() => result.current.createSetup({ name: 'Swoop', includeSite: false }));
    expect(result.current.setups[0].flockingParams).toBeUndefined();

    rerender({ snapshot: snapshot({ modeId: 'flocking' }) });
    act(() => result.current.createSetup({ name: 'Flock', includeSite: false }));
    expect(result.current.setups[1].flockingParams).toEqual(DEFAULT_FLOCKING_PARAMS);
  });

  describe('copying to another dropzone', () => {
    // Both built-in course sets live at ZHills in the shipped data, so the
    // copy is exercised against a real one rather than a fixture.
    const zhillsCourse = BUILT_IN_PARAMS.find(c => c.placeId === ZHILLS_PLACE);

    it('keeps the position relative to a course of the same type', () => {
      if (!zhillsCourse) return;
      const setters = makeSetters();
      const { result, rerender } = render(
        setters,
        snapshot({ selectedCourseId: zhillsCourse.id })
      );

      act(() => result.current.createSetup({ name: 'ZHills', includeSite: true }));
      const id = result.current.setups[0].id;

      // At another dropzone with no courses at all: nothing to be relative
      // to, so the copy simply takes the target as it stands.
      rerender({ snapshot: snapshot({ placeId: ELOY_PLACE, target: ELOY }) });
      act(() => result.current.copySetupHere(id, { name: 'Eloy', relative: true }));

      const copy = result.current.setups[1];

      expect(copy.name).toBe('Eloy');
      expect(copy.site?.placeId).toBe(ELOY_PLACE);
      expect(copy.site?.target).toEqual(ELOY);
      // The copy is what is now on screen, so it is loaded rather than filed.
      expect(result.current.activeSetupId).toBe(copy.id);
    });

    it('carries the canopy and the turn to the copy', () => {
      const setters = makeSetters();
      const { result, rerender } = render(setters, snapshot());

      act(() =>
        result.current.createSetup({ name: 'ZHills', canopy: 'SAW 75', includeSite: true })
      );
      rerender({ snapshot: snapshot({ placeId: ELOY_PLACE, target: ELOY }) });
      act(() =>
        result.current.copySetupHere(result.current.setups[0].id, {
          name: 'Eloy',
          relative: true
        })
      );

      const copy = result.current.setups[1];

      expect(copy.canopy).toBe('SAW 75');
      expect(copy.manoeuvre).toEqual(DEFAULT_MANOEUVRE_CONFIG);
      expect(copy.id).not.toBe(result.current.setups[0].id);
    });
  });

  it('renames, relabels and rebinds without touching the rest', () => {
    const setters = makeSetters();
    const { result } = render(setters, snapshot());

    act(() => result.current.createSetup({ name: 'ZHills', includeSite: true }));
    const id = result.current.setups[0].id;

    act(() => result.current.renameSetup(id, 'ZHills ZoneAcc'));
    act(() => result.current.updateSetup(id, { canopy: 'SAW 75' }));
    expect(result.current.setups[0].name).toBe('ZHills ZoneAcc');
    expect(result.current.setups[0].canopy).toBe('SAW 75');

    // An emptied label is absent, not an empty string.
    act(() => result.current.updateSetup(id, { canopy: '' }));
    expect(result.current.setups[0].canopy).toBeUndefined();

    act(() => result.current.setSetupSite(id, false));
    expect(result.current.setups[0].site).toBeNull();

    act(() => result.current.setSetupSite(id, true));
    expect(result.current.setups[0].site?.placeId).toBe(ZHILLS_PLACE);
  });

  it('deletes, and stops being active when it was', () => {
    const setters = makeSetters();
    const { result } = render(setters, snapshot());

    act(() => result.current.createSetup({ name: 'ZHills', includeSite: true }));
    act(() => result.current.deleteSetup(result.current.setups[0].id));

    expect(result.current.setups).toEqual([]);
    expect(result.current.activeSetupId).toBeNull();
  });
});
