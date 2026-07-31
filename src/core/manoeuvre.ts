import * as turf from '@turf/turf';
import { FlightPath, FlightPoint, LatLng, ManoeuvreParams, Target } from '../types';
import { cumulativeTurnDeg } from './pathStats';
import { normalizeBearing } from './geometry';
import { LIMITS, NumericLimits, clampNumber } from './validation';

/**
 * The drawn turn is an ILLUSTRATION, not a flight model.
 *
 * The numbers a pilot enters fix two things exactly: where the turn starts
 * (depth and offset, against the final approach axis) and how far round it
 * goes. They do not describe the shape in between — a real canopy turn is
 * not a circle, and its radius is a property of the canopy and the pilot,
 * not of where they chose to set up. So the curve here is drawn at a
 * NOMINAL radius and the slack is taken up by straight legs: a long depth
 * stretches the final approach, a negative offset stretches the entry, and
 * a turn that has to reach round further grows a straight leg partway.
 *
 * That is the whole reason the radius is no longer tied to the offset. It
 * used to be (offset WAS the radius for a 90/270/450), which meant a wider
 * setup silently redrew the turn as a wider one.
 */
const NOMINAL_RADIUS_FT = 150;

/**
 * Beyond three quarters, a constant radius makes the curve cross itself.
 * Shrinking it as the turn progresses closes it into a spiral instead, so
 * a 450 reads as a 450 rather than as a knot. Ramped in from 270 so there
 * is no visible step as the rotation is dialled up.
 */
const SPIRAL_FROM_DEG = 270;
const SPIRAL_RAMP_DEG = 180;
const SPIRAL_MAX_SHRINK = 0.5;

/**
 * Shortest rollout (ft) kept between the end of the turn and the landing
 * point. The final approach direction is derived downstream from the
 * bearing between the last two points (`setFinalHeading`), so that segment
 * must exist and must point along the final heading — a zero or negative
 * rollout would leave the heading undefined or reversed, which is exactly
 * how the old model managed to spin an entire manoeuvre by 180 degrees.
 *
 * Only a token length: the finished track's end segments are laid back onto
 * the exact headings after resampling, so this no longer has to outrun the
 * sample spacing. It used to be 40 ft, which put a floor under how shallow
 * a quarter turn could be set up — an implementation detail leaking into
 * the numbers a pilot is allowed to type.
 */
const MIN_ROLLOUT_FT = 2;

/**
 * Straight flown on the entry heading before the turn begins (ft). As with
 * the rollout, a token length — the end segments are laid back onto the
 * exact headings after resampling.
 */
const ENTRY_STUB_FT = 2;

/** Arc sampling step (degrees of turn per point). */
const ARC_STEP_DEG = 5;

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

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (v: Vec, k: number): Vec => ({ x: v.x * k, y: v.y * k });

/** Radius at a given point in the sweep, shrinking for big rotations. */
function radiusAt(sweptDeg: number, rotationDeg: number, baseFt: number): number {
  const ramp = Math.min(
    Math.max((rotationDeg - SPIRAL_FROM_DEG) / SPIRAL_RAMP_DEG, 0),
    1
  );
  const shrink = ramp * SPIRAL_MAX_SHRINK;

  return baseFt * (1 - (shrink * sweptDeg) / rotationDeg);
}

/**
 * Where the curve may grow a straight leg: at the start (on the entry
 * heading), wherever the heading passes a right angle to the final one, and
 * at the end (on the final heading).
 *
 * The right-angle joints are what let any setup be drawn. Their directions
 * are the four axes of the final-approach frame, so between them they can
 * absorb a displacement in any direction — the owner's "a 270 with negative
 * depth is a 90, then a long straight, then a 180".
 */
interface Joint {
  /** Index into the arc's own point list. */
  index: number;
  /** Heading flown there, relative to the final heading. */
  headingDeg: number;
}

interface ArcShape {
  /** Points relative to the start of the arc, in flight order. */
  points: Vec[];
  joints: Joint[];
  /** Net displacement from the first arc point to the last. */
  displacement: Vec;
}

/**
 * The curved part, as local offsets from wherever it starts. Sampled rather
 * than solved: the radius varies along a spiral, so there is no closed form
 * worth having, and each step is an exact constant-radius arc anyway.
 */
