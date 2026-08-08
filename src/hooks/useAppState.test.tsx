// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../core/model';

import { AppStateProvider, useAppState } from './useAppState';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppStateProvider>{children}</AppStateProvider>
);

function renderAppState() {
  return renderHook(() => useAppState(), { wrapper });
}

/** Store a versioned document the way the app's codecs do. */
function store(key: string, doc: unknown) {
  window.localStorage.setItem(key, JSON.stringify({ schemaVersion: SCHEMA_VERSION, doc }));
}

describe('useAppState settings touch tracking', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts with nothing touched for a fresh user', () => {
    const { result } = renderAppState();

    expect(result.current.touchedSettings).toEqual([]);
  });

  it('seeds the touched list for pre-tracking users from non-default values', () => {
    // A legacy user: stored settings differ from the defaults, but no
    // touched list was ever written
    store('flip.settings', { ...DEFAULT_SETTINGS, showPoms: false });

    const { result } = renderAppState();

    expect(result.current.touchedSettings).toEqual(['showPoms']);
  });

  it('marks changed keys touched on setSettings', () => {
    const { result } = renderAppState();

    act(() => result.current.setSettings({
      ...result.current.settings,
      showPoms: false
    }));

    expect(result.current.touchedSettings).toEqual(['showPoms']);
    expect(result.current.settings.showPoms).toBe(false);
  });

  it('keeps a key touched when it is set back to the global default', () => {
    const { result } = renderAppState();

    act(() => result.current.setSettings({
      ...result.current.settings,
      showPoms: false
    }));
    act(() => result.current.setSettings({
      ...result.current.settings,
      showPoms: DEFAULT_SETTINGS.showPoms
    }));

    // The user's explicit choice of the default value must survive —
    // this is what lets them override a mode default back to it
    expect(result.current.touchedSettings).toEqual(['showPoms']);
    expect(result.current.settings.showPoms).toBe(DEFAULT_SETTINGS.showPoms);
  });

  it('persists the touched list across a remount', () => {
    const first = renderAppState();

    act(() => first.result.current.setSettings({
      ...first.result.current.settings,
      showPoms: false
    }));
    first.unmount();

    const second = renderAppState();

    expect(second.result.current.touchedSettings).toEqual(['showPoms']);
  });

  it('resetAll clears the touched list', () => {
    const { result } = renderAppState();

    act(() => result.current.setSettings({
      ...result.current.settings,
      showPoms: false
    }));
    act(() => result.current.resetAll());

    expect(result.current.touchedSettings).toEqual([]);
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('useAppState default place', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  // Owner report: fresh load sits at ZHills' coordinates (DEFAULT_TARGET)
  // but showed no courses — activePlaceId defaulted to null, so
  // DZ-scoped data (courses, the swoop pond, flocking's corridors) had
  // nothing to match against until ZHills was reselected by hand.
  it('starts at ZHills, matching where DEFAULT_TARGET actually sits', () => {
    const { result } = renderAppState();

    expect(result.current.activePlaceId).toBe('dz:Skydive City (ZHills)');
  });

  it('does not override a place the user already chose', () => {
    window.localStorage.setItem('flip.place.active', 'dz:Skydive Arizona');

    const { result } = renderAppState();

    expect(result.current.activePlaceId).toBe('dz:Skydive Arizona');
  });

  it('restores the ZHills default after resetAll', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(
      { target: { lat: 32.8035, lng: -111.57985 }, finalHeading: 181 },
      { id: 'dz:Skydive Arizona' }
    ));
    act(() => result.current.resetAll());

    expect(result.current.activePlaceId).toBe('dz:Skydive City (ZHills)');
    expect(result.current.target).toEqual(result.current.targetForMode('pattern'));
  });
});

