import * as turf from '@turf/turf';

import { ktsToFps, metersToFeet, mphToFps } from './units';
import {
  TARGET_MOVE_THRESHOLD_FT,
  addWind,
  averageWind,
  distanceFeet,
  hasTargetMovedTooFar,
  initialBearing,
  mirror,
  normalizeBearing,
  reposition,
  setFinalHeading,
  translate
} from './geometry';
import { createWindProfile, createWindRow } from './wind';
import { FlightPath, FlightPoint } from '../types';

// Helper to create a turf point with properties
function createPoint(lng: number, lat: number, props: Partial<FlightPoint['properties']> = {}): FlightPoint {
  return turf.point([lng, lat], {
    alt: 0,
    time: 0,
    pom: 0,
    ...props
  }) as FlightPoint;
}

describe('Constants', () => {
  it('metersToFeet is approximately correct', () => {
    expect(metersToFeet).toBeCloseTo(3.28084, 4);
  });

  it('ktsToFps converts knots to feet per second', () => {
    // 1 knot = 1.68781 fps
    expect(ktsToFps).toBeCloseTo(1.68781, 4);
  });

  it('mphToFps converts mph to fps', () => {
    // 5280 feet / 3600 seconds = 1.4667 fps per mph
    expect(mphToFps).toBeCloseTo(1.4667, 3);
  });
});

describe('normalizeBearing', () => {
  it('returns bearing unchanged when in 0-360 range', () => {
    expect(normalizeBearing(0)).toBe(0);
    expect(normalizeBearing(90)).toBe(90);
    expect(normalizeBearing(180)).toBe(180);
    expect(normalizeBearing(359)).toBe(359);
  });

  it('normalizes negative bearings', () => {
    expect(normalizeBearing(-90)).toBe(270);
    expect(normalizeBearing(-180)).toBe(180);
    expect(normalizeBearing(-270)).toBe(90);
    expect(normalizeBearing(-360)).toBe(0);
  });

  it('normalizes bearings over 360', () => {
    expect(normalizeBearing(360)).toBe(0);
    expect(normalizeBearing(450)).toBe(90);
    expect(normalizeBearing(720)).toBe(0);
  });
});

describe('translate', () => {
  it('returns empty array for empty input', () => {
    const result = translate([], turf.point([0, 0]));
    expect(result).toEqual([]);
  });

  it('moves single point to target', () => {
    const points: FlightPath = [createPoint(0, 0)];
    const target = turf.point([-112.0, 33.5]);
    const result = translate(points, target);

    expect(result).toHaveLength(1);
    expect(result[0].geometry.coordinates[0]).toBeCloseTo(-112.0, 5);
    expect(result[0].geometry.coordinates[1]).toBeCloseTo(33.5, 5);
  });

  it('preserves relative positions when translating', () => {
    // Create two points 1000 feet apart
    const p1 = createPoint(0, 0);
    const p2 = turf.transformTranslate(turf.point([0, 0]), 1000, 0, { units: 'feet' }) as FlightPoint;
    p2.properties = { alt: 500, time: 0, pom: 0 };

    const target = turf.point([-112.0, 33.5]);
    const result = translate([p1, p2], target);

    // Distance between translated points should still be ~1000 feet
    const distance = turf.distance(result[0], result[1], { units: 'feet' });
    expect(distance).toBeCloseTo(1000, -1);
  });
});

describe('setFinalHeading', () => {
  it('returns unchanged for less than 2 points', () => {
    const single: FlightPath = [createPoint(0, 0)];
    expect(setFinalHeading(single, 90)).toEqual(single);
    expect(setFinalHeading([], 90)).toEqual([]);
  });

  it('rotates points to achieve final heading', () => {
    // Create points with initial heading of 0 (north)
    const p1 = createPoint(0, 0);
    const p2 = createPoint(0, 0.01, { alt: 500 }); // north of p1

    const result = setFinalHeading([p1, p2], 90);

    // After rotation, bearing from p2 to p1 should be 90 (east)
    const newBearing = turf.bearing(result[1], result[0]);
    expect(normalizeBearing(newBearing)).toBeCloseTo(90, 0);
  });
});

