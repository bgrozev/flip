/**
 * Behavior-pinning tests for the derive pipeline:
 * reposition → addWind → straightenLegs → averageWind, plus getWindAt.
 *
 * These are golden-value tests with realistic inputs (a 3-leg pattern, a
 * parameter manoeuvre and multi-row winds). Their purpose is to act as a
 * safety net for the Phase 1 refactors (memoization, Winds → plain data,
 * core/ extraction): the numbers below were produced by the current
 * implementation and must not change unless behavior is intentionally
 * changed.
 *
 * Deliberately NOT pinned here (known bugs, fixed in later steps):
 * - Wind direction interpolation wrap (350°→10° goes through 180°).
 *   See step 2a; interpolation is only pinned for rows with a uniform
 *   direction, where linear and vector interpolation agree.
 */
import { makePattern } from './pattern';
import { addWind, averageWind, reposition, straightenLegs } from './geometry';
import { WindProfile, createWindProfile, createWindRow, getWindAt } from './wind';
import { FlightPath, Target } from '../types';

const TARGET: Target = { target: { lat: 28.21887, lng: -82.15122 }, finalHeading: 270 };

/**
 * A fixed 3-point manoeuvre, as literal data rather than something
 * `createManoeuvrePath` produces.
 *
 * These goldens pin the PIPELINE (reposition → addWind → straightenLegs →
 * averageWind), not the shape of a turn. Generating the input from the
 * manoeuvre model would couple them: the turn parameters were reworked (see
 * core/manoeuvre) and every number below would have had to be regenerated,
 * destroying the safety net at exactly the moment it was needed. The values
 * are the ones the old offsetX=300 / offsetY=150 / left turn produced, so
 * the pins carry over untouched. Turn geometry is tested in manoeuvre.test.
 */
function makeManoeuvre(): FlightPath {
  const coords: [number, number][] = [
    [0.10082233975651889, -0.09958883074286257],
    [0.10000000000002274, -0.09958883074286257],
    [0.1, -0.1]
  ];
  const props = [
    { time: 8000, alt: 0, pom: 1 },
    { time: 4000, alt: 450, pom: 0 },
    { time: 0, alt: 900, pom: 1 }
  ];

  return coords.map((coordinates, i) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [...coordinates] },
    properties: { ...props[i] }
  })) as FlightPath;
}

function makeThreeLegPattern(): FlightPath {
  return makePattern({
    descentRateMph: 9,
    glideRatio: 3.0,
    legs: [
      { altitude: 300, direction: 0 },
      { altitude: 300, direction: 270 },
      { altitude: 300, direction: 270 }
    ]
  });
}

// Wind rows with varying directions — used without interpolation so the
// values stay valid when interpolation switches to vector (u/v) blending.
function makeVariedWinds(): WindProfile {
  return createWindProfile([
    createWindRow(0, 180, 8),
    createWindRow(500, 210, 12),
    createWindRow(1500, 240, 18),
    createWindRow(3000, 270, 25)
  ]);
}

// Wind rows sharing one direction — linear and vector interpolation agree,
// so these pins survive the step 2a interpolation fix.
function makeUniformDirectionWinds(): WindProfile {
  return createWindProfile([
    createWindRow(0, 225, 8),
    createWindRow(500, 225, 14),
    createWindRow(1500, 225, 20)
  ]);
}

function expectCoords(path: FlightPath, index: number, lng: number, lat: number) {
  expect(path[index].geometry.coordinates[0]).toBeCloseTo(lng, 9);
  expect(path[index].geometry.coordinates[1]).toBeCloseTo(lat, 9);
}