describe('useAppState targets', () => {
  const ZHILLS = { target: { lat: 28.21887, lng: -82.15122 }, finalHeading: 270 };
  const DELAND = { target: { lat: 29.06402, lng: -81.27847 }, finalHeading: 125 };
  const POND = { target: { lat: 28.219, lng: -82.152 }, finalHeading: 300 };

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps a per-mode target separate from the other modes', () => {
    const { result } = renderAppState();

    act(() => result.current.setTargetForMode('swoop', POND));

    expect(result.current.targetForMode('swoop')).toEqual(POND);
    expect(result.current.targetForMode('flocking')).not.toEqual(POND);
  });

  it('selectPlaceTarget moves every mode, including untouched ones', () => {
    const { result } = renderAppState();

    act(() => result.current.setTargetForMode('swoop', POND));
    act(() => result.current.selectPlaceTarget(DELAND));

    expect(result.current.targetForMode('swoop')).toEqual(DELAND);
    expect(result.current.targetForMode('pattern')).toEqual(DELAND);
    expect(result.current.targetForMode('flocking')).toEqual(DELAND);
  });

  it('lets modes diverge again after a place is chosen', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(DELAND));
    act(() => result.current.setTargetForMode('swoop', POND));

    expect(result.current.targetForMode('swoop')).toEqual(POND);
    expect(result.current.targetForMode('pattern')).toEqual(DELAND);
  });

  it('persists a chosen place across a remount', () => {
    const first = renderAppState();

    act(() => first.result.current.selectPlaceTarget(ZHILLS));
    first.unmount();

    const second = renderAppState();

    expect(second.result.current.targetForMode('flocking')).toEqual(ZHILLS);
  });

  // The reported bug: a landing spot adjusted at a dropzone was lost as soon
  // as another place was chosen, because the per-mode overrides (where the
  // adjustment lived) were wiped on every place selection.
  it('restores the adjusted spot when a place is chosen again', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, { id: 'dz:ZHills' }));
    act(() => result.current.setTargetForMode('pattern', POND));
    act(() => result.current.selectPlaceTarget(DELAND, { id: 'dz:DeLand' }));

    expect(result.current.targetForMode('pattern')).toEqual(DELAND);

    act(() => result.current.selectPlaceTarget(ZHILLS, { id: 'dz:ZHills' }));

    expect(result.current.targetForMode('pattern')).toEqual(POND);
  });

  it('remembers a place across a remount', () => {
    const first = renderAppState();

    act(() => first.result.current.selectPlaceTarget(ZHILLS, { id: 'dz:ZHills' }));
    act(() => first.result.current.setTargetForMode('pattern', POND));
    act(() => first.result.current.selectPlaceTarget(DELAND, { id: 'dz:DeLand' }));
    first.unmount();

    const second = renderAppState();

    act(() => second.result.current.selectPlaceTarget(ZHILLS, { id: 'dz:ZHills' }));

    expect(second.result.current.targetForMode('pattern')).toEqual(POND);
  });

  // A geocoder hit belongs to no place, and "no place" is a real answer that
  // has to survive a reload. Stored as an absent key it did not: the key's
  // default (ZHills) reappeared on the next mount, so every later edit was
  // recorded against a dropzone the user was nowhere near.
  const PARIS = { target: { lat: 48.8584, lng: 2.2945 }, finalHeading: 90 };
  // What `flip.place.active` defaults to when it holds nothing.
  const DEFAULT_PLACE_ID = 'dz:Skydive City (ZHills)';

  it('stays at no place across a remount after a target off the list', () => {
    const first = renderAppState();

    act(() => first.result.current.selectPlaceTarget(ZHILLS, { id: 'dz:ZHills' }));
    act(() => first.result.current.selectPlaceTarget(PARIS));
    expect(first.result.current.activePlaceId).toBeNull();
    first.unmount();

    const second = renderAppState();

    expect(second.result.current.activePlaceId).toBeNull();
  });

  // The same hole, seen from the damage it does: the default place id is
  // what the key falls back to, so edits made off-list were written into
  // that dropzone's record and handed back the next time it was chosen.
  it('does not record an off-list edit against the default dropzone', () => {
    const { result } = renderAppState();
    const adjusted = { target: { lat: 48.86, lng: 2.3 }, finalHeading: 90 };

    act(() => result.current.selectPlaceTarget(PARIS));
    act(() => result.current.setTargetForMode('flocking', adjusted));
    act(() => result.current.setFlockingParams({
      ...result.current.flockingParams,
      referencePoint: adjusted.target
    }));
    act(() => result.current.selectPlaceTarget(ZHILLS, { id: DEFAULT_PLACE_ID }));

    // Going back to the dropzone must not restore a target — or a Spot
    // Reference — from the other side of the world
    expect(result.current.targetForMode('flocking')).toEqual(ZHILLS);
    expect(result.current.flockingParams.referencePoint).toBeNull();
  });

  // Storage written by a build with the bug above still holds another
  // continent under a dropzone's id, so the record itself has to be doubted.
  it('ignores a remembered target that is nowhere near its place', () => {
    store('flip.targets.byPlace', {
      [DEFAULT_PLACE_ID]: {
        shared: PARIS,
        byMode: { flocking: PARIS },
        flockingReference: PARIS.target
      }
    });

    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, { id: DEFAULT_PLACE_ID }));

    expect(result.current.targetForMode('flocking')).toEqual(ZHILLS);
    expect(result.current.flockingParams.referencePoint).toBeNull();
  });

  it('still restores a Spot Reference a few miles up the jumprun', () => {
    // Three miles out is a normal canonical reference, not damage
    const upTheJumprun = { lat: ZHILLS.target.lat + 0.043, lng: ZHILLS.target.lng };

    store('flip.targets.byPlace', {
      [DEFAULT_PLACE_ID]: {
        shared: ZHILLS,
        byMode: {},
        flockingReference: upTheJumprun
      }
    });

    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, { id: DEFAULT_PLACE_ID }));

    expect(result.current.flockingParams.referencePoint).toEqual(upTheJumprun);
  });

  it('keeps per-mode adjustments separate within one place', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, { id: 'dz:ZHills' }));
    act(() => result.current.setTargetForMode('pattern', POND));
    act(() => result.current.selectPlaceTarget(DELAND, { id: 'dz:DeLand' }));
    act(() => result.current.selectPlaceTarget(ZHILLS, { id: 'dz:ZHills' }));

    expect(result.current.targetForMode('pattern')).toEqual(POND);
    // A mode that was never adjusted still reads the place itself
    expect(result.current.targetForMode('flocking')).toEqual(ZHILLS);
  });

  it('does not remember targets that belong to no place (a preset)', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS));
    act(() => result.current.setTargetForMode('pattern', POND));
    act(() => result.current.selectPlaceTarget(DELAND));
    act(() => result.current.selectPlaceTarget(ZHILLS));

    expect(result.current.targetForMode('pattern')).toEqual(ZHILLS);
  });

  // A Spot Reference is a point on the ground, so it belongs to its place.
  // Left pinned across a move it was measured against the new dropzone,
  // which the flat projection reported as a spot thousands of miles out.
  const pinReference = (
    result: { current: ReturnType<typeof useAppState> },
    point: { lat: number; lng: number } | null
  ) => act(() => result.current.setFlockingParams({
    ...result.current.flockingParams,
    referencePoint: point
  }));

  it('unpins the Spot Reference when moving to another place', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, { id: 'dz:ZHills' }));
    pinReference(result, ZHILLS.target);
    act(() => result.current.selectPlaceTarget(DELAND, { id: 'dz:DeLand' }));

    expect(result.current.flockingParams.referencePoint).toBeNull();
  });

  // The same move, but to somewhere the place list has never heard of: a
  // geocoder hit carries no place id, and the reference has to go anyway.
  it('unpins the Spot Reference when moving to a place off the list', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, { id: 'dz:ZHills' }));
    pinReference(result, ZHILLS.target);
    act(() => result.current.selectPlaceTarget(DELAND));

    expect(result.current.flockingParams.referencePoint).toBeNull();
  });

  it('restores the Spot Reference pinned at a place', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, { id: 'dz:ZHills' }));
    pinReference(result, POND.target);
    act(() => result.current.selectPlaceTarget(DELAND, { id: 'dz:DeLand' }));
    act(() => result.current.selectPlaceTarget(ZHILLS, { id: 'dz:ZHills' }));

    expect(result.current.flockingParams.referencePoint).toEqual(POND.target);
  });

  // A dropzone can declare where each mode starts; anything it leaves out
  // falls back to the dropzone's own coordinates.
  const ZHILLS_PLACE = {
    id: 'dz:ZHills',
    modes: {
      swoop: { lat: 28.22, lng: -82.153, direction: 310 },
      flocking: {
        spotReference: { lat: 28.228, lng: -82.156 },
        solveCorridors: [{
          name: 'North', enabled: true, directionDeg: 0,
          offsetMinMi: -1, offsetMaxMi: 1,
          alongMinMi: -5, alongMaxMi: 3, canopyToleranceDeg: 15
        }]
      }
    }
  };

  it('seeds each mode from the dropzone, defaulting to its coordinates', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, ZHILLS_PLACE));

    expect(result.current.targetForMode('swoop')).toEqual({
      target: { lat: 28.22, lng: -82.153 },
      finalHeading: 310
    });
    // Declared nothing about a target, so it lands on the dropzone itself
    expect(result.current.targetForMode('pattern')).toEqual(ZHILLS);
    expect(result.current.targetForMode('flocking')).toEqual(ZHILLS);
  });

  it('pins the dropzone spot reference and its corridors', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, ZHILLS_PLACE));

    expect(result.current.flockingParams.referencePoint)
      .toEqual({ lat: 28.228, lng: -82.156 });
    expect(result.current.flockingParams.solveCorridors).toHaveLength(1);
    expect(result.current.flockingParams.solveCorridors[0].name).toBe('North');
  });

  it('has no corridors at a dropzone that declares none', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, ZHILLS_PLACE));
    act(() => result.current.selectPlaceTarget(DELAND, { id: 'dz:DeLand' }));

    // Corridors are a dropzone's own airspace and never travel
    expect(result.current.flockingParams.solveCorridors).toEqual([]);
  });

  it('resets corridors to what the dropzone declares', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, {
      id: 'dz:Skydive City (ZHills)'
    }));
    expect(result.current.flockingCorridorsAreCustom).toBe(false);

    act(() => result.current.setFlockingParams({
      ...result.current.flockingParams,
      solveCorridors: []
    }));
    expect(result.current.flockingCorridorsAreCustom).toBe(true);

    act(() => result.current.resetFlockingCorridors());

    // Back to the real dropzone entry's pair, and no longer "custom"
    expect(result.current.flockingParams.solveCorridors.map(c => c.name))
      .toEqual(['North', 'South']);
    expect(result.current.flockingCorridorsAreCustom).toBe(false);
  });

  it('resets to no corridors where the dropzone declares none', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(DELAND, { id: 'dz:DeLand' }));
    act(() => result.current.setFlockingParams({
      ...result.current.flockingParams,
      solveCorridors: [{
        name: 'Mine', enabled: true, directionDeg: 90,
        offsetMinMi: -1, offsetMaxMi: 1,
        alongMinMi: -5, alongMaxMi: 3, canopyToleranceDeg: 15
      }]
    }));

    act(() => result.current.resetFlockingCorridors());

    expect(result.current.flockingParams.solveCorridors).toEqual([]);
  });

  it('prefers what the user did here over what the dropzone declares', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, ZHILLS_PLACE));
    act(() => result.current.setTargetForMode('swoop', POND));
    act(() => result.current.selectPlaceTarget(DELAND, { id: 'dz:DeLand' }));
    act(() => result.current.selectPlaceTarget(ZHILLS, ZHILLS_PLACE));

    expect(result.current.targetForMode('swoop')).toEqual(POND);
  });

  it('keeps the rest of the flocking params across a place change', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, { id: 'dz:ZHills' }));
    act(() => result.current.setFlockingParams({
      ...result.current.flockingParams,
      windowTopFt: 17000,
      referencePoint: ZHILLS.target
    }));
    act(() => result.current.selectPlaceTarget(DELAND, { id: 'dz:DeLand' }));

    // Headings and distances travel fine — only the anchored point is dropped
    expect(result.current.flockingParams.windowTopFt).toBe(17000);
    expect(result.current.flockingParams.referencePoint).toBeNull();
  });
});

