// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as turf from '@turf/turf';
import { renderHook } from '@testing-library/react';

import { useFlockingPath } from './useFlockingPath';
import { DEFAULT_FLOCKING_PARAMS } from '../core/model';
import { FlockingParams } from '../core/flocking';
import { createWindProfile, createWindRow } from '../core/wind';
import { Target } from '../types';

const target: Target = { target: { lat: 28.2, lng: -82.15 }, finalHeading: 270 };
// Uniform 20 kt from the west at every altitude
const winds = createWindProfile([createWindRow(0, 270, 20), createWindRow(20000, 270, 20)]);

function distMi(a: [number, number], b: [number, number]): number {
  return turf.distance(a, b, { units: 'miles' });
}

function run(params: FlockingParams, active = true) {
  return renderHook(() => useFlockingPath({
    active, params, target, winds, interpolateWind: true, altitudeUnit: 'ft'
  })).result.current;
}

describe('useFlockingPath — classic mode', () => {
  it('is inert when inactive', () => {
    const d = run(DEFAULT_FLOCKING_PARAMS, false);

    expect(d.corrected).toEqual([]);
    expect(d.spot).toBeNull();
  });

  it('produces the unique FWC solution: end at target, jumprun == canopy', () => {
    const d = run(DEFAULT_FLOCKING_PARAMS);

    expect(d.end).toEqual(target.target);
    expect(d.missMi).toBeNull();
    expect(d.onTarget).toBe(true);
    expect(d.jumprunLine).toBeNull();
    expect(d.jumprunDeg).toBe(d.canopyDeg);
    expect(d.canopyDeg).toBeCloseTo(270, 0); // into the 270 wind

    // The end of the corrected path IS the target
    const endPt = d.corrected[0].geometry.coordinates as [number, number];

    expect(distMi(endPt, [target.target.lng, target.target.lat])).toBeLessThan(0.001);
  });

  it('respects an explicit canopy direction', () => {
    const d = run({ ...DEFAULT_FLOCKING_PARAMS, direction: 45 });

    expect(d.canopyDeg).toBe(45);
    expect(d.jumprunDeg).toBe(45);
  });
});

describe('useFlockingPath — free mode', () => {
  const freeDefaults: FlockingParams = { ...DEFAULT_FLOCKING_PARAMS, mode: 'free' };

  it('anchors the exit at the chosen position on the jumprun line', () => {
    const d = run({ ...freeDefaults, exitAlongMi: 1 });

    const exitPt = d.corrected[d.corrected.length - 1].geometry.coordinates as [number, number];

    expect(distMi(exitPt, [d.exit!.lng, d.exit!.lat])).toBeLessThan(0.001);
    expect(d.jumprunLine).not.toBeNull();
  });

  it('defaults canopy to following the jumprun, no warning', () => {
    const d = run({ ...freeDefaults, jumprun: { directionDeg: 120, offsetMi: 0 } });

    expect(d.canopyDeg).toBe(120);
    expect(d.jumprunDeg).toBe(120);
    expect(d.canopyDeviationWarning).toBe(false);
  });

  it('warns when the canopy deviates from the jumprun by more than 15 degrees', () => {
    const near = run({
      ...freeDefaults,
      jumprun: { directionDeg: 100, offsetMi: 0 },
      canopyDirection: 110
    });
    const far = run({
      ...freeDefaults,
      jumprun: { directionDeg: 100, offsetMi: 0 },
      canopyDirection: 130
    });

    expect(near.canopyDeviationWarning).toBe(false);
    expect(far.canopyDeviationWarning).toBe(true);
    expect(far.canopyDeg).toBe(130);
  });

  it('reports the miss and the target-area verdict', () => {
    // Into-wind run through the target with exit at the classic solution
    // distance: |Δ| = 0.29ish mi combined at 10 windless... use the west
    // wind: canopy follows the run into the wind; exit at the right spot
    // along the line lands on target, exit 1 mi further misses by ~1 mi.
    const onTargetD = run({
      ...freeDefaults,
      jumprun: { directionDeg: 'into-wind', offsetMi: 0 },
      // Classic combined displacement: canopy 3.6075 into wind minus drift
      // 1.66 downwind = 1.947 mi upwind = 1.947 mi ALONG the into-wind run.
      // The exit therefore sits 1.947 mi BEFORE the origin (prior), at
      // t = -1.947 signed miles.
      exitAlongMi: -1.947
    });

    expect(onTargetD.missMi!).toBeLessThan(0.05);
    expect(onTargetD.onTarget).toBe(true);

    const missD = run({
      ...freeDefaults,
      jumprun: { directionDeg: 'into-wind', offsetMi: 0 },
      exitAlongMi: -2.947
    });

    expect(missD.missMi!).toBeCloseTo(1, 1);
    expect(missD.onTarget).toBe(false);
  });

  it('offset shifts the line and therefore the miss', () => {
    const d = run({
      ...freeDefaults,
      jumprun: { directionDeg: 'into-wind', offsetMi: 1 },
      exitAlongMi: -1.947
    });

    expect(d.missMi!).toBeCloseTo(1, 1);
    expect(d.onTarget).toBe(false);
  });
});