describe('reposition (golden values)', () => {
  it('repositions manoeuvre + 3-leg pattern to the target with heading correction', () => {
    const c = reposition(makeManoeuvre(), makeThreeLegPattern(), TARGET, true);

    expect(c).toHaveLength(73);

    // Landing point pinned at the target
    expectCoords(c, 0, -82.15121999999997, 28.21887);
    expect(c[0].properties).toMatchObject({ time: 8000, alt: 0, pom: 1, phase: 'manoeuvre' });

    // Middle and start of the manoeuvre
    expectCoords(c, 1, -82.15028674189784, 28.218869996833238);
    expect(c[1].properties).toMatchObject({ time: 4000, alt: 450, pom: 0, phase: 'manoeuvre' });
    expectCoords(c, 2, -82.15028673806438, 28.219281166090397);
    expect(c[2].properties).toMatchObject({ time: 0, alt: 900, pom: 1, phase: 'manoeuvre' });

    // First pattern point coincides with the manoeuvre start; time/alt rebased
    expectCoords(c, 3, -82.15028673806438, 28.219281166090397);
    expect(c[3].properties).toMatchObject({ time: 0, alt: 900, pom: 0, phase: 'pattern' });
    expectCoords(c, 4, -82.15028673806438, 28.21938971477428);
    expect(c[4].properties.alt).toBeCloseTo(913.2, 9);
    expect(c[4].properties.time).toBe(-1000);

    // Pattern entry (highest point)
    expectCoords(c, 71, -82.14748695120187, 28.21936011058779);
    expect(c[71].properties.alt).toBeCloseTo(1790.4, 9);
    expect(c[71].properties.time).toBe(-67454);
    expectCoords(c, 72, -82.14748695223682, 28.219281166090397);
    expect(c[72].properties.alt).toBeCloseTo(1800, 9);
    expect(c[72].properties.time).toBe(-68181);
    expect(c[72].properties.pom).toBe(1);
  });

  it('repositions without pattern heading correction', () => {
    const c = reposition(makeManoeuvre(), makeThreeLegPattern(), TARGET, false);

    expect(c).toHaveLength(73);
    expectCoords(c, 0, -82.15121999999997, 28.21887);
    expectCoords(c, 3, -82.15028673806438, 28.219281166090397);
    expectCoords(c, 72, -82.14748694985781, 28.219281145823334);
  });

  it('does not mutate its input paths', () => {
    const manoeuvre = makeManoeuvre();
    const pattern = makeThreeLegPattern();
    const manoeuvreBefore = JSON.stringify(manoeuvre);
    const patternBefore = JSON.stringify(pattern);

    reposition(manoeuvre, pattern, TARGET, true);

    expect(JSON.stringify(manoeuvre)).toBe(manoeuvreBefore);
    expect(JSON.stringify(pattern)).toBe(patternBefore);
  });
});

