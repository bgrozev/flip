import * as turf from '@turf/turf';

import {
  applyInitiationAltitudeOffset,
  createManoeuvrePath,
  describeManoeuvreForDisplay,
  describeManoeuvrePath,
  manoeuvreBounds,
  solveManoeuvre
} from './manoeuvre';
import { FlightPath, FlightPoint, ManoeuvreParams, Target } from '../types';
import { addWind, reposition } from './geometry';
import { createWindProfile, createWindRow } from './wind';

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
  it('draws every turn at the same nominal radius, whatever the offset', () => {
    // The radius used to BE the offset for a 90/270/450, so setting up wider
    // silently redrew the turn as a wider one. A canopy's turn radius is a
    // property of the canopy, not of where the pilot chose to start.
    const radii = [50, 150, 400, 900].map(
      offsetFt => solveManoeuvre({ ...TURN, offsetFt }).radiusFt
    );

    expect(new Set(radii).size).toBe(1);
  });

  it('lengthens the final approach as the setup gets deeper', () => {
    const shallow = solveManoeuvre({ ...TURN, depthFt: 400 });
    const deep = solveManoeuvre({ ...TURN, depthFt: 900 });

    expect(deep.rolloutFt - shallow.rolloutFt).toBeCloseTo(500, 3);
    expect(deep.entryStraightFt).toBeCloseTo(shallow.entryStraightFt, 3);
  });

  it('lengthens the entry as the offset goes negative', () => {
    // A negative offset starts on the far side of the final line, so the
    // turn has to be flown straight for longer before it begins. Shown on a
    // 270, the smallest rotation that can reach across the line at all.
    const near = solveManoeuvre({ ...TURN, rotationDeg: 270, offsetFt: 150 });
    const far = solveManoeuvre({ ...TURN, rotationDeg: 270, offsetFt: -400 });

    expect(far.entryStraightFt).toBeGreaterThan(near.entryStraightFt);
  });

  it('reaches the initiation point for the setups a pilot would fly', () => {
    for (const rotationDeg of [90, 135, 270, 450]) {
      for (const depthFt of [300, 1200]) {
        for (const offsetFt of [150, 900]) {
          const solved = solveManoeuvre({ ...TURN, rotationDeg, depthFt, offsetFt });

          expect(
            solved.reaches,
            `${rotationDeg} deg, depth ${depthFt}, offset ${offsetFt}`
          ).toBe(true);
        }
      }
    }
  });

  it('only reaches the far side of the final line once the turn goes past a half', () => {
    // Every heading between the entry and final lies on one side, so a turn
    // can only ever travel that way. Reaching an initiation point across
    // the final line needs the turn to pass a heading pointing back at it,
    // which a 90 or a 135 never does.
    expect(solveManoeuvre({ ...TURN, rotationDeg: 90, offsetFt: -600 }).reaches).toBe(false);
    expect(solveManoeuvre({ ...TURN, rotationDeg: 135, offsetFt: -600 }).reaches).toBe(false);
    expect(solveManoeuvre({ ...TURN, rotationDeg: 270, offsetFt: -600 }).reaches).toBe(true);
    expect(solveManoeuvre({ ...TURN, rotationDeg: 450, offsetFt: -600 }).reaches).toBe(true);
  });

  it('grows a straight partway round when the ends cannot be joined otherwise', () => {
    // A 270 that starts wider than the drawn radius cannot be one clean
    // curve: the far side of the turn has to be stretched instead. This is
    // the owner's "a 90, then a long straight, then a 180".
    const solved = solveManoeuvre({ ...TURN, rotationDeg: 270, offsetFt: 900 });

    expect(solved.reaches).toBe(true);
    expect(Math.max(...solved.midStraightsFt)).toBeGreaterThan(0);
  });

  it('admits when a turn cannot be drawn at all', () => {
    // A 90 only ever moves you sideways and forwards; it cannot start past
    // the target however the straights are stretched.
    expect(solveManoeuvre({ ...TURN, rotationDeg: 90, depthFt: -500 }).reaches).toBe(false);
    // ...whereas a 270 can, by going the long way round.
    expect(solveManoeuvre({ ...TURN, rotationDeg: 270, depthFt: -500 }).reaches).toBe(true);
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

      expect(bearingDelta(reference, finalBearing(path))).toBeCloseTo(0, 4);
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

/** Do two line segments properly cross? Shared endpoints do not count. */
function segmentsCross(a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2): boolean {
  const cross = (o: Vec2, p: Vec2, q: Vec2) =>
    (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);

  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

interface Vec2 { x: number; y: number }

describe('the drawn curve', () => {
  const asPlane = (path: FlightPath): Vec2[] =>
    path.map(point => ({
      x: point.geometry.coordinates[0],
      y: point.geometry.coordinates[1]
    }));

  const selfCrossings = (rotationDeg: number, overrides: Partial<ManoeuvreParams> = {}) => {
    const points = asPlane(createManoeuvrePath({ ...TURN, rotationDeg, ...overrides }));
    let crossings = 0;

    for (let i = 0; i + 1 < points.length; i++) {
      for (let j = i + 2; j + 1 < points.length; j++) {
        if (segmentsCross(points[i], points[i + 1], points[j], points[j + 1])) {
          crossings++;
        }
      }
    }

    return crossings;
  };

  it.each([90, 135, 180, 270])('never crosses itself at %i degrees', rotationDeg => {
    expect(selfCrossings(rotationDeg)).toBe(0);
  });

  it.each([450, 540])('crosses at most once leaving the loop at %i degrees', rotationDeg => {
    // A turn of more than a full circle ends up inside its own track, so the
    // run out to the target has to cross it — a real 450 looks like that
    // too. What the shrinking radius buys is that the CURVE does not wrap
    // back over itself, which would read as a knot rather than a turn.
    expect(selfCrossings(rotationDeg)).toBeLessThanOrEqual(1);
  });
});

describe('wind drift over the turn', () => {
  const WINDS = createWindProfile([
    createWindRow(0, 270, 10),
    createWindRow(500, 250, 18),
    createWindRow(1500, 240, 26)
  ]);
  const TARGET: Target = { target: { lat: 28.21887, lng: -82.15122 }, finalHeading: 270 };

  /** How far the wind moves the initiation point over the whole turn. */
  const driftFt = (params: ManoeuvreParams): number => {
    const ideal = reposition(createManoeuvrePath(params), [], TARGET, false);
    const corrected = addWind(ideal, WINDS, true);
    const last = ideal.length - 1;

    return turf.distance(ideal[last], corrected[last], { units: 'feet' });
  };

  it('is the same however deep or wide the setup is', () => {
    // Altitude and time are both spread along the ground track, so altitude
    // is linear in time whatever shape the turn takes. Drift is the wind
    // integrated over time, so it cannot depend on the shape.
    const reference = driftFt(TURN);

    for (const depthFt of [100, 300, 1500, 2500]) {
      for (const offsetFt of [50, 150, 800]) {
        expect(driftFt({ ...TURN, depthFt, offsetFt })).toBeCloseTo(reference, 1);
      }
    }
  });

  it('is the same however far the turn rotates', () => {
    const reference = driftFt(TURN);

    for (const rotationDeg of [90, 135, 270, 450]) {
      expect(driftFt({ ...TURN, rotationDeg })).toBeCloseTo(reference, 1);
    }
  });

  it('does change with the altitude and the time it takes', () => {
    // The guard on the tests above: they would also pass if drift were
    // simply not being applied.
    expect(driftFt({ ...TURN, duration: 24 })).toBeGreaterThan(driftFt(TURN) * 2);
    expect(driftFt({ ...TURN, altitudeFt: 300 })).not.toBeCloseTo(driftFt(TURN), 1);
  });
});

/** A brisk crosswind to the final heading below, so drift shows up. */
const CROSSWIND = createWindProfile([
  createWindRow(0, 180, 20),
  createWindRow(1500, 180, 30)
]);
const DRIFT_TARGET: Target = {
  target: { lat: 28.21887, lng: -82.15122 },
  finalHeading: 270
};

describe('manoeuvreBounds', () => {
  it('stops the depth where a quarter turn stops being drawable', () => {
    // The reported symptom: stepping depth down to 0 on a 90 left the field
    // reading 0 while the map drew something else entirely.
    const bounds = manoeuvreBounds({ ...TURN, rotationDeg: 90 });

    expect(bounds.depthFt.min).toBeGreaterThan(0);
    expect(solveManoeuvre({ ...TURN, rotationDeg: 90, depthFt: bounds.depthFt.min }).reaches)
      .toBe(true);
    expect(solveManoeuvre({ ...TURN, rotationDeg: 90, depthFt: bounds.depthFt.min - 5 }).reaches)
      .toBe(false);
  });

  it('opens the depth right up once the turn can come back round', () => {
    const quarter = manoeuvreBounds({ ...TURN, rotationDeg: 90 });
    const threeQuarter = manoeuvreBounds({ ...TURN, rotationDeg: 270 });

    expect(threeQuarter.depthFt.min).toBeLessThan(quarter.depthFt.min);
    expect(threeQuarter.depthFt.min).toBeLessThan(0);
  });

  it('keeps the offset on the turn side for a quarter turn, either side for a 270', () => {
    expect(manoeuvreBounds({ ...TURN, rotationDeg: 90 }).offsetFt.min).toBeGreaterThan(0);
    expect(manoeuvreBounds({ ...TURN, rotationDeg: 270 }).offsetFt.min).toBeLessThan(0);
  });

  it('reports every bound as a value that actually works', () => {
    for (const rotationDeg of [90, 135, 270, 450]) {
      const bounds = manoeuvreBounds({ ...TURN, rotationDeg });

      for (const depthFt of [bounds.depthFt.min, bounds.depthFt.max]) {
        expect(solveManoeuvre({ ...TURN, rotationDeg, depthFt }).reaches).toBe(true);
      }
      for (const offsetFt of [bounds.offsetFt.min, bounds.offsetFt.max]) {
        expect(solveManoeuvre({ ...TURN, rotationDeg, offsetFt }).reaches).toBe(true);
      }
    }
  });
});

describe('describeManoeuvrePath', () => {
  it('reads back the rotation and the headings a turn was built from', () => {
    for (const turnDirection of ['left', 'right'] as const) {
      for (const rotationDeg of [90, 135, 270, 450]) {
        const path = createManoeuvrePath({ ...TURN, turnDirection, rotationDeg });
        const described = describeManoeuvrePath(path);
        const expectedSign = turnDirection === 'right' ? 1 : -1;

        expect(described).not.toBeNull();
        expect(described!.rotationDeg).toBeCloseTo(expectedSign * rotationDeg, 1);
        expect(bearingDelta(described!.finalHeadingDeg, described!.entryHeadingDeg))
          .toBeCloseTo(bearingDelta(0, -expectedSign * rotationDeg), 1);
      }
    }
  });

  it('does not care which end of the path it is handed', () => {
    const path = createManoeuvrePath(TURN);
    const forwards = describeManoeuvrePath(path);
    const backwards = describeManoeuvrePath([...path].reverse());

    expect(backwards).toEqual(forwards);
  });

  it('measures a recorded track it never generated', () => {
    // A hand-built right-angle turn: east, then south. Nothing here came
    // from createManoeuvrePath, which is the point — tracks and samples get
    // described the same way.
    const legs: FlightPath = [
      createPoint(0, 0, { alt: 600, time: 0 }),
      createPoint(0.002, 0, { alt: 300, time: 5000 }),
      createPoint(0.002, -0.002, { alt: 0, time: 10000 })
    ];
    const described = describeManoeuvrePath(legs);

    expect(described!.entryHeadingDeg).toBeCloseTo(90, 1);
    expect(described!.finalHeadingDeg).toBeCloseTo(180, 1);
    expect(described!.rotationDeg).toBeCloseTo(90, 1);
  });

  it('measures a drifted path as ground track, not as heading', () => {
    // Why describeManoeuvreForDisplay exists: under wind the canopy crabs,
    // so the bearings along the corrected path are not the headings flown.
    const ideal = reposition(createManoeuvrePath(TURN), [], DRIFT_TARGET, false);
    const corrected = addWind(ideal, CROSSWIND, true);

    expect(describeManoeuvrePath(ideal)!.finalHeadingDeg)
      .toBeCloseTo(DRIFT_TARGET.finalHeading, 3);
    expect(
      Math.abs(describeManoeuvrePath(corrected)!.finalHeadingDeg - DRIFT_TARGET.finalHeading)
    ).toBeGreaterThan(1);
  });

  it('returns null for a path too short to have a direction', () => {
    expect(describeManoeuvrePath([])).toBeNull();
    expect(describeManoeuvrePath([createPoint(0, 0)])).toBeNull();
  });
});

describe('describeManoeuvreForDisplay', () => {
  const ideal = () => reposition(createManoeuvrePath(TURN), [], DRIFT_TARGET, false);
  const drifted = () => addWind(ideal(), CROSSWIND, true);

  it('keeps the headings and the rotation free of wind', () => {
    // The drawn approach axis used to swing round as soon as wind was
    // loaded, because it was measured off the drifted ground track.
    const shown = describeManoeuvreForDisplay(drifted(), ideal())!;

    expect(shown.finalHeadingDeg).toBeCloseTo(DRIFT_TARGET.finalHeading, 3);
    expect(shown.entryHeadingDeg)
      .toBeCloseTo(describeManoeuvrePath(ideal())!.entryHeadingDeg, 3);
    expect(shown.rotationDeg).toBeCloseTo(-TURN.rotationDeg, 1);
  });

  it('takes the positions from the path as drawn', () => {
    // The hint annotates the line on screen, so it has to sit on it.
    const shown = describeManoeuvreForDisplay(drifted(), ideal())!;
    const drawn = describeManoeuvrePath(drifted())!;

    expect(shown.initiation).toEqual(drawn.initiation);
    expect(shown.landing).toEqual(drawn.landing);
    expect(shown.spanFt).toBeCloseTo(drawn.spanFt, 6);
  });

  it('falls back to the drawn path when there is no wind-free one', () => {
    const drawn = describeManoeuvrePath(drifted())!;

    expect(describeManoeuvreForDisplay(drifted(), [])).toEqual(drawn);
    expect(describeManoeuvreForDisplay([], ideal())).toBeNull();
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