function buildArc(
  rotationDeg: number,
  sign: number,
  entryHeadingDeg: number,
  baseRadiusFt: number
): ArcShape {
  // Sweeps to stop at: the regular sampling, plus every right-angle joint,
  // so joints are exact points rather than something near one.
  const sweeps = new Set<number>([0, rotationDeg]);

  for (let s = ARC_STEP_DEG; s < rotationDeg; s += ARC_STEP_DEG) {
    sweeps.add(s);
  }
  // Heading is a right angle to final at sweeps rotation - 90k.
  for (let s = rotationDeg - 90; s > 0; s -= 90) {
    sweeps.add(s);
  }

  const ordered = [...sweeps].sort((a, b) => a - b);
  const points: Vec[] = [{ x: 0, y: 0 }];
  const joints: Joint[] = [];
  let position: Vec = { x: 0, y: 0 };

  for (let i = 1; i < ordered.length; i++) {
    const from = ordered[i - 1];
    const to = ordered[i];
    const radius = radiusAt((from + to) / 2, rotationDeg, baseRadiusFt);
    const headingFrom = entryHeadingDeg + sign * from;
    const headingTo = entryHeadingDeg + sign * to;
    // Exact circular step: the chord between two points one radius from the
    // same centre, which is where the turn's centre sits at this radius.
    const step = scale(
      sub(dir(headingFrom + 90 * sign), dir(headingTo + 90 * sign)),
      radius
    );

    position = add(position, step);
    points.push(position);

    const sweptToRightAngle = (rotationDeg - to) % 90 === 0 && to < rotationDeg;

    if (sweptToRightAngle) {
      joints.push({ index: points.length - 1, headingDeg: headingTo });
    }
  }

  return { points, joints, displacement: position };
}

/**
 * Two straight directions must be at least this far apart to be solved
 * against each other.
 *
 * Nearly-parallel pairs are the sharp edge here. As the rotation approaches
 * a half turn the entry heading becomes the reverse of the final one, and
 * the solution for that pair runs away to infinity: at 180.5 degrees it
 * asked for thirty miles of straight, and closer in it left the globe
 * entirely and took the map renderer with it. A pair that shallow describes
 * no turn worth drawing anyway.
 */
const MIN_PAIR_ANGLE_DEG = 5;

/**
 * Longest total straight worth drawing (ft). Depth and offset are each
 * capped at 3000, so a real setup needs a fraction of this; anything beyond
 * it is the arithmetic running away rather than a turn.
 */
const MAX_STRAIGHT_FT = 12000;

/**
 * Choose which straights take up the slack.
 *
 * Two of them are enough to reach anywhere (any two directions that are not
 * parallel span the plane), so this solves each candidate pair and keeps
 * the best valid one.
 *
 * "Best" is the LATEST pair — the one whose straights sit nearest the end
 * of the turn — rather than the shortest. Slack belongs on the final
 * approach, not partway round: a 450 with a lot of depth should read as a
 * 450 followed by a long final, not as a quarter turn, a long straight and
 * then the rest of the rotation. Length only breaks ties.
 */
function solveStraights(residual: Vec, directions: Vec[]): { lengths: number[]; reaches: boolean } {
  const lengths = directions.map(() => 0);
  const minDet = Math.sin(rad(MIN_PAIR_ANGLE_DEG));
  let best: { lengths: number[]; i: number; j: number; total: number } | null = null;

  for (let i = 0; i < directions.length; i++) {
    for (let j = i + 1; j < directions.length; j++) {
      const u = directions[i];
      const v = directions[j];
      const det = u.x * v.y - u.y * v.x;

      if (Math.abs(det) < minDet) {
        continue;
      }

      const lu = (residual.x * v.y - residual.y * v.x) / det;
      const lv = (u.x * residual.y - u.y * residual.x) / det;

      if (lu < 0 || lv < 0) {
        continue;
      }

      const total = lu + lv;

      if (total > MAX_STRAIGHT_FT) {
        continue;
      }

      // Later beats shorter; among equals, shorter wins.
      const beatsBest =
        !best ||
        j > best.j ||
        (j === best.j && i > best.i) ||
        (j === best.j && i === best.i && total < best.total);

      if (beatsBest) {
        const candidate = directions.map(() => 0);

        candidate[i] = lu;
        candidate[j] = lv;
        best = { lengths: candidate, i, j, total };
      }
    }
  }

  return best ? { lengths: best.lengths, reaches: true } : { lengths, reaches: false };
}

