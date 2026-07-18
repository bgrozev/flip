import * as turf from '@turf/turf';
import { describe, expect, it } from 'vitest';

import { LatLng } from '../types';
import { addWind, destinationPoint, translate } from './geometry';
import { latLngToPoint } from './coords';
import {
  cardinalToDeg,
  degreeToCardinal,
  flockingVectors,
  intoWindDirection,
  makeFlockingPath,
  milesToDisplay,
  spotDescription,
  vectorCardinalDirection
} from './flocking';
import { createWindProfile, createWindRow } from './wind';

// FWC defaults: 12k -> 4k ft at 21 mph descent, 50 mph horizontal
const WINDOW = {
  windowTopFt: 12000,
  windowBottomFt: 4000,
  descentRateMph: 21,
  horizontalSpeedMph: 50
};

// Hand-computed values for the FWC default window:
// duration = 8000 ft / (21 mph * 1.46667 fps/mph) = 259.740 s
const DURATION_S = 8000 / (21 * (5280 / 3600));
// canopy = 50 mph * 1.46667 * 259.74 s = 19047.6 ft = 3.6075 mi
const CANOPY_MI = (50 * (5280 / 3600) * DURATION_S) / 5280;
// wind drift at uniform 20 kts = 20 * 1.68781 fps * 259.74 s = 1.66058 mi
const DRIFT_20KT_MI = (20 * 1.68781 * DURATION_S) / 5280;

/** Absolute angular difference on the compass circle (0..180). */
function angleDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/** Uniform wind: same direction/speed at every altitude. */
function uniformWind(direction: number, speedKts: number) {
  return createWindProfile([
    createWindRow(0, direction, speedKts),
    createWindRow(20000, direction, speedKts)
  ]);
}

describe('direction conversions (parity with FWC DriftTest.kt)', () => {
  it('converts cardinal <-> math degrees', () => {
    const cases: [number, number][] = [
      [0, 90],
      [30, 60],
      [45, 45],
      [90, 0],
      [135, 315],
      [180, 270],
      [270, 180],
      [315, 135],
      [359, 91]
    ];

    for (const [cardinal, deg] of cases) {
      expect(cardinalToDeg(cardinal)).toBeCloseTo(deg, 9);
      expect(degreeToCardinal(deg)).toBeCloseTo(cardinal, 9);
    }

    expect(cardinalToDeg(-45)).toBeCloseTo(cardinalToDeg(315), 9);
    expect(degreeToCardinal(-45)).toBeCloseTo(degreeToCardinal(315), 9);

    expect(cardinalToDeg(720)).toBeCloseTo(90, 9);
    expect(degreeToCardinal(720)).toBeCloseTo(90, 9);
  });

  it('computes vector cardinal directions', () => {
    const sqrt3 = Math.sqrt(3);

    expect(vectorCardinalDirection(1, 1)).toBeCloseTo(45, 3);
    expect(vectorCardinalDirection(1, sqrt3)).toBeCloseTo(30, 3);
    expect(vectorCardinalDirection(-1, 1)).toBeCloseTo(315, 3);
    expect(vectorCardinalDirection(-1, sqrt3)).toBeCloseTo(330, 3);
    expect(vectorCardinalDirection(-1, -1)).toBeCloseTo(225, 3);
    expect(vectorCardinalDirection(-1, -sqrt3)).toBeCloseTo(210, 3);
    expect(vectorCardinalDirection(1, -1)).toBeCloseTo(135, 3);
    expect(vectorCardinalDirection(1, -sqrt3)).toBeCloseTo(150, 3);
    expect(vectorCardinalDirection(1, 0)).toBeCloseTo(90, 3);
    expect(vectorCardinalDirection(0, 1)).toBeCloseTo(0, 3);
  });
});

describe('milesToDisplay', () => {
  it('converts to nm and km', () => {
    expect(milesToDisplay(1, 'mi')).toBe(1);
    expect(milesToDisplay(1.15078, 'nm')).toBeCloseTo(1, 5);
    expect(milesToDisplay(1, 'km')).toBeCloseTo(1.60934, 5);
  });
});