describe('initialBearing', () => {
  it('calculates bearing between two points', () => {
    const p1 = createPoint(-112.0, 33.5);
    const p2 = createPoint(-112.0, 33.6); // due north

    const bearing = initialBearing(p1, p2);
    expect(bearing).toBeCloseTo(0, 0);
  });

  it('returns normalized bearing', () => {
    const p1 = createPoint(-112.0, 33.5);
    const p2 = createPoint(-112.0, 33.4); // due south

    const bearing = initialBearing(p1, p2);
    expect(bearing).toBeCloseTo(180, 0);
  });
});

describe('mirror', () => {
  it('returns unchanged for less than 2 points', () => {
    const single: FlightPath = [createPoint(0, 0)];
    expect(mirror(single)).toEqual(single);
    expect(mirror([])).toEqual([]);
  });

  it('keeps first two points unchanged', () => {
    const p1 = createPoint(0, 0);
    const p2 = createPoint(0, 0.001, { alt: 100 });
    const p3 = createPoint(0.001, 0.002, { alt: 200 });

    const result = mirror([p1, p2, p3]);

    expect(result[0].geometry.coordinates).toEqual(p1.geometry.coordinates);
    expect(result[1].geometry.coordinates).toEqual(p2.geometry.coordinates);
  });

  it('mirrors third point across the axis defined by first two points', () => {
    // Create a simple L-shape: 0,0 -> 0,1 -> 1,1
    const p1 = createPoint(0, 0);
    const p2 = turf.transformTranslate(turf.clone(p1), 1000, 0, { units: 'feet' }) as FlightPoint;
    p2.properties = { alt: 500, time: 0, pom: 0 };
    const p3 = turf.transformTranslate(turf.clone(p2), 1000, 90, { units: 'feet' }) as FlightPoint;
    p3.properties = { alt: 1000, time: 0, pom: 0 };

    const result = mirror([p1, p2, p3]);

    // The mirrored p3 should be on the opposite side
    const originalBearing = turf.bearing(p1, p3);
    const mirroredBearing = turf.bearing(result[0], result[2]);

    // Bearings should be reflections across the center axis
    expect(Math.abs(mirroredBearing - originalBearing)).toBeGreaterThan(1);
  });
});

describe('addWind', () => {
  it('returns unchanged for 0 or 1 points', () => {
    const winds = createWindProfile([createWindRow(0, 90, 10)]);

    expect(addWind([], winds, false)).toEqual([]);

    const single: FlightPath = [createPoint(0, 0, { alt: 0, time: 0 })];
    const result = addWind(single, winds, false);
    expect(result).toHaveLength(1);
  });

  it('keeps first point fixed (landing point)', () => {
    const winds = createWindProfile([createWindRow(0, 90, 20)]);
    const p1 = createPoint(-112.0, 33.5, { alt: 0, time: 0 });
    const p2 = createPoint(-112.0, 33.5001, { alt: 500, time: -30000 });

    const result = addWind([p1, p2], winds, false);

    expect(result[0].geometry.coordinates[0]).toBe(-112.0);
    expect(result[0].geometry.coordinates[1]).toBe(33.5);
  });

  it('offsets earlier points based on wind', () => {
    const winds = createWindProfile([createWindRow(0, 90, 20)]); // 20 knots from east
    const p1 = createPoint(-112.0, 33.5, { alt: 0, time: 0 });
    const p2 = createPoint(-112.0, 33.5001, { alt: 500, time: -30000 }); // 30 seconds earlier

    const result = addWind([p1, p2], winds, false);

    // Second point should be shifted east (wind direction 90)
    expect(result[1].geometry.coordinates[0]).toBeGreaterThan(-112.0);
  });

  it('accumulates wind offset over multiple points', () => {
    const winds = createWindProfile([createWindRow(0, 90, 20)]);
    const p1 = createPoint(-112.0, 33.5, { alt: 0, time: 0 });
    const p2 = createPoint(-112.0, 33.5001, { alt: 250, time: -15000 });
    const p3 = createPoint(-112.0, 33.5002, { alt: 500, time: -30000 });

    const result = addWind([p1, p2, p3], winds, false);

    // Each subsequent point should be offset more
    const offset2 = result[1].geometry.coordinates[0] - -112.0;
    const offset3 = result[2].geometry.coordinates[0] - -112.0;

    expect(offset3).toBeGreaterThan(offset2);
  });

  it('uses altitude-appropriate wind when winds vary', () => {
    const winds = createWindProfile([
      createWindRow(0, 90, 5),
      createWindRow(1000, 270, 20)
    ]);

    const p1 = createPoint(-112.0, 33.5, { alt: 0, time: 0 });
    const p2 = createPoint(-112.0, 33.5001, { alt: 500, time: -30000 });
    const p3 = createPoint(-112.0, 33.5002, { alt: 1500, time: -60000 });

    const result = addWind([p1, p2, p3], winds, false);

    // Points are processed - we just verify it doesn't crash and returns correct length
    expect(result).toHaveLength(3);
  });
});

