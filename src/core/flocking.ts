/**
 * Flocking mode math: descent path construction, into-wind jumprun
 * resolution, drift vectors and the FWC-style spot description.
 *
 * Ported from the owner's Flocking Wind Calculator (FWC). Deliberate
 * deviations from FWC:
 * - Wind application reuses FliP's addWind() (vector-interpolating,
 *   1-second integration steps) instead of FWC's per-forecast-level
 *   stepwise sum, so results agree within a few percent, not exactly.
 * - Altitudes are plain feet (FWC's UI uses thousands of feet).
 * - POM points are inserted exactly at round altitude multiples (FWC has
 *   no path concept at all), so map labels read 5000/6000/... cleanly.
 */
import * as turf from '@turf/turf';

import { FlightPath, FlightPoint, LatLng } from '../types';
import { addWind, destinationPoint, normalizeBearing } from './geometry';
import { mphToFps } from './units';
import { WindProfile } from './wind';

const DEG_TO_RAD = Math.PI / 180;
const MI_PER_NM = 1.15078; // FWC's miToNm constant
const KM_PER_MI = 1.60934;
const METERS_PER_MILE = 1609.344;

// ---------------------------------------------------------------------------
// Distance units (FWC has a mi/nm toggle; FliP adds km)
// ---------------------------------------------------------------------------

export const DISTANCE_UNITS = ['mi', 'nm', 'km'] as const;
export type DistanceUnit = typeof DISTANCE_UNITS[number];

export const DISTANCE_UNIT_LABELS: Record<DistanceUnit, string> = {
  mi: 'mi',
  nm: 'nm',
  km: 'km'
};

/** Convert a distance in statute miles to the given display unit. */
export function milesToDisplay(miles: number, unit: DistanceUnit): number {
  switch (unit) {
    case 'mi':
      return miles;
    case 'nm':
      return miles / MI_PER_NM;
    case 'km':
      return miles * KM_PER_MI;
  }
}

/** Convert a distance in the given display unit back to statute miles. */
export function displayToMiles(value: number, unit: DistanceUnit): number {
  switch (unit) {
    case 'mi':
      return value;
    case 'nm':
      return value * MI_PER_NM;
    case 'km':
      return value / KM_PER_MI;
  }
}

// ---------------------------------------------------------------------------
// Params document (persisted under flip.flocking.params; see core/model)
// ---------------------------------------------------------------------------

/**
 * Jumprun configuration.
 *
 * - auto: today's behavior — the jumprun is the canopy flight direction
 *   (`FlockingParams.direction`) and the exit is the computed spot.
 * - pinned: the jumprun is a fixed LINE (along directionDeg, offset
 *   laterally offsetMi from the Spot Reference, positive = right of the
 *   run direction); the exit is a chosen POSITION on it (exitAlongMi =
 *   signed miles from the offset point, null = auto-pick the best point)
 *   and the canopy heading/speed are solved from the winds.
 */
export type JumprunConfig =
  | { mode: 'auto' }
  | {
    mode: 'pinned';
    directionDeg: number;
    offsetMi: number;
    exitAlongMi: number | null;
  };

export interface FlockingParams {
  /** Exit altitude (top of the flown window), ft. */
  windowTopFt: number;
  /** End-of-jump altitude (bottom of the flown window), ft. */
  windowBottomFt: number;
  /** Vertical speed, mph (FWC's unit). */
  descentRateMph: number;
  /** Horizontal speed over ground, mph (FWC's unit). */
  horizontalSpeedMph: number;
  /** Jumprun direction: cardinal degrees, or resolved from the winds. */
  direction: number | 'into-wind';
  /** Display unit for drift/spot distances. */
  distanceUnit: DistanceUnit;
  /**
   * Optional pinned reference point ("C") the spot is described against;
   * null means the spot is relative to the target itself.
   */
  referencePoint: LatLng | null;
  /** Jumprun mode: auto (follow the canopy flight) or a pinned line. */
  jumprun: JumprunConfig;
  /** Radius of the end-of-jump target area around B, miles. */
  targetRadiusMi: number;
  /** Show the jumprun-aligned distance grid around the Spot Reference. */
  showGrid: boolean;
}

// ---------------------------------------------------------------------------
// Direction conversions (mirroring FWC's Drift.kt exactly)
// ---------------------------------------------------------------------------

