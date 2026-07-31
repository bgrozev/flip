import * as turf from '@turf/turf';

import { applyInitiationAltitudeOffset, createManoeuvrePath, solveManoeuvre } from './manoeuvre';
import { FlightPath, FlightPoint, ManoeuvreParams } from '../types';

// Helper to create a turf point with properties
function createPoint(lng: number, lat: number, props: Partial<FlightPoint['properties']> = {}): FlightPoint {
  return turf.point([lng, lat], {
    alt: 0,
    time: 0,
    pom: 0,
    ...props
  }) as FlightPoint;
}

const TURN: ManoeuvreParams = {
  turnDirection: 'left',
  rotationDeg: 270,
  altitudeFt: 900,
  depthFt: 300,
  offsetFt: 150,
  duration: 8
};

/** Signed difference between two bearings, folded to (-180, 180]. */
function bearingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/**
 * The path as flown: initiation first. `createManoeuvrePath` returns the
 * app's order (landing first), which reads backwards for turn geometry.
 */
function asFlown(path: FlightPath): FlightPoint[] {
  return [...path].reverse();
}

/** Bearing of the final approach — the last segment of the flown path. */
function finalBearing(path: FlightPath): number {
  return turf.bearing(path[1], path[0]);
}

/** Bearing at initiation — the first segment of the flown path. */
function entryBearing(path: FlightPath): number {
  const flown = asFlown(path);

  return turf.bearing(flown[0], flown[1]);
}

/**
 * Where the initiation point sits relative to the landing point, resolved
 * onto the final-approach axis: how far back, and how far across (positive
 * to the right of the final heading).
 */
function initiationOffsets(path: FlightPath): { backFt: number; acrossFt: number } {
  const landing = path[0];
  const initiation = path[path.length - 1];
  const distanceFt = turf.distance(landing, initiation, { units: 'feet' });
  const relative = (turf.bearing(landing, initiation) - finalBearing(path)) * (Math.PI / 180);

  return {
    backFt: -distanceFt * Math.cos(relative),
    acrossFt: distanceFt * Math.sin(relative)
  };
}

/** Total signed rotation flown, positive to the right. */
function totalTurnDeg(path: FlightPath): number {
  const flown = asFlown(path);
  let total = 0;

  for (let i = 2; i < flown.length; i++) {
    total += bearingDelta(
      turf.bearing(flown[i - 2], flown[i - 1]),
      turf.bearing(flown[i - 1], flown[i])
    );
  }

  return total;
}

describe('solveManoeuvre', () => {
  it('makes the offset the turn radius for quarter-circle rotations', () => {
    // 90, 270 and 450 all leave the turn abeam the final line, so the
    // sideways offset the pilot enters IS the radius they fly.
    for (const rotationDeg of [90, 270, 450]) {
      expect(solveManoeuvre({ ...TURN, rotationDeg }).radiusFt).toBeCloseTo(TURN.offsetFt, 6);
    }
  });

  it('derives the entry heading from the rotation and the direction', () => {
    // Right turns increase heading on the way round, so they start to the
    // left of final by the rotation; left turns are the mirror.
    expect(solveManoeuvre({ ...TURN, turnDirection: 'right' }).entryHeadingRelDeg).toBe(-270);
    expect(solveManoeuvre({ ...TURN, turnDirection: 'left' }).entryHeadingRelDeg).toBe(270);
  });

  it('leaves a rollout that grows with depth', () => {
    const shallow = solveManoeuvre({ ...TURN, depthFt: 300 });
    const deep = solveManoeuvre({ ...TURN, depthFt: 800 });

    expect(deep.rolloutFt - shallow.rolloutFt).toBeCloseTo(500, 6);
  });

  it('backs the turn up rather than letting the rollout vanish', () => {
    // A depth this short would put the end of the turn past the target,
    // which is what used to reverse the final segment.
    const solved = solveManoeuvre({ ...TURN, depthFt: -2000 });

    expect(solved.rolloutFt).toBeGreaterThan(0);
    expect(solved.depthFt).toBeGreaterThan(-2000);
  });
});