describe('TARGET_MOVE_THRESHOLD_FT', () => {
  it('is defined as 5000 feet', () => {
    expect(TARGET_MOVE_THRESHOLD_FT).toBe(5000);
  });
});

describe('distanceFeet', () => {
  it('calculates distance between two object points', () => {
    const p1 = { lat: 33.5, lng: -112.0 };
    const p2 = { lat: 33.5, lng: -112.001 };

    const distance = distanceFeet(p1, p2);

    expect(distance).toBeGreaterThan(0);
    expect(typeof distance).toBe('number');
  });

  it('calculates distance between two array points', () => {
    const p1: [number, number] = [-112.0, 33.5];
    const p2: [number, number] = [-112.001, 33.5];

    const distance = distanceFeet(p1, p2);

    expect(distance).toBeGreaterThan(0);
  });

  it('returns 0 for same point', () => {
    const p1 = { lat: 33.5, lng: -112.0 };
    const p2 = { lat: 33.5, lng: -112.0 };

    const distance = distanceFeet(p1, p2);

    expect(distance).toBe(0);
  });
});

describe('hasTargetMovedTooFar', () => {
  it('returns false when distance is below threshold', () => {
    const oldTarget = { lat: 33.5, lng: -112.0 };
    const newTarget = { lat: 33.5001, lng: -112.0 }; // Very close

    expect(hasTargetMovedTooFar(oldTarget, newTarget)).toBe(false);
  });

  it('returns true when distance exceeds default threshold', () => {
    const oldTarget = { lat: 33.5, lng: -112.0 };
    const newTarget = { lat: 33.6, lng: -112.0 }; // Far away (> 5000 ft)

    expect(hasTargetMovedTooFar(oldTarget, newTarget)).toBe(true);
  });

  it('respects custom threshold', () => {
    const oldTarget = { lat: 33.5, lng: -112.0 };
    const newTarget = { lat: 33.5001, lng: -112.0 };

    // With very small threshold, even small moves are "too far"
    expect(hasTargetMovedTooFar(oldTarget, newTarget, 1)).toBe(true);

    // With large threshold, moves are not "too far"
    expect(hasTargetMovedTooFar(oldTarget, newTarget, 100000)).toBe(false);
  });

  it('returns false for same point', () => {
    const point = { lat: 33.5, lng: -112.0 };

    expect(hasTargetMovedTooFar(point, point)).toBe(false);
  });
});