/** The illustrated turn's geometry, in the final heading's frame. */
export interface ManoeuvreGeometry {
  /**
   * Heading at initiation, relative to the final heading (deg, signed,
   * positive = to the right of final). A right 270 enters at final - 270.
   */
  entryHeadingRelDeg: number;
  /** Nominal radius the curve is drawn at (ft). */
  radiusFt: number;
  /** Straight flown before the turn begins (ft). */
  entryStraightFt: number;
  /** Straight flown from the end of the turn to the landing point (ft). */
  rolloutFt: number;
  /** Straight legs inserted partway round the turn (ft), if any. */
  midStraightsFt: number[];
  /**
   * Whether the drawn turn reaches the initiation point the numbers ask
   * for. A 90 cannot start past the target, however the legs are stretched.
   */
  reaches: boolean;
  /** +1 for a right (clockwise) turn, -1 for a left one. */
  sign: number;
}

/** Solve the straights for one candidate radius. */
function solveAtRadius(params: ManoeuvreParams, radiusFt: number): ManoeuvreGeometry {
  const sign = params.turnDirection === 'right' ? 1 : -1;
  // Right turns increase heading on the way round, so they start to the
  // left of final by the rotation; left turns are the mirror. Final is
  // north (0) in this frame.
  const entryHeadingRelDeg = -sign * params.rotationDeg;
  const arc = buildArc(params.rotationDeg, sign, entryHeadingRelDeg, radiusFt);
  const entryDir = dir(entryHeadingRelDeg);
  const finalDir = dir(0);

  // The initiation point sits `depth` back and `offset` to the side the
  // turn happens on, so the curve has to cover exactly this.
  const required: Vec = { x: -sign * params.offsetFt, y: params.depthFt };
  // What is left once the curve itself and the two fixed stubs are spent.
  const residual = sub(
    sub(
      sub(required, arc.displacement),
      scale(entryDir, ENTRY_STUB_FT)
    ),
    scale(finalDir, MIN_ROLLOUT_FT)
  );

  const directions = [entryDir, ...arc.joints.map(j => dir(j.headingDeg)), finalDir];
  const { lengths, reaches } = solveStraights(residual, directions);

  return {
    entryHeadingRelDeg,
    radiusFt,
    entryStraightFt: ENTRY_STUB_FT + lengths[0],
    rolloutFt: MIN_ROLLOUT_FT + lengths[lengths.length - 1],
    midStraightsFt: lengths.slice(1, -1),
    reaches,
    sign
  };
}

/** Bisection steps used to find the largest radius that still fits. */
const RADIUS_FIT_STEPS = 20;

/**
 * Solve the illustrated turn: which way it goes, how wide it is drawn, and
 * how long each straight leg has to be for it to start where the numbers
 * say it starts.
 *
 * The radius is the nominal one unless the setup is tighter than that — a
 * quarter turn entered 150 ft to the side cannot be drawn 200 ft wide — in
 * which case it is the widest turn that still fits. Tightening is the only
 * thing that couples the drawn shape to the numbers, and only when the
 * alternative is drawing nothing.
 */
export function solveManoeuvre(params: ManoeuvreParams): ManoeuvreGeometry {
  const nominal = solveAtRadius(params, NOMINAL_RADIUS_FT);

  if (nominal.reaches) {
    return nominal;
  }

  // Bisect for the widest radius that fits. Below the floor there is no
  // turn to draw at all, so the nominal is returned with `reaches` false
  // and the caller can say so.
  let low = 0;
  let high = NOMINAL_RADIUS_FT;
  let best: ManoeuvreGeometry | null = null;

  for (let i = 0; i < RADIUS_FIT_STEPS; i++) {
    const mid = (low + high) / 2;
    const candidate = solveAtRadius(params, mid);

    if (candidate.reaches) {
      best = candidate;
      low = mid;
    } else {
      high = mid;
    }
  }

  return best ?? nominal;
}

/** Samples taken when hunting for a feasible value to start bisecting from. */
const BOUND_SCAN_STEPS = 48;
/** Bisection steps used to pin each bound. */
const BOUND_BISECT_STEPS = 14;

