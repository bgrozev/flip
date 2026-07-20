// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as turf from '@turf/turf';
import { renderHook } from '@testing-library/react';

import { useFlockingPath } from './useFlockingPath';
import { DEFAULT_FLOCKING_PARAMS } from '../core/model';
import { createWindProfile, createWindRow } from '../core/wind';
import { Target } from '../types';

const target: Target = { target: { lat: 28.2, lng: -82.15 }, finalHeading: 270 };
// Uniform 20 kt from the west at every altitude
const winds = createWindProfile([createWindRow(0, 270, 20), createWindRow(20000, 270, 20)]);

function distMi(a: [number, number], b: [number, number]): number {
  return turf.distance(a, b, { units: 'miles' });
}

function run(params: typeof DEFAULT_FLOCKING_PARAMS, active = true) {
  return renderHook(() => useFlockingPath({
    active, params, target, winds, interpolateWind: true, altitudeUnit: 'ft'
  })).result.current;
}

describe('useFlockingPath', () => {
  it('is inert when inactive', () => {
    const d = run(DEFAULT_FLOCKING_PARAMS, false);

    expect(d.corrected).toEqual([]);
    expect(d.jumprunLine).toBeNull();
  });

  it('defaults (both into-wind, no offset): the flight ends on the target', () => {
    const d = run(DEFAULT_FLOCKING_PARAMS);

    // Canopy into-wind and jumprun into-wind through the target: the best
    // exit reproduces the classic FWC picture, ending exactly at the target
    expect(d.onTarget).toBe(true);
    expect(d.missMi!).toBeLessThan(0.01);
    expect(d.end).not.toBeNull();
    expect(distMi([d.end!.lng, d.end!.lat], [target.target.lng, target.target.lat]))
      .toBeLessThan(0.01);

    // The exit (last corrected point) sits on the jumprun line
    const exitPt = d.corrected[d.corrected.length - 1].geometry.coordinates as [number, number];

    expect(distMi(exitPt, [d.exit!.lng, d.exit!.lat])).toBeLessThan(0.001);
  });

  it('cross jumprun: the best exit minimizes the miss, flight is unchanged', () => {
    // Canopy flies into the wind (west), but the jumprun is pinned
    // north-south (0°) THROUGH the target: the best exit is where the
    // projection lands, and with the line crossing target − Δ's
    // perpendicular foot the miss equals the along-wind mismatch.
    const params = {
      ...DEFAULT_FLOCKING_PARAMS,
      jumprun: { directionDeg: 0, offsetMi: 0 }
    };
    const d = run(params);

    // The canopy vectors are those of the CONFIGURED flight — the solver
    // never changes speed or heading
    expect(d.canopyDeg).toBeCloseTo(270, 0); // into the 270 wind
    expect(d.vectors!.canopyFlight.lengthMi).toBeCloseTo(3.6075, 2);

    // Δ is east-west (wind axis) and the line is north-south through the
    // reference: the projection of target − Δ onto it is the reference
    // itself, so the miss equals |Δ| along the wind axis
    expect(d.missMi!).toBeGreaterThan(0.1);
    expect(d.onTarget).toBe(d.missMi! <= params.targetRadiusMi + 1e-9);

    // End = exit + Δ: verify the reported end matches the corrected path
    const endPt = d.corrected[0].geometry.coordinates as [number, number];

    expect(distMi(endPt, [d.end!.lng, d.end!.lat])).toBeLessThan(0.001);
  });

  it('offset shifts the jumprun line and grows the miss accordingly', () => {
    const base = run({
      ...DEFAULT_FLOCKING_PARAMS,
      jumprun: { directionDeg: 'into-wind' as const, offsetMi: 0 }
    });
    const offset = run({
      ...DEFAULT_FLOCKING_PARAMS,
      jumprun: { directionDeg: 'into-wind' as const, offsetMi: 1 }
    });

    // An into-wind run through the reference hits the target exactly;
    // shifting it 1 mi sideways forces a ~1 mi perpendicular miss
    expect(base.missMi!).toBeLessThan(0.01);
    expect(offset.missMi!).toBeCloseTo(1, 1);
    expect(offset.onTarget).toBe(false);
  });

  it('exposes the resolved directions independently', () => {
    const d = run({
      ...DEFAULT_FLOCKING_PARAMS,
      direction: 45,
      jumprun: { directionDeg: 180, offsetMi: 0 }
    });

    expect(d.canopyDeg).toBe(45);
    expect(d.jumprunDeg).toBe(180);
    expect(d.spot!.jumprunDeg).toBe(180);
  });
});