describe('useFlockingPath — solve mode', () => {
  const solveDefaults: FlockingParams = { ...DEFAULT_FLOCKING_PARAMS, mode: 'solve' };

  it('solves the default N-or-S corridors and renders the winner', () => {
    // West wind: drift is eastward; both N and S runs can absorb it via
    // offset/tolerance. The best solution must land inside the target area.
    const d = run(solveDefaults);

    expect(d.solve).not.toBeNull();
    expect(d.solve!.perCorridor).toHaveLength(2);
    expect(d.solve!.best).not.toBeNull();
    expect(d.onTarget).toBe(true);
    expect(d.corridorOutlines).toHaveLength(2);
    expect(d.corridorOutlines[0]).toHaveLength(5);

    // The rendered path's exit matches the solver's configuration
    const exitPt = d.corrected[d.corrected.length - 1].geometry.coordinates as [number, number];

    expect(distMi(exitPt, [d.exit!.lng, d.exit!.lat])).toBeLessThan(0.001);
    // The rendered miss agrees with the solver's analytic miss
    expect(Math.abs(d.missMi! - d.solve!.best!.missMi)).toBeLessThan(0.05);
  });

  it('leaves disabled corridors out of the solve, keeping indices aligned', () => {
    const corridors = DEFAULT_FLOCKING_PARAMS.solveCorridors;
    // Disable the FIRST corridor: the surviving one must still report
    // against its own position in the configured list (index 1, not 0).
    const d = run({
      ...solveDefaults,
      solveCorridors: [{ ...corridors[0], enabled: false }, { ...corridors[1] }]
    });

    expect(d.corridorSolutions).toHaveLength(2);
    expect(d.corridorSolutions[0]).toBeNull();
    expect(d.corridorSolutions[1]).not.toBeNull();
    expect(d.corridorSolutions[1]!.corridorIndex).toBe(1);
    expect(d.solve!.best!.corridorIndex).toBe(1);
    // Only the enabled corridor is drawn
    expect(d.corridorOutlines).toHaveLength(1);
  });

  it('solves nothing when every corridor is disabled', () => {
    const d = run({
      ...solveDefaults,
      solveCorridors: DEFAULT_FLOCKING_PARAMS.solveCorridors.map(c => ({ ...c, enabled: false }))
    });

    expect(d.solve!.best).toBeNull();
    expect(d.corridorSolutions).toEqual([null, null]);
    expect(d.corridorOutlines).toEqual([]);
  });

  it('is inert but informative with no corridors', () => {
    const d = run({ ...solveDefaults, solveCorridors: [] });

    expect(d.solve!.best).toBeNull();
    expect(d.corrected).toEqual([]);
    expect(d.corridorOutlines).toEqual([]);
  });
});

// The ghost is the jump you are actually making, flown without wind: it
// leaves the aircraft where you leave it and ends short of the target by the
// drift. Anchored at the target instead (as it was), it started at the exit
// you would have needed in still air — a point nobody flies from.
describe('useFlockingPath — the no-wind ghost', () => {
  const exitOf = (path: { geometry: { coordinates: number[] } }[]) =>
    path[path.length - 1].geometry.coordinates as [number, number];
  const endOf = (path: { geometry: { coordinates: number[] } }[]) =>
    path[0].geometry.coordinates as [number, number];

  for (const [name, params] of [
    ['classic', DEFAULT_FLOCKING_PARAMS],
    ['free', { ...DEFAULT_FLOCKING_PARAMS, mode: 'free', exitAlongMi: 1 }],
    ['solve', { ...DEFAULT_FLOCKING_PARAMS, mode: 'solve' }]
  ] as [string, FlockingParams][]) {
    it(`starts at the exit in ${name} mode`, () => {
      const d = run(params);

      expect(distMi(exitOf(d.ideal), exitOf(d.corrected))).toBeLessThan(0.001);
      expect(distMi(exitOf(d.ideal), [d.exit!.lng, d.exit!.lat])).toBeLessThan(0.001);
    });
  }

  it('ends short of the target by exactly the wind drift', () => {
    const d = run(DEFAULT_FLOCKING_PARAMS);
    const gapMi = distMi(endOf(d.ideal), [target.target.lng, target.target.lat]);

    expect(gapMi).toBeCloseTo(d.vectors!.windDrift.lengthMi, 3);
    expect(gapMi).toBeGreaterThan(0.1);
  });

  it('leaves the drift block and the average wind measured as before', () => {
    const d = run(DEFAULT_FLOCKING_PARAMS);

    // Canopy flight is the ghost's own length, wherever it is drawn
    expect(d.vectors!.canopyFlight.lengthMi)
      .toBeCloseTo(distMi(exitOf(d.ideal), endOf(d.ideal)), 6);
    // Drift and average wind still describe the wind, not the anchoring
    expect(d.vectors!.windDrift.lengthMi).toBeGreaterThan(0.1);
    expect(d.averageWind.speedKts).toBeCloseTo(20, 0);
    expect(d.averageWind.direction).toBeCloseTo(270, 0);
  });
});
