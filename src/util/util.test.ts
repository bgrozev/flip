import * as turf from '@turf/turf';

import { FlightPath, FlightPoint } from '../types';
import { CODEC_JSON, averageWind, reposition, setManoeuvreAltitude } from './util';
import { WindRow, Winds } from './wind';

// Helper to create a turf point with properties
function createPoint(lng: number, lat: number, props: Partial<FlightPoint['properties']> = {}): FlightPoint {
  return turf.point([lng, lat], {
    alt: 0,
    time: 0,
    pom: 0,
    ...props
  }) as FlightPoint;
}

describe('CODEC_JSON', () => {
  describe('parse', () => {
    it('parses valid JSON', () => {
      const result = CODEC_JSON.parse('{"foo": "bar"}');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('returns error object for invalid JSON', () => {
      const result = CODEC_JSON.parse('not json');
      expect(result).toEqual({ _error: 'parse failed' });
    });

    it('parses arrays', () => {
      const result = CODEC_JSON.parse('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('stringify', () => {
    it('stringifies objects', () => {
      const result = CODEC_JSON.stringify({ foo: 'bar' });
      expect(result).toBe('{"foo":"bar"}');
    });

    it('stringifies arrays', () => {
      const result = CODEC_JSON.stringify([1, 2, 3]);
      expect(result).toBe('[1,2,3]');
    });
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