/**
 * The sub-range of `limits` around `seed` for which `works` holds.
 *
 * Used to bound the depth and offset fields to what can actually be drawn.
 * Feasibility is a geometric fact — a quarter turn cannot start past the
 * target — and a field that accepts a number the map then ignores is worse
 * than one that stops at the edge.
 */
function feasibleRange(
  works: (value: number) => boolean,
  limits: NumericLimits,
  seed: number
): NumericLimits {
  let anchor: number | null = works(seed) ? seed : null;

  if (anchor === null) {
    for (let i = 0; i <= BOUND_SCAN_STEPS; i++) {
      const value = limits.min + ((limits.max - limits.min) * i) / BOUND_SCAN_STEPS;

      if (works(value)) {
        anchor = value;
        break;
      }
    }
  }

  if (anchor === null) {
    // Nothing in range works: leave the field unbounded rather than lock
    // the user out of the value that would let them fix it.
    return limits;
  }

  const edge = (towards: number): number => {
    let good = anchor as number;
    let bad = towards;

    if (works(bad)) {
      return bad;
    }
    for (let i = 0; i < BOUND_BISECT_STEPS; i++) {
      const mid = (good + bad) / 2;

      if (works(mid)) {
        good = mid;
      } else {
        bad = mid;
      }
    }

    return good;
  };

  return { min: Math.ceil(edge(limits.min)), max: Math.floor(edge(limits.max)) };
}

/** What the depth and offset can actually be, given the rest of the turn. */
export interface ManoeuvreBounds {
  depthFt: NumericLimits;
  offsetFt: NumericLimits;
}

/**
 * The depth and offset a turn of this rotation can actually be drawn with.
 *
 * Each is measured with the other held where it is, so the pair moves as
 * the user works — which is the honest answer to "how deep can I be": it
 * depends on how far to the side you are, and on how far round you turn.
 */
export function manoeuvreBounds(params: ManoeuvreParams): ManoeuvreBounds {
  return {
    depthFt: feasibleRange(
      depthFt => solveManoeuvre({ ...params, depthFt }).reaches,
      LIMITS.manoeuvreDepthFt,
      params.depthFt
    ),
    offsetFt: feasibleRange(
      offsetFt => solveManoeuvre({ ...params, offsetFt }).reaches,
      LIMITS.manoeuvreOffsetFt,
      params.offsetFt
    )
  };
}

/**
 * The turn's ground track, in flight order (initiation first), as local
 * feet-east/feet-north offsets. The landing point ends up at the origin
 * whenever the turn reaches (see `solveManoeuvre`).
 */
function manoeuvreTrack(params: ManoeuvreParams): Vec[] {
  const geometry = solveManoeuvre(params);
  const sign = geometry.sign;
  const entryHeadingRelDeg = geometry.entryHeadingRelDeg;
  // Rebuilt at the radius the solve settled on, so the track and the
  // straight lengths describe the same turn.
  const arc = buildArc(params.rotationDeg, sign, entryHeadingRelDeg, geometry.radiusFt);
  const jointAt = new Map(arc.joints.map((joint, i) => [joint.index, i]));

  let cursor: Vec = { x: sign * params.offsetFt, y: -params.depthFt };
  const track: Vec[] = [cursor];

  cursor = add(cursor, scale(dir(entryHeadingRelDeg), geometry.entryStraightFt));
  track.push(cursor);

  for (let i = 1; i < arc.points.length; i++) {
    cursor = add(cursor, sub(arc.points[i], arc.points[i - 1]));
    track.push(cursor);

    const joint = jointAt.get(i);

    if (joint !== undefined && geometry.midStraightsFt[joint] > 0) {
      cursor = add(cursor, scale(dir(arc.joints[joint].headingDeg), geometry.midStraightsFt[joint]));
      track.push(cursor);
    }
  }

  cursor = add(cursor, scale(dir(0), geometry.rolloutFt));
  track.push(cursor);

  return track;
}