/** Cardinal degrees (0=N, clockwise) to math degrees (0=E, ccw). */
export function cardinalToDeg(cardinal: number): number {
  return ((90 - cardinal % 360) + 360) % 360;
}

/** Math degrees (0=E, ccw) to cardinal degrees (0=N, clockwise). */
export function degreeToCardinal(deg: number): number {
  return ((-(deg % 360) + 90) + 360) % 360;
}

/** Cardinal direction of a vector in math coordinates (x east, y north). */
export function vectorCardinalDirection(x: number, y: number): number {
  return degreeToCardinal(Math.atan2(y, x) / DEG_TO_RAD);
}

// ---------------------------------------------------------------------------
// Path construction
// ---------------------------------------------------------------------------

export interface MakeFlockingPathParams {
  /** Exit altitude (top of the flown window), ft. */
  windowTopFt: number;
  /** End-of-jump altitude (bottom of the flown window), ft. */
  windowBottomFt: number;
  /** Vertical speed, mph. */
  descentRateMph: number;
  /** Horizontal speed over ground, mph. */
  horizontalSpeedMph: number;
  /** Absolute flight direction over ground, cardinal degrees. */
  directionDeg: number;
  /** Altitude interval for POM markers, ft (e.g. 1000 ft, or ~250 m). */
  pomIntervalFt?: number;
}

/**
 * Build the no-wind flocking descent path at the origin.
 *
 * point[0] is the END of the jump (alt = windowBottomFt, time 0); later
 * points are progressively earlier in time (negative time, like
 * makePattern) and higher, up to the exit at windowTopFt. The path is
 * flown TOWARD the end along directionDeg, so earlier points lie behind
 * the end along the reciprocal bearing. Points step 1 s apart, with extra
 * points inserted exactly at round pomIntervalFt multiples (marked POM);
 * the end and exit points are POMs too.
 */
export function makeFlockingPath({
  windowTopFt,
  windowBottomFt,
  descentRateMph,
  horizontalSpeedMph,
  directionDeg,
  pomIntervalFt = 1000
}: MakeFlockingPathParams): FlightPath {
  const points: FlightPath = [
    turf.point([0, 0], { alt: windowBottomFt, time: 0, pom: 1 }) as FlightPoint
  ];

  if (!(descentRateMph > 0) || !(windowTopFt > windowBottomFt)) {
    return points;
  }

  const stepVfps = descentRateMph * mphToFps;
  const stepHfps = Math.max(horizontalSpeedMph, 0) * mphToFps;
  const backBearing = normalizeBearing(directionDeg + 180);
  const interval = pomIntervalFt > 0 ? pomIntervalFt : 1000;

  let alt = windowBottomFt;
  let nextPomAlt = Math.floor(windowBottomFt / interval) * interval + interval;

  while (alt < windowTopFt - 1e-9) {
    const stepToAlt = Math.min(alt + stepVfps, nextPomAlt, windowTopFt);
    const dVft = stepToAlt - alt;
    const dtMs = 1000 * (dVft / stepVfps);
    const isPom = stepToAlt >= nextPomAlt - 1e-9 || stepToAlt >= windowTopFt - 1e-9;

    let p = turf.clone(points[points.length - 1]) as FlightPoint;

    p.properties.alt = stepToAlt;
    p.properties.time -= dtMs;
    p.properties.pom = isPom ? 1 : 0;

    const dHft = stepHfps * (dtMs / 1000);

    if (dHft > 0) {
      p = turf.transformTranslate(p, dHft, backBearing, { units: 'feet' }) as FlightPoint;
    }
    points.push(p);

    if (stepToAlt >= nextPomAlt - 1e-9) {
      nextPomAlt += interval;
    }
    alt = stepToAlt;
  }

  return points;
}

// ---------------------------------------------------------------------------
// Into-wind jumprun direction
// ---------------------------------------------------------------------------

/**
 * The "into wind" jumprun direction: the reciprocal of the pure wind-drift
 * direction over the altitude window (FWC: windDrift.direction + 180).
 *
 * Computed by applying the wind to a zero-horizontal-speed descent: the
 * corrected exit ends up exactly upwind of the end point, so the bearing
 * end → exit IS the into-wind direction. Calm winds return 0 (north) —
 * arbitrary but stable.
 */