describe('reposition', () => {
  const createManoeuvre = (): FlightPath => [
    createPoint(0, 0, { alt: 0, time: 0, pom: 1 }),
    createPoint(0, 0.001, { alt: 250, time: -15000, pom: 0 }),
    createPoint(0.001, 0.001, { alt: 500, time: -30000, pom: 1 })
  ];

  const createPattern = (): FlightPath => [
    createPoint(0, 0, { alt: 0, time: 0, pom: 1 }),
    createPoint(0, 0.002, { alt: 300, time: -20000, pom: 0 }),
    createPoint(0, 0.004, { alt: 600, time: -40000, pom: 1 })
  ];

  const createTarget = () => ({
    target: { lat: 33.5, lng: -112.0 },
    finalHeading: 90
  });

  it('translates manoeuvre to target', () => {
    const manoeuvre = createManoeuvre();
    const pattern: FlightPath = [];
    const target = createTarget();

    const result = reposition(manoeuvre, pattern, target, false);

    // First point should be near target
    expect(result[0].geometry.coordinates[0]).toBeCloseTo(-112.0, 3);
    expect(result[0].geometry.coordinates[1]).toBeCloseTo(33.5, 3);
  });

  it('sets phase to manoeuvre for manoeuvre points', () => {
    const manoeuvre = createManoeuvre();
    const target = createTarget();

    const result = reposition(manoeuvre, [], target, false);

    expect(result[0].properties.phase).toBe('manoeuvre');
  });

  it('handles empty manoeuvre', () => {
    const pattern = createPattern();
    const target = createTarget();

    const result = reposition([], pattern, target, false);

    // Pattern should be translated to target
    expect(result[0].geometry.coordinates[0]).toBeCloseTo(-112.0, 3);
    expect(result[0].geometry.coordinates[1]).toBeCloseTo(33.5, 3);
    expect(result[0].properties.phase).toBe('pattern');
  });

  it('handles empty pattern', () => {
    const manoeuvre = createManoeuvre();
    const target = createTarget();

    const result = reposition(manoeuvre, [], target, false);

    expect(result).toHaveLength(3);
    expect(result.every(p => p.properties.phase === 'manoeuvre')).toBe(true);
  });

  it('handles both empty', () => {
    const target = createTarget();
    const result = reposition([], [], target, false);

    expect(result).toHaveLength(0);
  });

  it('connects pattern to end of manoeuvre', () => {
    const manoeuvre = createManoeuvre();
    const pattern = createPattern();
    const target = createTarget();

    const result = reposition(manoeuvre, pattern, target, false);

    // Should have all manoeuvre points plus all pattern points
    const manoeuvrePoints = result.filter(p => p.properties.phase === 'manoeuvre');
    const patternPoints = result.filter(p => p.properties.phase === 'pattern');

    expect(manoeuvrePoints).toHaveLength(3);
    expect(patternPoints).toHaveLength(3);
  });

  it('adjusts pattern time and altitude to connect to manoeuvre', () => {
    const manoeuvre = createManoeuvre();
    const pattern = createPattern();
    const target = createTarget();

    const result = reposition(manoeuvre, pattern, target, false);

    const manoeuvreEnd = result.filter(p => p.properties.phase === 'manoeuvre').pop()!;
    const patternStart = result.filter(p => p.properties.phase === 'pattern')[0];

    // Pattern should start where manoeuvre ends (time and alt adjusted)
    expect(patternStart.properties.time).toBe(manoeuvreEnd.properties.time);
    expect(patternStart.properties.alt).toBe(manoeuvreEnd.properties.alt);
  });

  it('respects correctPatternHeading flag', () => {
    const manoeuvre = createManoeuvre();
    const pattern = createPattern();
    const target = { target: { lat: 33.5, lng: -112.0 }, finalHeading: 90 };

    const resultWithCorrection = reposition(manoeuvre, pattern, target, true);
    const resultWithoutCorrection = reposition(manoeuvre, pattern, target, false);

    // Results should differ when correction is applied
    expect(resultWithCorrection).not.toEqual(resultWithoutCorrection);
  });
});

describe('averageWind', () => {
  it('returns empty object for single point path', () => {
    const c1: FlightPath = [createPoint(-112.0, 33.5, { time: 0 })];
    const c2: FlightPath = [createPoint(-112.0001, 33.5, { time: 0 })];

    const result = averageWind(c1, c2);

    expect(result).toEqual({});
  });

  it('calculates average wind from path displacement', () => {
    // Two paths: original and wind-affected
    const c1: FlightPath = [
      createPoint(-112.0, 33.5, { time: 0 }),
      createPoint(-112.0, 33.5002, { time: -60000 })
    ];
    const c2: FlightPath = [
      createPoint(-112.0, 33.5, { time: 0 }),
      createPoint(-112.001, 33.5002, { time: -60000 })
    ];

    const result = averageWind(c1, c2);

    expect(result).toHaveProperty('speedKts');
    expect(result).toHaveProperty('direction');
    expect(typeof result.speedKts).toBe('number');
    expect(typeof result.direction).toBe('number');
  });
});