describe('makeFlockingPath', () => {
  it('builds a backward-in-time path from end to exit', () => {
    const path = makeFlockingPath({ ...WINDOW, directionDeg: 0 });

    // point[0] is the END of the jump
    expect(path[0].properties.alt).toBe(4000);
    expect(path[0].properties.time).toBe(0);
    expect(path[0].properties.pom).toBe(1);

    // last point is the exit
    const exit = path[path.length - 1];

    expect(exit.properties.alt).toBeCloseTo(12000, 6);
    expect(exit.properties.time / 1000).toBeCloseTo(-DURATION_S, 3);
    expect(exit.properties.pom).toBe(1);

    // altitude ascends, time descends
    for (let i = 1; i < path.length; i++) {
      expect(path[i].properties.alt).toBeGreaterThan(path[i - 1].properties.alt);
      expect(path[i].properties.time).toBeLessThan(path[i - 1].properties.time);
    }

    // exit lies behind the end along the flight direction (flown toward 0°,
    // so the exit is due south of the end) at the canopy-flight distance
    const distMi = turf.distance(path[0], exit, { units: 'miles' });
    const bearingExitToEnd = (turf.bearing(exit, path[0]) + 360) % 360;

    expect(distMi).toBeCloseTo(CANOPY_MI, 3);
    expect(bearingExitToEnd).toBeCloseTo(0, 1);
  });

  it('marks POMs exactly at round altitude multiples', () => {
    const path = makeFlockingPath({ ...WINDOW, directionDeg: 90 });
    const pomAlts = path.filter(p => p.properties.pom).map(p => p.properties.alt);

    // 4000 (end), 5000..12000 (12000 is also the exit)
    expect(pomAlts.map(a => Math.round(a))).toEqual([
      4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000, 12000
    ]);
    // exactly round, not just nearby
    for (const alt of pomAlts) {
      expect(alt % 1000).toBeCloseTo(0, 6);
    }
  });

  it('supports a metric-ish POM interval', () => {
    const path = makeFlockingPath({ ...WINDOW, directionDeg: 0, pomIntervalFt: 820.2 });
    const pomAlts = path.filter(p => p.properties.pom).map(p => p.properties.alt);

    // multiples of 820.2 between 4000 and 12000: 4101..11482.8, plus end+exit
    expect(pomAlts[0]).toBe(4000);
    expect(pomAlts[1]).toBeCloseTo(4101, 3);
    expect(pomAlts[pomAlts.length - 1]).toBeCloseTo(12000, 6);
  });

  it('degrades to a single point for an empty or inverted window', () => {
    expect(makeFlockingPath({ ...WINDOW, windowTopFt: 4000, directionDeg: 0 })).toHaveLength(1);
    expect(
      makeFlockingPath({ ...WINDOW, windowTopFt: 3000, directionDeg: 0 })
    ).toHaveLength(1);
    expect(
      makeFlockingPath({ ...WINDOW, descentRateMph: 0, directionDeg: 0 })
    ).toHaveLength(1);
  });

  it('stays at the origin with zero horizontal speed', () => {
    const path = makeFlockingPath({ ...WINDOW, horizontalSpeedMph: 0, directionDeg: 0 });
    const exit = path[path.length - 1];

    expect(turf.distance(path[0], exit, { units: 'feet' })).toBeLessThan(0.001);
    expect(exit.properties.alt).toBeCloseTo(12000, 6);
  });
});

describe('intoWindDirection', () => {
  it('points into a uniform wind', () => {
    // wind FROM the north pushes the jumper south; flying into it = north
    expect(intoWindDirection(uniformWind(0, 20), 12000, 4000, 21)).toBeCloseTo(0, 1);
    expect(intoWindDirection(uniformWind(270, 20), 12000, 4000, 21)).toBeCloseTo(270, 1);
    expect(intoWindDirection(uniformWind(135, 20), 12000, 4000, 21)).toBeCloseTo(135, 1);
  });

  it('returns 0 for calm winds', () => {
    expect(intoWindDirection(uniformWind(90, 0), 12000, 4000, 21)).toBe(0);
  });

  it('returns 0 for an empty window', () => {
    expect(intoWindDirection(uniformWind(90, 20), 4000, 4000, 21)).toBe(0);
  });
});

