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
import { addWind, normalizeBearing } from './geometry';
import { mphToFps } from './units';
import { WindProfile } from './wind';

const DEG_TO_RAD = Math.PI / 180;
const MI_PER_NM = 1.15078; // FWC's miToNm constant
const KM_PER_MI = 1.60934;

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

// ---------------------------------------------------------------------------
// Params document (persisted under flip.flocking.params; see core/model)
// ---------------------------------------------------------------------------

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
  const from = [exit.lng, exit.lat] as [number, number];
  const to = [reference.lng, reference.lat] as [number, number];
  const dMi = turf.distance(from, to, { units: 'miles' });
  const bearingCardinal = normalizeBearing(turf.bearing(from, to));

  // c = exit → reference in math coordinates (x east, y north), miles
  const phi = cardinalToDeg(bearingCardinal) * DEG_TO_RAD;
  const cx = dMi * Math.cos(phi);
  const cy = dMi * Math.sin(phi);

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