describe('createManoeuvrePath', () => {
  it('runs from the landing point to the initiation point', () => {
    const path = createManoeuvrePath(TURN);

    expect(path[0].properties.alt).toBe(0);
    expect(path[0].properties.time).toBe(8000);
    expect(path[path.length - 1].properties.alt).toBe(900);
    expect(path[path.length - 1].properties.time).toBe(0);
  });

  it('descends and gains time monotonically along the path', () => {
    const path = createManoeuvrePath(TURN);

    for (let i = 1; i < path.length; i++) {
      expect(path[i].properties.alt).toBeGreaterThan(path[i - 1].properties.alt);
      expect(path[i].properties.time).toBeLessThan(path[i - 1].properties.time);
    }
  });

  it('marks only the initiation and the landing point as POMs', () => {
    const path = createManoeuvrePath(TURN);

    expect(path[0].properties.pom).toBe(1);
    expect(path[path.length - 1].properties.pom).toBe(1);
    expect(path.slice(1, -1).every(p => p.properties.pom === 0)).toBe(true);
  });

  it('rotates by the requested amount, in the requested direction', () => {
    for (const rotationDeg of [90, 135, 270, 450]) {
      expect(totalTurnDeg(createManoeuvrePath({ ...TURN, rotationDeg, turnDirection: 'right' })))
        .toBeCloseTo(rotationDeg, 1);
      expect(totalTurnDeg(createManoeuvrePath({ ...TURN, rotationDeg, turnDirection: 'left' })))
        .toBeCloseTo(-rotationDeg, 1);
    }
  });

  it('starts on the heading the rotation implies', () => {
    const path = createManoeuvrePath({ ...TURN, rotationDeg: 270, turnDirection: 'left' });

    expect(bearingDelta(finalBearing(path), entryBearing(path))).toBeCloseTo(-90, 1);
  });

  it('places the initiation point at the requested depth and offset', () => {
    const path = createManoeuvrePath({ ...TURN, depthFt: 500, offsetFt: 200 });
    const { backFt, acrossFt } = initiationOffsets(path);

    expect(backFt).toBeCloseTo(500, 0);
    // A left turn happens on the left, so the offset is to the left of final.
    expect(acrossFt).toBeCloseTo(-200, 0);
  });

  it('mirrors when the turn direction flips', () => {
    const left = initiationOffsets(createManoeuvrePath({ ...TURN, turnDirection: 'left' }));
    const right = initiationOffsets(createManoeuvrePath({ ...TURN, turnDirection: 'right' }));

    expect(right.backFt).toBeCloseTo(left.backFt, 3);
    expect(right.acrossFt).toBeCloseTo(-left.acrossFt, 3);
  });

  describe('the final approach direction', () => {
    // The old model derived the final segment from the sign of an offset, so
    // a negative one silently rotated the whole manoeuvre by 180 degrees.
    // The final segment must now depend on nothing but the geometry frame.
    const reference = finalBearing(createManoeuvrePath(TURN));

    it.each([
      ['a negative depth', { depthFt: -500 }],
      ['a zero depth', { depthFt: 0 }],
      ['a deep setup', { depthFt: 2000 }],
      ['a right turn', { turnDirection: 'right' as const }],
      ['a 90', { rotationDeg: 90 }],
      ['a 135', { rotationDeg: 135 }],
      ['a 450', { rotationDeg: 450 }],
      ['a tight offset', { offsetFt: 5 }],
      ['a wide offset', { offsetFt: 1200 }]
    ])('is unchanged by %s', (_label, overrides) => {
      const path = createManoeuvrePath({ ...TURN, ...overrides });

      expect(bearingDelta(reference, finalBearing(path))).toBeCloseTo(0, 6);
    });
  });

  it('keeps the landing point clear of the end of the turn', () => {
    // Whatever the inputs, the last segment has to have length, or the final
    // heading it defines is meaningless.
    for (const depthFt of [-3000, -100, 0, 50, 3000]) {
      const path = createManoeuvrePath({ ...TURN, depthFt });

      expect(turf.distance(path[0], path[1], { units: 'feet' })).toBeGreaterThan(0);
    }
  });

  it('spreads altitude and time evenly along the ground track', () => {
    const path = createManoeuvrePath(TURN);
    const flown = asFlown(path);
    const mid = flown[Math.floor(flown.length / 2)];

    // Constant ground speed: the halfway point of the track is roughly the
    // halfway point of the descent and of the clock.
    expect(mid.properties.alt).toBeGreaterThan(250);
    expect(mid.properties.alt).toBeLessThan(700);
    expect(mid.properties.time).toBeGreaterThan(2000);
    expect(mid.properties.time).toBeLessThan(6000);
  });

  it('handles different durations', () => {
    const path = createManoeuvrePath({ ...TURN, duration: 20 });

    expect(path[0].properties.time).toBe(20000);
    expect(path[path.length - 1].properties.time).toBe(0);
  });
});

describe('applyInitiationAltitudeOffset', () => {
  // Manoeuvre paths run backwards in time: the last point is the initiation.
  const path = (): FlightPath => [
    createPoint(0, 0, { alt: 0 }),
    createPoint(0, 0, { alt: 500 }),
    createPoint(0, 0, { alt: 1000 })
  ];

  it('scales every altitude proportionally when raising initiation', () => {
    const out = applyInitiationAltitudeOffset(path(), 100);

    expect(out[2].properties.alt).toBe(1100);
    expect(out[1].properties.alt).toBe(550);
    expect(out[0].properties.alt).toBe(0);
  });

  it('scales down when lowering initiation', () => {
    const out = applyInitiationAltitudeOffset(path(), -100);

    expect(out[2].properties.alt).toBe(900);
    expect(out[1].properties.alt).toBe(450);
  });

  it('clamps the offset to +/-15% of the recorded initiation altitude', () => {
    expect(applyInitiationAltitudeOffset(path(), 5000)[2].properties.alt).toBe(1150);
    expect(applyInitiationAltitudeOffset(path(), -5000)[2].properties.alt).toBe(850);
  });

  it('does not mutate the input path', () => {
    const original = path();
    const out = applyInitiationAltitudeOffset(original, 100);

    expect(original[2].properties.alt).toBe(1000);
    expect(out).not.toBe(original);
  });

  it('is a no-op for zero offset or an empty path', () => {
    const original = path();

    expect(applyInitiationAltitudeOffset(original, 0)).toBe(original);
    expect(applyInitiationAltitudeOffset([], 100)).toEqual([]);
  });

  it('leaves a zero-altitude path alone rather than dividing by zero', () => {
    const flat: FlightPath = [createPoint(0, 0, { alt: 0 }), createPoint(0, 0, { alt: 0 })];
    const out = applyInitiationAltitudeOffset(flat, 100);

    expect(out[1].properties.alt).toBe(0);
  });
});