describe('useAppState pattern params', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('falls back to the shared value for a mode with no entry', () => {
    const { result } = renderAppState();

    // What every existing user has: one stored pattern, no per-mode entries
    expect(result.current.patternParamsForMode('swoop'))
      .toEqual(result.current.patternParams);
    expect(result.current.patternParamsForMode('pattern'))
      .toEqual(result.current.patternParams);
  });

  it('keeps a swooper\'s pattern out of Standard Pattern', () => {
    const { result } = renderAppState();
    const swoop = {
      ...result.current.patternParams,
      descentRateMph: 30,
      glideRatio: 1.5
    };

    act(() => result.current.setPatternParamsForMode('swoop', swoop));

    expect(result.current.patternParamsForMode('swoop').descentRateMph).toBe(30);
    expect(result.current.patternParamsForMode('pattern').descentRateMph)
      .toBe(result.current.patternParams.descentRateMph);
  });

  it('persists per-mode patterns across a remount', () => {
    const first = renderAppState();

    act(() => first.result.current.setPatternParamsForMode('swoop', {
      ...first.result.current.patternParams,
      descentRateMph: 30
    }));
    first.unmount();

    const second = renderAppState();

    expect(second.result.current.patternParamsForMode('swoop').descentRateMph).toBe(30);
  });
});