export function intoWindDirection(
  wind: WindProfile,
  windowTopFt: number,
  windowBottomFt: number,
  descentRateMph: number,
  interpolate?: boolean
): number {
  const path = makeFlockingPath({
    windowTopFt,
    windowBottomFt,
    descentRateMph,
    horizontalSpeedMph: 0,
    directionDeg: 0
  });

  if (path.length < 2) {
    return 0;
  }

  const corrected = addWind(path, wind, interpolate);
  const end = corrected[0];
  const exit = corrected[corrected.length - 1];

  if (turf.distance(end, exit, { units: 'feet' }) < 1) {
    return 0;
  }

  return normalizeBearing(turf.bearing(end, exit));
}

// ---------------------------------------------------------------------------
// Drift vectors (the FWC "Wind drift / Canopy flight / Combined" block)
// ---------------------------------------------------------------------------

export interface DriftVector {
  lengthMi: number;
  /** Cardinal direction of travel, degrees. */
  directionDeg: number;
}

export interface FlockingVectors {
  windDrift: DriftVector;
  canopyFlight: DriftVector;
  combined: DriftVector;
}

function vectorBetween(from: FlightPoint, to: FlightPoint): DriftVector {
  return {
    lengthMi: turf.distance(from, to, { units: 'miles' }),
    directionDeg: normalizeBearing(turf.bearing(from, to))
  };
}

/**
 * The three FWC drift vectors from the positioned ideal and corrected
 * paths (point[0] = end of jump at the target, last point = exit):
 * canopy flight = ideal exit → end, combined = corrected exit → end,
 * wind drift = combined − canopy = corrected exit → ideal exit.
 */
export function flockingVectors(
  ideal: FlightPath,
  corrected: FlightPath
): FlockingVectors | null {
  if (ideal.length === 0 || corrected.length === 0) {
    return null;
  }

  const end = ideal[0];
  const idealExit = ideal[ideal.length - 1];
  const correctedExit = corrected[corrected.length - 1];

  return {
    canopyFlight: vectorBetween(idealExit, end),
    combined: vectorBetween(correctedExit, end),
    windDrift: vectorBetween(correctedExit, idealExit)
  };
}

// ---------------------------------------------------------------------------
// Spot description (the FWC "Forecasted Spot" block)
// ---------------------------------------------------------------------------

export interface SpotDescription {
  /** The jumprun direction the description is relative to, cardinal deg. */
  jumprunDeg: number;
  /** Distance from exit to reference along the jumprun, miles (absolute). */
  alongMi: number;
  /** True: exit lies before the reference along the jumprun ("prior"). */
  prior: boolean;
  /** Perpendicular offset from the jumprun line, miles (absolute). */
  offsetMi: number;
  /** Offset side flag, matching FWC's convention (see note below). */
  offsetLeft: boolean;
}

/**
 * Describe the exit spot relative to a reference point, FWC-style:
 * "<along> mi prior/PAST" and "Offset <offset> mi left/right".
 *
 * The displacement vector c = exit → reference is projected onto the
 * jumprun direction; `prior` when the along-jumprun component is
 * positive. Left/right is the geometric side of the exit relative to the
 * jumprun line, as seen flying the jumprun — deliberately NOT FWC's
 * `(combined − proj) · (combined.y, −combined.x) > 0`, which inverts the
 * side for "PAST" exits (confirmed FWC bug, 2026-07-17: that dot product
 * equals −along·side, so its sign flips with prior/past even though the
 * exit never changes sides of the line).
 */
export function spotDescription(
  exit: LatLng,
  reference: LatLng,
  jumprunDeg: number
): SpotDescription {
  // c = exit → reference in math coordinates (x east, y north), miles
  const { eastMi: cx, northMi: cy } = localMilesEN(exit, reference);

  // b = unit vector along the jumprun
  const psi = cardinalToDeg(jumprunDeg) * DEG_TO_RAD;
  const bx = Math.cos(psi);
  const by = Math.sin(psi);

  const along = cx * bx + cy * by;
  const rejX = cx - along * bx;
  const rejY = cy - along * by;

  return {
    jumprunDeg: normalizeBearing(jumprunDeg),
    alongMi: Math.abs(along),
    prior: along > 0,
    offsetMi: Math.hypot(rejX, rejY),
    // Geometric side of the exit vs the jumprun heading: cross(b, exit−ref).
    // FWC's formula expands to along·(this) — same when prior, flipped when
    // PAST; see the doc comment.
    offsetLeft: by * cx - bx * cy > 0
  };
}

