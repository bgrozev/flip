import * as turf from '@turf/turf';
import { FlightPath, FlightPoint, ManoeuvreParams } from '../types';

/**
 * Shortest rollout (ft) kept between the end of the turn and the landing
 * point. The final approach direction is derived downstream from the bearing
 * between the last two points (`setFinalHeading`), so that segment must
 * exist and must point along the final heading — a zero or negative rollout
 * would leave the heading undefined or reversed, which is exactly how the
 * old model managed to spin an entire manoeuvre by 180 degrees.
 */
const MIN_ROLLOUT_FT = 1;

/** Arc sampling step (degrees of turn per point). */
const ARC_STEP_DEG = 5;

/** Straight stub flown on the entry heading before the arc begins (ft). */
const ENTRY_STUB_FT = 1;

/** Below this the turn is treated as straight rather than an arc. */
const MIN_RADIUS_FT = 0.5;

interface Vec {
  /** Feet east of the local origin. */
  x: number;
  /** Feet north of the local origin. */
  y: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Unit vector for a compass bearing (0 = north, 90 = east). */
function dir(bearingDeg: number): Vec {
  return { x: Math.sin(rad(bearingDeg)), y: Math.cos(rad(bearingDeg)) };
}

/**
 * The turn's solved geometry, in a local frame whose final heading points
 * north. Exported because both the panel and the map hint want to say what
 * the numbers actually produce.
 */
export interface ManoeuvreGeometry {
  /**
   * Turn radius (ft). For a 90/270/450 this equals the offset exactly; for
   * other rotations it is the radius that both starts at the offset and
   * arrives on the final line.
   */
  radiusFt: number;
  /** Straight rollout from the end of the turn to the landing point (ft). */
  rolloutFt: number;
  /**
   * Heading at initiation, relative to the final heading (deg, signed,
   * positive = to the right of final). A right 270 entered at final-270.
   */
  entryHeadingRelDeg: number;
  /**
   * The depth actually flown (ft). Equals the requested depth unless it was
   * too short to leave a rollout, in which case the turn is backed up.
   */
  depthFt: number;
  /** +1 for a right (clockwise) turn, -1 for a left one. */
  sign: number;
}

/**
 * Solve the turn: entry heading, radius and rollout from the parameters.
 *
 * Working frame: the landing point is the origin, the final heading points
 * north, +x is to the right of it. The initiation point sits `depth` behind
 * and `offset` to the side the turn happens on; the turn is a circular arc
 * of `rotation` degrees that ends pointing north, followed by a straight
 * rollout to the origin. Two unknowns (radius, rollout), two equations (the
 * arc has to end on the final line, and the rollout has to reach the
 * landing point) — so it solves in closed form.
 */
export function solveManoeuvre(params: ManoeuvreParams): ManoeuvreGeometry {
  const sign = params.turnDirection === 'right' ? 1 : -1;
  const rotation = params.rotationDeg;
  // Right turns increase heading, so entry = final - rotation; left is the
  // mirror. Final is north (0) in this frame.
  const entryHeadingRelDeg = -sign * rotation;
  // Bearing from the initiation point to the centre of the turn: 90 degrees
  // to the side you turn towards.
  const phi = entryHeadingRelDeg + 90 * sign;
  const denom = sign - Math.sin(rad(phi));
  const radiusFt =
    Math.abs(denom) < 1e-9 ? 0 : (sign * params.offsetFt) / denom;

  // The arc alone carries you this far back from the landing point; anything
  // beyond it is rollout. Backing the turn up keeps a usable final segment
  // when the requested depth is too short (or negative) to leave one.
  const arcDepthFt = radiusFt * Math.cos(rad(phi));
  const depthFt = Math.max(params.depthFt, arcDepthFt + MIN_ROLLOUT_FT);

  return {
    radiusFt,
    rolloutFt: depthFt - arcDepthFt,
    entryHeadingRelDeg,
    depthFt,
    sign
  };
}

/**
 * The turn's ground track, in flight order (initiation first), as local
 * feet-east/feet-north offsets from the landing point at the origin.
 */
function manoeuvreTrack(params: ManoeuvreParams): Vec[] {
  const { radiusFt, rolloutFt, entryHeadingRelDeg, depthFt, sign } =
    solveManoeuvre(params);
  const entry: Vec = { x: sign * params.offsetFt, y: -depthFt };

  if (!Number.isFinite(radiusFt) || Math.abs(radiusFt) < MIN_RADIUS_FT) {
    // Degenerate (a full 360, or an offset of nothing): fly the entry
    // heading straight in. The final segment below still fixes the heading.
    return [entry, { x: 0, y: -rolloutFt }, { x: 0, y: 0 }];
  }

  const phi = entryHeadingRelDeg + 90 * sign;
  const centre: Vec = {
    x: entry.x + radiusFt * dir(phi).x,
    y: entry.y + radiusFt * dir(phi).y
  };
  const steps = Math.max(2, Math.ceil(params.rotationDeg / ARC_STEP_DEG));
  const arc: Vec[] = [];

  for (let i = 0; i <= steps; i++) {
    // Heading sweeps from the entry heading round to the final heading; the
    // point is always one radius from the centre, abeam the current heading.
    // The last sample lands on the final line at (0, -rollout), which is
    // where the rollout starts — so it is not added again below.
    const swept = (params.rotationDeg * i) / steps;
    const abeam = dir(entryHeadingRelDeg + sign * swept + 90 * sign);

    arc.push({
      x: centre.x - radiusFt * abeam.x,
      y: centre.y - radiusFt * abeam.y
    });
  }

  // A stub along the entry tangent, so the initiation heading read back from
  // the first two points is exact rather than a chord's worth off. Chords
  // sit half a sampling step from the tangent, and `reposition` builds the
  // pattern's final leg on that heading, so the error would be visible.
  const entryDir = dir(entryHeadingRelDeg);
  const stubFt = Math.min(ENTRY_STUB_FT, dist(arc[0], arc[1]) / 4);
  const entryTangent: Vec = {
    x: entry.x + stubFt * entryDir.x,
    y: entry.y + stubFt * entryDir.y
  };

  // Straight rollout from the end of the arc to the landing point.
  return [arc[0], entryTangent, ...arc.slice(1), { x: 0, y: 0 }];
}

/** Planar distance between two local points, in feet. */
function dist(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Build a manoeuvre path from its parameters.
 *
 * Returned in the app's path order: index 0 is the landing point (altitude
 * 0) and the last point is the initiation (the highest, earliest point), so
 * time decreases and altitude increases with index. Altitude and time are
 * distributed along the ground track, i.e. at constant ground speed.
 */
export function createManoeuvrePath(params: ManoeuvreParams): FlightPath {
  const track = manoeuvreTrack(params);
  const cumulative: number[] = [0];

  for (let i = 1; i < track.length; i++) {
    cumulative.push(cumulative[i - 1] + dist(track[i - 1], track[i]));
  }

  const total = cumulative[cumulative.length - 1];
  // The local origin is arbitrary — `reposition` re-anchors the whole path
  // on the target — but it must not be a pole or the antimeridian.
  const origin = turf.point([0.1, -0.1]) as FlightPoint;
  const lastIndex = track.length - 1;

  const points = track.map((vec, i) => {
    const fraction = total > 0 ? cumulative[i] / total : i / lastIndex;
    const distanceFt = Math.hypot(vec.x, vec.y);
    const bearing = (Math.atan2(vec.x, vec.y) * 180) / Math.PI;
    const point = (
      distanceFt > 0
        ? turf.transformTranslate(origin, distanceFt, bearing, { units: 'feet' })
        : turf.clone(origin)
    ) as FlightPoint;

    point.properties = {
      time: params.duration * 1000 * fraction,
      alt: params.altitudeFt * (1 - fraction),
      // Only the two ends are points of manoeuvre; the arc between them is
      // sampling, not somewhere the pilot does anything.
      pom: i === 0 || i === lastIndex ? 1 : 0
    };

    return point;
  });

  return points.reverse();
}

/**
 * How far the initiation altitude may be moved from the recorded one, as a
 * fraction of it. A track or sample describes one particular turn; rescaling
 * it far beyond what was flown would not describe that turn any more.
 */
export const MAX_INITIATION_OFFSET_FRACTION = 0.15;

/**
 * Shift a manoeuvre's initiation altitude by `offsetFt`, scaling every point's
 * altitude proportionally (the turn keeps its shape, just entered higher or
 * lower). The offset is clamped to ±15% of the recorded initiation altitude.
 *
 * The initiation point is the last point — these paths run backwards in time
 * from the landing. Returns a new path; the input is not mutated.
 */
export function applyInitiationAltitudeOffset(path: FlightPath, offsetFt: number): FlightPath {
  if (!offsetFt || path.length === 0) {
    return path;
  }

  const originalInitAlt = path[path.length - 1].properties.alt;

  if (originalInitAlt === 0) {
    return path;
  }

  const maxDelta = originalInitAlt * MAX_INITIATION_OFFSET_FRACTION;
  const clampedNewAlt = Math.min(
    Math.max(originalInitAlt + offsetFt, originalInitAlt - maxDelta),
    originalInitAlt + maxDelta
  );
  const scale = clampedNewAlt / originalInitAlt;

  return path.map(p => ({
    ...p,
    geometry: { ...p.geometry },
    properties: { ...p.properties, alt: p.properties.alt * scale }
  }));
}