describe('useAppState course selection', () => {
  const ELOY_ID = 'dz:Skydive Arizona';
  const ZHILLS_ID = 'dz:Skydive City (ZHills)';
  const ELOY = { target: { lat: 32.8035, lng: -111.57985 }, finalHeading: 181 };
  const ZHILLS = { target: { lat: 28.21887, lng: -82.15122 }, finalHeading: 270 };

  beforeEach(() => {
    window.localStorage.clear();
  });

  // A course is a set of buoys in one pond. Left selected, it also drags the
  // map camera to a dropzone the user just left.
  it('drops a course that belongs to the dropzone being left', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ELOY, { id: ELOY_ID }));
    act(() => result.current.setSelectedCourseId('skydive-arizona-distance'));
    act(() => result.current.selectPlaceTarget(ZHILLS, { id: ZHILLS_ID }));

    expect(result.current.selectedCourseId).toBeNull();
  });

  it('keeps a course when the dropzone does not change', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ELOY, { id: ELOY_ID }));
    act(() => result.current.setSelectedCourseId('skydive-arizona-distance'));
    act(() => result.current.selectPlaceTarget(ELOY, { id: ELOY_ID }));

    expect(result.current.selectedCourseId).toBe('skydive-arizona-distance');
  });

  it('keeps a course that belongs to no dropzone', () => {
    store('flip.courses.custom', [
      { id: 'custom-1', name: 'Legacy', type: 'distance', lat: 1, lng: 2, direction: 0 }
    ]);

    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ELOY, { id: ELOY_ID }));
    act(() => result.current.setSelectedCourseId('custom-1'));
    act(() => result.current.selectPlaceTarget(ZHILLS, { id: ZHILLS_ID }));

    expect(result.current.selectedCourseId).toBe('custom-1');
  });

  // A preset restores its own target and its own place; what the user last
  // did at that dropzone must not overwrite either.
  it('uses the preset target rather than what the place remembers', () => {
    const adjusted = { target: { lat: 32.81, lng: -111.58 }, finalHeading: 90 };
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ELOY, { id: ELOY_ID }));
    act(() => result.current.setTargetForMode('swoop', adjusted));

    act(() => result.current.selectPlaceTarget(ZHILLS, { id: ZHILLS_ID }));
    act(() => result.current.selectPlaceTarget(ELOY, { id: ELOY_ID, useGivenTarget: true }));

    expect(result.current.targetForMode('swoop')).toEqual(ELOY);
    expect(result.current.targetForMode('pattern')).toEqual(ELOY);
  });
});