// ---------------------------------------------------------------------------
// Pinned jumprun: decoupling the jumprun line from the canopy flight.
//
// Key fact: the wind drift W over the altitude window is a flat east/north
// vector INDEPENDENT of the canopy flight direction (it depends only on the
// winds, the window and the descent rate). Flying for T = window/descentRate
// at horizontal speed ≤ s therefore reaches, from an exit E, any point in
// the DISK centered E + W with radius s·T. With the exit constrained to a
// pinned jumprun line, the canopy heading becomes the free variable and
// reachability is a circle/line intersection. All math here is flat local
// miles around the points involved (distances are a few miles; same
// approximation spotDescription uses).
// ---------------------------------------------------------------------------

/** A flat local vector in miles: east and north components. */
export interface VectorEN {
  eastMi: number;
  northMi: number;
}

/** Displacement from → to as a flat east/north vector in miles. */
export function localMilesEN(from: LatLng, to: LatLng): VectorEN {
  const f = [from.lng, from.lat] as [number, number];
  const t = [to.lng, to.lat] as [number, number];
  const dMi = turf.distance(f, t, { units: 'miles' });

  if (dMi < 1e-12) {
    return { eastMi: 0, northMi: 0 };
  }

  const phi = cardinalToDeg(normalizeBearing(turf.bearing(f, t))) * DEG_TO_RAD;

  return { eastMi: dMi * Math.cos(phi), northMi: dMi * Math.sin(phi) };
}

/** A flat EN vector as a length + cardinal travel direction. */
export function enToDriftVector(v: VectorEN): DriftVector {
  const lengthMi = Math.hypot(v.eastMi, v.northMi);

  return {
    lengthMi,
    directionDeg: lengthMi > 1e-12 ? vectorCardinalDirection(v.eastMi, v.northMi) : 0
  };
}

/** Flight duration through the altitude window, seconds (0 if empty). */
export function flockingDurationS(
  windowTopFt: number,
  windowBottomFt: number,
  descentRateMph: number
): number {
  if (!(descentRateMph > 0) || !(windowTopFt > windowBottomFt)) {
    return 0;
  }

  return (windowTopFt - windowBottomFt) / (descentRateMph * mphToFps);
}

/**
 * Total downwind drift over the altitude window as a flat east/north vector
 * in miles. Independent of the canopy flight direction. Computed through
 * the same pipeline the rendered path uses (makeFlockingPath at zero
 * horizontal speed + addWind, 1-second steps, same getWindAt sampling), so
 * it agrees with the map exactly rather than within integration error.
 */
export function windDriftVector(
  wind: WindProfile,
  windowTopFt: number,
  windowBottomFt: number,
  descentRateMph: number,
  interpolate?: boolean
): VectorEN {
  const path = makeFlockingPath({
    windowTopFt,
    windowBottomFt,
    descentRateMph,
    horizontalSpeedMph: 0,
    directionDeg: 0
  });

  if (path.length < 2) {
    return { eastMi: 0, northMi: 0 };
  }

  const corrected = addWind(path, wind, interpolate);
  const end = corrected[0];
  const exit = corrected[corrected.length - 1];

  // addWind holds the end fixed and moves the exit upwind; the downwind
  // drift the jumper experiences is therefore exit → end.
  return localMilesEN(
    { lat: exit.geometry.coordinates[1], lng: exit.geometry.coordinates[0] },
    { lat: end.geometry.coordinates[1], lng: end.geometry.coordinates[0] }
  );
}

/** The canopy-flight solution for a fixed exit (see solveCanopyFlight). */
export interface CanopySolution {
  /** Required flight direction over ground, cardinal degrees. */
  headingDeg: number;
  /** Speed needed to end exactly at the target center, mph. */
  requiredSpeedMph: number;
  /** Whether the target circle is reachable at maxSpeedMph. */
  reachable: boolean;
  /** Distance short of the target circle at max speed, miles (0 if reachable). */
  shortfallMi: number;
  /** |target − exit − W|: distance to cover through the air-mass, miles. */
  distanceMi: number;
}

/**
 * Solve the canopy flight from a fixed exit: the wind contributes the fixed
 * drift W, so the flight must cover D = target − exit − W over the duration.
 * requiredSpeedMph targets the circle CENTER; `reachable` allows ending
 * anywhere within targetRadiusMi of it.
 */