describe('addWind (golden values)', () => {
  // Goldens regenerated 2026-07-17 when addWind switched from polar drift
  // accumulation (distance + re-derived spherical bearing) to a flat
  // east/north vector sum: the old form's wandering bearing curved paths
  // whose drift nearly cancels the flown line (visible in flocking mode).
  // Coordinate deltas from the old goldens are sub-foot.

  it('keeps a uniform-wind corrected path exactly collinear', () => {
    // Regression for the flocking curve bug: flight almost straight into a
    // strong uniform wind — corrected segments are the small difference of
    // two large vectors, which amplified any drift-bearing wobble.
    const path = makePattern({
      descentRateMph: 21,
      glideRatio: 3.5,
      legs: [{ altitude: 8000, direction: 0 }]
    });
    const placed = reposition([], path, { ...TARGET, finalHeading: 190 }, false);
    const wind = createWindProfile([createWindRow(0, 10, 40), createWindRow(15000, 10, 40)]);
    const corrected = addWind(placed, wind, true);

    const bearings: number[] = [];

    for (let i = 1; i < corrected.length; i++) {
      const dLng = corrected[i].geometry.coordinates[0] - corrected[i - 1].geometry.coordinates[0];
      const dLat = corrected[i].geometry.coordinates[1] - corrected[i - 1].geometry.coordinates[1];

      bearings.push((Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360);
    }
    const spread = Math.max(...bearings) - Math.min(...bearings);

    expect(spread).toBeLessThan(0.05);
  });

  it('applies varied multi-row winds without interpolation', () => {
    const c = reposition(makeManoeuvre(), makeThreeLegPattern(), TARGET, true);
    const c2 = addWind(c, makeVariedWinds(), false);

    expect(c2).toHaveLength(73);

    // Landing point stays fixed at the target
    expectCoords(c2, 0, -82.15121999999997, 28.21887);

    expectCoords(c2, 1, -82.15028674189784, 28.218721948708673);
    expectCoords(c2, 2, -82.15028673806438, 28.218985069841274);
    expectCoords(c2, 3, -82.15028673806438, 28.218985069841274);
    expectCoords(c2, 71, -82.15071951646979, 28.215962536483392);
    expectCoords(c2, 72, -82.15077901732377, 28.215853320771032);
  });

  it('applies uniform-direction winds with interpolation', () => {
    const c = reposition(makeManoeuvre(), makeThreeLegPattern(), TARGET, true);
    const c2 = addWind(c, makeUniformDirectionWinds(), true);

    expect(c2).toHaveLength(73);
    expectCoords(c2, 0, -82.15121999999997, 28.21887);
    expectCoords(c2, 1, -82.15040554805586, 28.218765311000418);
    expectCoords(c2, 2, -82.1506045454999, 28.219001131487605);
    expectCoords(c2, 3, -82.1506045454999, 28.219001131487605);
    expectCoords(c2, 71, -82.15250301012401, 28.214940150249422);
    expectCoords(c2, 72, -82.15255698798637, 28.21481363912674);
  });

  it('preserves point properties (alt, time, pom, phase) from the input path', () => {
    const c = reposition(makeManoeuvre(), makeThreeLegPattern(), TARGET, true);
    const c2 = addWind(c, makeVariedWinds(), false);

    for (let i = 0; i < c.length; i++) {
      expect(c2[i].properties.alt).toBe(c[i].properties.alt);
      expect(c2[i].properties.time).toBe(c[i].properties.time);
      expect(c2[i].properties.pom).toBe(c[i].properties.pom);
      expect(c2[i].properties.phase).toBe(c[i].properties.phase);
    }
  });
});

describe('straightenLegs (golden values)', () => {
  it('redistributes intermediate pattern points onto straight legs', () => {
    const c = reposition(makeManoeuvre(), makeThreeLegPattern(), TARGET, true);
    const c2 = addWind(c, makeVariedWinds(), false);
    const s = straightenLegs(c2);

    expect(s).toHaveLength(73);

    // Leg boundaries (POMs) are unchanged
    expectCoords(s, 3, -82.15028673806438, 28.218985069841274);
    expectCoords(s, 72, -82.15077901732377, 28.215853320771032);

    // Intermediate points moved onto the straight line between boundaries
    expectCoords(s, 4, -82.15031786802659, 28.21904482203695);
    expectCoords(s, 5, -82.15034899798879, 28.219104574232627);
    expectCoords(s, 10, -82.1505046477998, 28.21940333521101);
    expectCoords(s, 71, -82.1506981422586, 28.21600172662013);
  });

  it('does not modify the input path', () => {
    const c = reposition(makeManoeuvre(), makeThreeLegPattern(), TARGET, true);
    const c2 = addWind(c, makeVariedWinds(), false);
    const before = JSON.stringify(c2);

    straightenLegs(c2);
    expect(JSON.stringify(c2)).toBe(before);
  });
});

describe('averageWind (golden values)', () => {
  it('computes average wind between ideal and corrected paths', () => {
    const c = reposition(makeManoeuvre(), makeThreeLegPattern(), TARGET, true);

    const varied = averageWind(c, addWind(c, makeVariedWinds(), false));
    expect(varied.speedKts).toBeCloseTo(12.740865247793002, 9);
    expect(varied.direction).toBeCloseTo(220.2405136361529, 9);

    const uniform = averageWind(c, addWind(c, makeUniformDirectionWinds(), true));
    expect(uniform.speedKts).toBeCloseTo(17.925966441804857, 9);
    expect(uniform.direction).toBeCloseTo(225.0011986267305, 9);
  });
});

describe('getWindAt (non-wrapping pins)', () => {
  // TODO(step 2a): direction interpolation between rows with different
  // directions wraps the wrong way across north (350°→10° goes through
  // 180°). The buggy outputs are intentionally NOT pinned here; step 2a
  // replaces linear direction/speed blending with vector (u/v)
  // interpolation and adds wrap tests.
  it('returns the exact row when the altitude matches', () => {
    const wind = getWindAt(makeVariedWinds(), 500, true);

    expect(wind.altFt).toBe(500);
    expect(wind.direction).toBeCloseTo(210, 9);
    expect(wind.speedKts).toBeCloseTo(12, 9);
  });

  it('returns the lower bracket without interpolation', () => {
    const wind = getWindAt(makeVariedWinds(), 1000, false);

    expect(wind.altFt).toBe(500);
    expect(wind.direction).toBe(210);
    expect(wind.speedKts).toBe(12);
  });

  it('interpolates speed between uniform-direction rows', () => {
    const winds = makeUniformDirectionWinds();

    const mid = getWindAt(winds, 1000, true);
    expect(mid.altFt).toBe(1000);
    expect(mid.direction).toBeCloseTo(225, 9);
    expect(mid.speedKts).toBeCloseTo(17, 9);

    const quarter = getWindAt(winds, 625, true);
    expect(quarter.altFt).toBe(625);
    expect(quarter.direction).toBeCloseTo(225, 9);
    expect(quarter.speedKts).toBeCloseTo(14.75, 9);
  });

  it('returns the highest row above the profile', () => {
    const wind = getWindAt(makeUniformDirectionWinds(), 9999, true);

    expect(wind.altFt).toBe(1500);
    expect(wind.direction).toBe(225);
    expect(wind.speedKts).toBe(20);
  });
});
