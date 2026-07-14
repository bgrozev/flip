import * as turf from '@turf/turf';

import { createManoeuvrePath, setManoeuvreAltitude } from './manoeuvre';
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

describe('createManoeuvrePath', () => {
  it('creates a path with 3 points', () => {
    const result = createManoeuvrePath({
      offsetXFt: 500,
      offsetYFt: 1000,
      altitudeFt: 800,
      duration: 60,
      left: true
    });

    expect(result).toHaveLength(3);
  });

  it('sets correct altitude progression', () => {
    const result = createManoeuvrePath({
      offsetXFt: 500,
      offsetYFt: 1000,
      altitudeFt: 800,
      duration: 60,
      left: true
    });

    // Path is returned in reverse order: [p2, p1, p0]
    // p2 (end of manoeuvre) has alt 0
    // p1 (middle) has alt/2
    // p0 (start) has full altitude
    expect(result[0].properties.alt).toBe(0);
    expect(result[1].properties.alt).toBe(400);
    expect(result[2].properties.alt).toBe(800);
  });

  it('sets correct time progression', () => {
    const result = createManoeuvrePath({
      offsetXFt: 500,
      offsetYFt: 1000,
      altitudeFt: 800,
      duration: 60,
      left: true
    });

    // Path is in reverse, so times go from 0 to positive
    // p2 at time 60000 (60 sec * 1000), p1 at 30000, p0 at 0
    expect(result[0].properties.time).toBe(60000);
    expect(result[1].properties.time).toBe(30000);
    expect(result[2].properties.time).toBe(0);
  });

  it('marks POMs correctly', () => {
    const result = createManoeuvrePath({
      offsetXFt: 500,
      offsetYFt: 1000,
      altitudeFt: 800,
      duration: 60,
      left: true
    });

    // First point (p2) and last point (p0) should be POMs
    expect(result[0].properties.pom).toBe(1);
    expect(result[1].properties.pom).toBe(0);
    expect(result[2].properties.pom).toBe(1);
  });

  it('creates left turn when left=true', () => {
    const result = createManoeuvrePath({
      offsetXFt: 500,
      offsetYFt: 1000,
      altitudeFt: 800,
      duration: 60,
      left: true
    });

    // With left turn, p2 should be offset 90 degrees (east) from p1
    const p1 = result[1];
    const p2 = result[0];

    const bearing = turf.bearing(p1, p2);

    // Bearing should be approximately 90 (east) for left turn
    expect(Math.abs(bearing - 90) < 5 || Math.abs(bearing + 270) < 5).toBe(true);
  });

  it('creates right turn when left=false', () => {
    const result = createManoeuvrePath({
      offsetXFt: 500,
      offsetYFt: 1000,
      altitudeFt: 800,
      duration: 60,
      left: false
    });

    // With right turn, p2 should be offset 270 degrees (west) from p1
    const p1 = result[1];
    const p2 = result[0];

    const bearing = turf.bearing(p1, p2);

    // Bearing should be approximately 270 (west) or -90 for right turn
    expect(Math.abs(bearing - 270) < 5 || Math.abs(bearing + 90) < 5).toBe(true);
  });

  it('respects offsetYFt for forward/back offset', () => {
    const smallOffset = createManoeuvrePath({
      offsetXFt: 500,
      offsetYFt: 500,
      altitudeFt: 800,
      duration: 60,
      left: true
    });

    const largeOffset = createManoeuvrePath({
      offsetXFt: 500,
      offsetYFt: 2000,
      altitudeFt: 800,
      duration: 60,
      left: true
    });

    // Distance from start to middle point should be larger with larger offsetY
    const smallDist = turf.distance(smallOffset[2], smallOffset[1], { units: 'feet' });
    const largeDist = turf.distance(largeOffset[2], largeOffset[1], { units: 'feet' });

    expect(largeDist).toBeGreaterThan(smallDist);
  });

  it('respects offsetXFt for lateral offset', () => {
    const smallOffset = createManoeuvrePath({
      offsetXFt: 200,
      offsetYFt: 1000,
      altitudeFt: 800,
      duration: 60,
      left: true
    });

    const largeOffset = createManoeuvrePath({
      offsetXFt: 1000,
      offsetYFt: 1000,
      altitudeFt: 800,
      duration: 60,
      left: true
    });

    // Distance from middle to end point should be larger with larger offsetX
    const smallDist = turf.distance(smallOffset[1], smallOffset[0], { units: 'feet' });
    const largeDist = turf.distance(largeOffset[1], largeOffset[0], { units: 'feet' });

    expect(largeDist).toBeGreaterThan(smallDist);
  });

  describe('offsetXFt sign handling', () => {
    const base = {
      offsetYFt: 1000,
      altitudeFt: 800,
      duration: 60,
      left: true
    };

    it('uses the exact distance for positive offsets', () => {
      const result = createManoeuvrePath({ ...base, offsetXFt: 300 });
      const dist = turf.distance(result[1], result[0], { units: 'feet' });
      const bearing = turf.bearing(result[1], result[0]);

      expect(dist).toBeCloseTo(300, 3);
      expect(bearing).toBeCloseTo(90, 3);
    });

    it('produces (visually) no offset for offsetX=0 while keeping the heading defined', () => {
      const result = createManoeuvrePath({ ...base, offsetXFt: 0 });

      // Last two points must be distinct (setFinalHeading derives the final
      // approach direction from them), but within a hair of coinciding.
      const dist = turf.distance(result[1], result[0], { units: 'feet' });

      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThan(0.02);
      expect(turf.bearing(result[1], result[0])).toBeCloseTo(90, 1);
      expect(result.every(p => p.geometry.coordinates.every(Number.isFinite))).toBe(true);
    });

    it('offsets to the opposite side for negative offsets', () => {
      const positive = createManoeuvrePath({ ...base, offsetXFt: 300 });
      const negative = createManoeuvrePath({ ...base, offsetXFt: -300 });

      const dist = turf.distance(negative[1], negative[0], { units: 'feet' });
      const bearing = (turf.bearing(negative[1], negative[0]) + 360) % 360;

      expect(dist).toBeCloseTo(300, 3);
      expect(bearing).toBeCloseTo(270, 3);

      // Same distance as the positive offset, opposite direction
      const positiveBearing = (turf.bearing(positive[1], positive[0]) + 360) % 360;
      expect(Math.abs(bearing - positiveBearing)).toBeCloseTo(180, 3);
    });

    it('respects left=false for negative offsets', () => {
      const result = createManoeuvrePath({ ...base, offsetXFt: -300, left: false });
      const bearing = (turf.bearing(result[1], result[0]) + 360) % 360;

      expect(bearing).toBeCloseTo(90, 3);
    });
  });

  it('handles different durations', () => {
    const short = createManoeuvrePath({
      offsetXFt: 500,
      offsetYFt: 1000,
      altitudeFt: 800,
      duration: 30,
      left: true
    });

    const long = createManoeuvrePath({
      offsetXFt: 500,
      offsetYFt: 1000,
      altitudeFt: 800,
      duration: 120,
      left: true
    });

    expect(short[0].properties.time).toBe(30000);
    expect(long[0].properties.time).toBe(120000);
  });
});

describe('setManoeuvreAltitude', () => {
  it('scales all altitudes proportionally', () => {
    const points: FlightPath = [
      createPoint(0, 0, { alt: 0 }),
      createPoint(0, 0, { alt: 250 }),
      createPoint(0, 0, { alt: 500 })
    ];

    setManoeuvreAltitude(points, 1000);

    expect(points[0].properties.alt).toBe(0);
    expect(points[1].properties.alt).toBe(500);
    expect(points[2].properties.alt).toBe(1000);
  });

  it('handles empty array', () => {
    const points: FlightPath = [];
    setManoeuvreAltitude(points, 1000);
    expect(points).toEqual([]);
  });

  it('handles scaling down', () => {
    const points: FlightPath = [
      createPoint(0, 0, { alt: 0 }),
      createPoint(0, 0, { alt: 500 }),
      createPoint(0, 0, { alt: 1000 })
    ];

    setManoeuvreAltitude(points, 500);

    expect(points[0].properties.alt).toBe(0);
    expect(points[1].properties.alt).toBe(250);
    expect(points[2].properties.alt).toBe(500);
  });
});