/** Planar distance between two local points, in feet. */
function dist(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * How many points the finished turn is sampled at.
 *
 * They are spaced evenly in TIME rather than following the corners of the
 * construction, which is what makes the wind drift over the turn identical
 * whatever its shape (see `createManoeuvrePath`). High enough that the
 * straight/curve joins are not visibly cut: the longest turn a pilot can
 * describe is a few thousand feet, so the spacing stays inside a few feet.
 */
const TRACK_SAMPLES = 240;

/**
 * Resample a track at evenly spaced distances, keeping both ends exactly.
 * Ground speed is constant, so even in distance is even in time.
 */
function resample(track: Vec[], samples: number): Vec[] {
  const cumulative: number[] = [0];

  for (let i = 1; i < track.length; i++) {
    cumulative.push(cumulative[i - 1] + dist(track[i - 1], track[i]));
  }

  const total = cumulative[cumulative.length - 1];

  if (total <= 0) {
    return track;
  }

  const out: Vec[] = [];
  let segment = 1;

  for (let i = 0; i <= samples; i++) {
    const wanted = (total * i) / samples;

    while (segment < track.length - 1 && cumulative[segment] < wanted) {
      segment++;
    }

    const spanFt = cumulative[segment] - cumulative[segment - 1];
    const t = spanFt > 0 ? (wanted - cumulative[segment - 1]) / spanFt : 0;

    out.push({
      x: track[segment - 1].x + (track[segment].x - track[segment - 1].x) * t,
      y: track[segment - 1].y + (track[segment].y - track[segment - 1].y) * t
    });
  }

  return out;
}

/**
 * Build a manoeuvre path from its parameters.
 *
 * Returned in the app's path order: index 0 is the landing point (altitude
 * 0) and the last point is the initiation (the highest, earliest point), so
 * time decreases and altitude increases with index.
 *
 * Altitude and time are both spread along the GROUND TRACK, which makes
 * altitude a linear function of time whatever shape the turn is. That is
 * what keeps the wind drift over the turn independent of depth and offset:
 * drift is the wind integrated over time, and the altitude-versus-time
 * profile does not depend on how far the illustration wanders.
 */
export function createManoeuvrePath(params: ManoeuvreParams): FlightPath {
  // Evenly spaced in time, so every shape of turn is sampled at the same
  // altitudes at the same moments. `addWind` sums the wind over the
  // segments it is given, so this is what makes the drift over the turn a
  // property of the altitude and the duration alone.
  const track = resample(manoeuvreTrack(params), TRACK_SAMPLES);
  const geometry = solveManoeuvre(params);

  // Lay the two end segments back onto the exact entry and final headings.
  // `reposition` reads them as the headings to build the pattern's final leg
  // on and to align the whole path with the target, so they have to be
  // exact — and resampling otherwise cuts the corner off a short stub.
  // Position-only: altitude and time come from the point's index, so this
  // cannot disturb the drift invariant below.
  if (track.length > 3) {
    const last = track.length - 1;

    track[1] = add(track[0], scale(dir(geometry.entryHeadingRelDeg), dist(track[0], track[1])));
    track[last - 1] = sub(track[last], scale(dir(0), dist(track[last - 1], track[last])));
  }
  // The local origin is arbitrary — `reposition` re-anchors the whole path
  // on the target — but it must not be a pole or the antimeridian.
  const origin = turf.point([0.1, -0.1]) as FlightPoint;
  const lastIndex = track.length - 1;

  const points = track.map((vec, i) => {
    const fraction = i / lastIndex;
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
      // Only the two ends are points of manoeuvre; everything between them
      // is sampling, not somewhere the pilot does anything.
      pom: i === 0 || i === lastIndex ? 1 : 0
    };

    return point;
  });

  return points.reverse();
}

/** What a manoeuvre looks like on the ground, measured from its path. */
export interface ManoeuvreDescription {
  /** Where the turn starts. */
  initiation: LatLng;
  /** Where it ends — the landing point. */
  landing: LatLng;
  /** Heading flown at initiation. */
  entryHeadingDeg: number;
  /** Heading flown on final approach. */
  finalHeadingDeg: number;
  /** Total rotation flown, signed: positive is a right (clockwise) turn. */
  rotationDeg: number;
  /** Straight-line distance from initiation to landing (ft). */
  spanFt: number;
  /** Bearing from the landing point out to the initiation point. */
  spanBearingDeg: number;
}

/**
 * Describe a manoeuvre from its path rather than its parameters, so a
 * recorded track or a sample can be described the same way a parametric
 * turn is — the map hint has no business knowing which kind it is.
 *
 * Points are ordered by time, so this does not care whether the caller
 * hands over the app's landing-first order or flight order.
 */