export function solveCanopyFlight(
  exit: LatLng,
  target: LatLng,
  driftMi: VectorEN,
  durationS: number,
  maxSpeedMph: number,
  targetRadiusMi = 0
): CanopySolution {
  const toTarget = localMilesEN(exit, target);
  const dx = toTarget.eastMi - driftMi.eastMi;
  const dy = toTarget.northMi - driftMi.northMi;
  const distanceMi = Math.hypot(dx, dy);
  const durationH = durationS / 3600;

  const requiredSpeedMph = durationH > 0
    ? distanceMi / durationH
    : distanceMi > 0 ? Infinity : 0;
  const reachMi = Math.max(maxSpeedMph, 0) * durationH + Math.max(targetRadiusMi, 0);

  return {
    headingDeg: distanceMi > 1e-9 ? vectorCardinalDirection(dx, dy) : 0,
    requiredSpeedMph,
    reachable: distanceMi <= reachMi + 1e-9,
    shortfallMi: Math.max(0, distanceMi - reachMi),
    distanceMi
  };
}

/** A pinned jumprun line: a point on it plus its cardinal direction. */
export interface JumprunLine {
  origin: LatLng;
  directionDeg: number;
}

/**
 * The origin of a pinned jumprun line: the Spot Reference offset laterally
 * by offsetMi (positive = right of the run direction, looking along it).
 */
export function jumprunLineOrigin(
  reference: LatLng,
  directionDeg: number,
  offsetMi: number
): LatLng {
  if (offsetMi === 0) {
    return reference;
  }

  return destinationPoint(
    reference,
    normalizeBearing(directionDeg + 90),
    offsetMi * METERS_PER_MILE
  );
}

/** The point at signed distance tMi (miles) along the line from its origin. */
export function pointAlongJumprun(line: JumprunLine, tMi: number): LatLng {
  if (tMi === 0) {
    return line.origin;
  }

  const bearing = tMi >= 0
    ? line.directionDeg
    : normalizeBearing(line.directionDeg + 180);

  return destinationPoint(line.origin, bearing, Math.abs(tMi) * METERS_PER_MILE);
}

/**
 * Signed distance (miles from the line origin, positive along the run
 * direction) of the projection of a point onto the jumprun line.
 */
export function projectOntoJumprunMi(line: JumprunLine, point: LatLng): number {
  const d = localMilesEN(line.origin, point);
  const psi = cardinalToDeg(line.directionDeg) * DEG_TO_RAD;

  return d.eastMi * Math.cos(psi) + d.northMi * Math.sin(psi);
}

/**
 * The best exit position along the line: the projection of C = target − W
 * onto it (the exit minimizing the required canopy speed). When a reachable
 * segment exists this is always its midpoint, so no clamping is needed.
 */
export function bestExitAlongMi(
  line: JumprunLine,
  target: LatLng,
  driftMi: VectorEN
): number {
  const d = localMilesEN(line.origin, target);
  const psi = cardinalToDeg(line.directionDeg) * DEG_TO_RAD;

  return (d.eastMi - driftMi.eastMi) * Math.cos(psi) +
    (d.northMi - driftMi.northMi) * Math.sin(psi);
}

/**
 * The interval of exit positions along the jumprun line from which the
 * target circle is reachable: solve |C − P(t)| ≤ s·T + R with C = target −
 * W. Returns signed miles from the line origin, or null when the line
 * misses the reachable disk entirely. A tangent line yields a zero-length
 * interval.
 */
export function reachableJumprunSegment(
  line: JumprunLine,
  target: LatLng,
  driftMi: VectorEN,
  durationS: number,
  maxSpeedMph: number,
  targetRadiusMi: number
): { tMinMi: number; tMaxMi: number } | null {
  const rho = Math.max(maxSpeedMph, 0) * (durationS / 3600) + Math.max(targetRadiusMi, 0);
  const d = localMilesEN(line.origin, target);
  const cx = d.eastMi - driftMi.eastMi;
  const cy = d.northMi - driftMi.northMi;
  const psi = cardinalToDeg(line.directionDeg) * DEG_TO_RAD;
  const ux = Math.cos(psi);
  const uy = Math.sin(psi);
  const along = cx * ux + cy * uy;
  const perp2 = Math.max(0, cx * cx + cy * cy - along * along);
  const h2 = rho * rho - perp2;

  if (h2 < 0) {
    return null;
  }

  const h = Math.sqrt(h2);

  return { tMinMi: along - h, tMaxMi: along + h };
}