describe('exit spot pipeline (parity with FWC closed form)', () => {
  const target: LatLng = { lat: 28.2, lng: -82.15 };

  function computeSpot(jumprunDeg: number, windDirection: number, windSpeedKts: number) {
    const raw = makeFlockingPath({ ...WINDOW, directionDeg: jumprunDeg });
    const ideal = translate(raw, latLngToPoint(target));
    const corrected = addWind(ideal, uniformWind(windDirection, windSpeedKts), true);
    const exitPoint = corrected[corrected.length - 1];
    const exit: LatLng = {
      lat: exitPoint.geometry.coordinates[1],
      lng: exitPoint.geometry.coordinates[0]
    };

    return { ideal, corrected, exit };
  }

  it('matches the hand-computed uniform-headwind spot', () => {
    // Jumprun 0 into a 20 kt north wind: canopy 3.6075 mi north,
    // drift 1.6606 mi south -> exit 1.9469 mi south of target, prior.
    const { ideal, corrected, exit } = computeSpot(0, 0, 20);
    const spot = spotDescription(exit, target, 0);
    const expectedAlongMi = CANOPY_MI - DRIFT_20KT_MI;

    expect(spot.prior).toBe(true);
    // integration methods differ from the closed form slightly; a few % ok
    expect(Math.abs(spot.alongMi - expectedAlongMi) / expectedAlongMi).toBeLessThan(0.03);
    expect(spot.offsetMi).toBeLessThan(0.02);

    const vectors = flockingVectors(ideal, corrected)!;

    expect(vectors.canopyFlight.lengthMi).toBeCloseTo(CANOPY_MI, 2);
    expect(angleDiff(vectors.canopyFlight.directionDeg, 0)).toBeLessThan(0.1);
    expect(Math.abs(vectors.windDrift.lengthMi - DRIFT_20KT_MI) / DRIFT_20KT_MI).toBeLessThan(0.03);
    // wind FROM north -> drift travels south
    expect(angleDiff(vectors.windDrift.directionDeg, 180)).toBeLessThan(0.1);
    expect(Math.abs(vectors.combined.lengthMi - expectedAlongMi) / expectedAlongMi).toBeLessThan(0.03);
  });

  it('reports PAST when the wind drift exceeds the canopy flight', () => {
    // 50 kt north wind: drift 4.151 mi south beats canopy 3.6075 mi north;
    // exit ends up 0.543 mi north of the target = PAST on a 0° jumprun.
    const { exit } = computeSpot(0, 0, 50);
    const spot = spotDescription(exit, target, 0);
    const driftMi = (50 * 1.68781 * DURATION_S) / 5280;
    const expectedPastMi = driftMi - CANOPY_MI;

    expect(spot.prior).toBe(false);
    expect(Math.abs(spot.alongMi - expectedPastMi) / expectedPastMi).toBeLessThan(0.05);
  });

  it('reports a crosswind offset', () => {
    // Jumprun 0, wind from the west (270): drift pushes east, so the exit
    // is west of the target -> the spot is offset left of the jumprun line.
    const { exit } = computeSpot(0, 270, 20);
    const spot = spotDescription(exit, target, 0);

    expect(spot.prior).toBe(true);
    expect(Math.abs(spot.alongMi - CANOPY_MI) / CANOPY_MI).toBeLessThan(0.03);
    expect(Math.abs(spot.offsetMi - DRIFT_20KT_MI) / DRIFT_20KT_MI).toBeLessThan(0.03);
    expect(spot.offsetLeft).toBe(true);
  });
});

describe('spotDescription sign conventions (FWC Drift.kt parity)', () => {
  const ref: LatLng = { lat: 28.2, lng: -82.15 };

  it('prior: exit before the reference along the jumprun', () => {
    const exit = destinationPoint(ref, 180, 2 * 1609.34); // 2 mi south
    const spot = spotDescription(exit, ref, 0);

    expect(spot.prior).toBe(true);
    expect(spot.alongMi).toBeCloseTo(2, 2);
    expect(spot.offsetMi).toBeCloseTo(0, 2);
  });

  it('PAST: exit beyond the reference along the jumprun', () => {
    const exit = destinationPoint(ref, 0, 2 * 1609.34); // 2 mi north
    const spot = spotDescription(exit, ref, 0);

    expect(spot.prior).toBe(false);
    expect(spot.alongMi).toBeCloseTo(2, 2);
  });

  it('prior + offset: exit east of a northbound jumprun reads "right"', () => {
    // exit 2 mi south and 0.5 mi east of the reference, jumprun 0
    const south = destinationPoint(ref, 180, 2 * 1609.34);
    const exit = destinationPoint(south, 90, 0.5 * 1609.34);
    const spot = spotDescription(exit, ref, 0);

    expect(spot.prior).toBe(true);
    expect(spot.alongMi).toBeCloseTo(2, 2);
    expect(spot.offsetMi).toBeCloseTo(0.5, 2);
    expect(spot.offsetLeft).toBe(false);
  });

  it('prior + offset: exit west of a northbound jumprun reads "left"', () => {
    const south = destinationPoint(ref, 180, 2 * 1609.34);
    const exit = destinationPoint(south, 270, 0.5 * 1609.34);
    const spot = spotDescription(exit, ref, 0);

    expect(spot.prior).toBe(true);
    expect(spot.offsetMi).toBeCloseTo(0.5, 2);
    expect(spot.offsetLeft).toBe(true);
  });

  it('PAST + offset: side stays geometric (deliberate FWC bug fix)', () => {
    // exit 2 mi north (past) and 0.5 mi east of a northbound jumprun. The
    // exit is right of the track; FWC's formula would report "left" for
    // PAST exits (its dot product = along·side, so the sign flips with
    // prior/past) — confirmed a bug 2026-07-17 and fixed here.
    const north = destinationPoint(ref, 0, 2 * 1609.34);
    const exit = destinationPoint(north, 90, 0.5 * 1609.34);
    const spot = spotDescription(exit, ref, 0);

    expect(spot.prior).toBe(false);
    expect(spot.offsetMi).toBeCloseTo(0.5, 2);
    expect(spot.offsetLeft).toBe(false);
  });

  it('handles exit exactly at the reference', () => {
    const spot = spotDescription(ref, ref, 145);

    expect(spot.alongMi).toBe(0);
    expect(spot.offsetMi).toBe(0);
    expect(spot.jumprunDeg).toBe(145);
  });
});