export function describeManoeuvrePath(path: FlightPath): ManoeuvreDescription | null {
  if (path.length < 2) {
    return null;
  }

  const flown = [...path].sort((a, b) => a.properties.time - b.properties.time);
  const last = flown.length - 1;
  const at = (point: FlightPoint): LatLng => ({
    lng: point.geometry.coordinates[0],
    lat: point.geometry.coordinates[1]
  });
  const turns = cumulativeTurnDeg(
    flown.map(point => ({ lat: at(point).lat, lng: at(point).lng }))
  );

  return {
    initiation: at(flown[0]),
    landing: at(flown[last]),
    entryHeadingDeg: normalizeBearing(turf.bearing(flown[0], flown[1])),
    finalHeadingDeg: normalizeBearing(turf.bearing(flown[last - 1], flown[last])),
    rotationDeg: turns[last],
    spanFt: turf.distance(flown[0], flown[last], { units: 'feet' }),
    spanBearingDeg: normalizeBearing(turf.bearing(flown[last], flown[0]))
  };
}

/**
 * Resolve a dragged initiation point into the numbers that describe it.
 *
 * The inverse of what `solveManoeuvre` consumes: the point is projected
 * onto the final-approach axis to give the depth (how far back) and the
 * offset (how far to the side, on the side the turn happens). The result is
 * clamped to what can actually be drawn, so a drag can never leave the
 * fields holding a setup the map has to disagree with — the same rule the
 * number fields enforce, applied to the other way of entering it.
 *
 * `point` must be the wind-free position: the caller drags a handle sitting
 * on the drifted path and has to take the drift out first.
 */
export function placeInitiation(
  point: LatLng,
  target: Target,
  params: ManoeuvreParams
): { depthFt: number; offsetFt: number } {
  const sign = params.turnDirection === 'right' ? 1 : -1;
  const from = turf.point([target.target.lng, target.target.lat]);
  const to = turf.point([point.lng, point.lat]);
  const distanceFt = turf.distance(from, to, { units: 'feet' });
  const relative = rad(turf.bearing(from, to) - target.finalHeading);
  // Along the final heading, positive ahead of the target; the initiation
  // is behind it, so depth is the negative of that.
  const depthFt = -distanceFt * Math.cos(relative);
  // Across it, positive to the right of the final heading; the offset is
  // measured on the side the turn happens.
  const offsetFt = sign * distanceFt * Math.sin(relative);

  // One axis at a time, each starting from a setup already known to work:
  // the offset against the turn as it stands, then the depth against the
  // offset just settled. Clamping both against the dragged point instead
  // leaves a drag that is out of bounds in BOTH still out of bounds, since
  // neither axis alone has a feasible range to be clamped into.
  const offsetBounds = manoeuvreBounds({ ...params, offsetFt });
  const settledOffset = clampNumber(offsetFt, offsetBounds.offsetFt.min, offsetBounds.offsetFt.max);
  const depthBounds = manoeuvreBounds({ ...params, offsetFt: settledOffset, depthFt });

  return {
    depthFt: clampNumber(depthFt, depthBounds.depthFt.min, depthBounds.depthFt.max),
    offsetFt: settledOffset
  };
}

/**
 * Describe a manoeuvre for display, given both the path as drawn
 * (wind-corrected) and the same path without wind.
 *
 * The split matters. Positions have to come from the drawn path, or the
 * hint floats off the line it is annotating. But BEARINGS along a
 * wind-corrected path are ground tracks, not headings: a canopy crabs, so
 * the final segment of a drifted path does not point down the final
 * approach. Taking the headings from the drifted path made the drawn
 * approach axis rotate as soon as wind was loaded, which is exactly the
 * thing the axis exists to deny — the final heading is a property of the
 * target, and the entry heading of the turn.
 */
export function describeManoeuvreForDisplay(
  drawn: FlightPath,
  ideal: FlightPath
): ManoeuvreDescription | null {
  const drawnDescription = describeManoeuvrePath(drawn);

  if (!drawnDescription) {
    return null;
  }

  const idealDescription = describeManoeuvrePath(ideal);

  if (!idealDescription) {
    return drawnDescription;
  }

  return {
    ...drawnDescription,
    entryHeadingDeg: idealDescription.entryHeadingDeg,
    finalHeadingDeg: idealDescription.finalHeadingDeg,
    rotationDeg: idealDescription.rotationDeg
  };
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
