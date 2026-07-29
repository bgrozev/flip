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

  it('leaves corridors alone at a dropzone that declares none', () => {
    const { result } = renderAppState();

    act(() => result.current.selectPlaceTarget(ZHILLS, ZHILLS_PLACE));
    act(() => result.current.selectPlaceTarget(DELAND, { id: 'dz:DeLand' }));

    // No sensible "none" for corridors: the working set stays in force
    expect(result.current.flockingParams.solveCorridors[0].name).toBe('North');
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
