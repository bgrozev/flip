// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as turf from '@turf/turf';
import { renderHook } from '@testing-library/react';

import { useFlockingPath } from './useFlockingPath';
import { DEFAULT_FLOCKING_PARAMS } from '../core/model';
import { createWindProfile, createWindRow } from '../core/wind';
import { Target } from '../types';

const target: Target = { target: { lat: 28.2, lng: -82.15 }, finalHeading: 270 };
const winds = createWindProfile([createWindRow(0, 270, 20), createWindRow(20000, 270, 20)]);

function distMi(a: [number, number], b: [number, number]): number {
  return turf.distance(a, b, { units: 'miles' });
}

describe('useFlockingPath — pinned jumprun', () => {
  it('is inert when inactive', () => {
    const { result } = renderHook(() => useFlockingPath({
      active: false, params: DEFAULT_FLOCKING_PARAMS, target, winds,
      interpolateWind: true, altitudeUnit: 'ft'
    }));

    expect(result.current.corrected).toEqual([]);
    expect(result.current.canopy).toBeNull();
  });

  it('reachable: the exit lands on the pinned line and the end at the target', () => {
    const params = {
      ...DEFAULT_FLOCKING_PARAMS,
      jumprun: { mode: 'pinned' as const, directionDeg: 90, offsetMi: 0, exitAlongMi: null }
    };
    const { result } = renderHook(() => useFlockingPath({
      active: true, params, target, winds, interpolateWind: true, altitudeUnit: 'ft'
    }));
    const d = result.current;

    expect(d.canopy?.reachable).toBe(true);
    expect(d.jumprunLine).not.toBeNull();
    expect(d.reachableSegment).not.toBeNull();

    // The rendered exit (last corrected point) matches the reported exit...
    const exitPt = d.corrected[d.corrected.length - 1].geometry.coordinates as [number, number];

    expect(distMi(exitPt, [d.exit!.lng, d.exit!.lat])).toBeLessThan(0.01);

    // ...and the end (point[0]) reaches the target when reachable.
    const endPt = d.corrected[0].geometry.coordinates as [number, number];

    expect(distMi(endPt, [target.target.lng, target.target.lat])).toBeLessThan(0.05);
  });

  it('honours a user-chosen exit position along the line', () => {
    const params = {
      ...DEFAULT_FLOCKING_PARAMS,
      jumprun: { mode: 'pinned' as const, directionDeg: 90, offsetMi: 0, exitAlongMi: 1 }
    };
    const { result } = renderHook(() => useFlockingPath({
      active: true, params, target, winds, interpolateWind: true, altitudeUnit: 'ft'
    }));

    expect(result.current.exitAlongMi).toBe(1);
  });

  it('marks the target unreachable and reports a shortfall when the line is too far', () => {
    const params = {
      ...DEFAULT_FLOCKING_PARAMS,
      jumprun: { mode: 'pinned' as const, directionDeg: 90, offsetMi: 5, exitAlongMi: 0 }
    };
    const { result } = renderHook(() => useFlockingPath({
      active: true, params, target, winds, interpolateWind: true, altitudeUnit: 'ft'
    }));
    const d = result.current;

    expect(d.canopy?.reachable).toBe(false);
    expect(d.canopy!.shortfallMi).toBeGreaterThan(0);
    expect(d.reachableSegment).toBeNull();
  });

  it('auto mode carries no pinned-line state', () => {
    const { result } = renderHook(() => useFlockingPath({
      active: true, params: DEFAULT_FLOCKING_PARAMS, target, winds,
      interpolateWind: true, altitudeUnit: 'ft'
    }));

    expect(result.current.jumprunLine).toBeNull();
    expect(result.current.canopy).toBeNull();
  });
});
