import * as turf from '@turf/turf';

import { Course, CourseElement, CourseParams, LatLng } from '../types';

function dest(lat: number, lng: number, distanceM: number, bearing: number): LatLng {
  const pt = turf.destination([lng, lat], distanceM, bearing, { units: 'meters' });
  return { lat: pt.geometry.coordinates[1], lng: pt.geometry.coordinates[0] };
}

/**
 * Build a Distance Course from a center point and direction.
 *
 * Structure:
 * - Entry gate: white + orange buoys centered at p, 10m apart, perpendicular to d
 * - Exit gate: same layout, 50m in direction d from entry
 * - Two yellow lines: from each exit gate buoy to 200m from entry (150m long)
 * - Distance markers: small white dots on both lines at 100m, 150m, 200m from entry,
 *   with distance labels on the orange side
 */
export function makeDistanceCourse(
  id: string,
  name: string,
  lat: number,
  lng: number,
  direction: number
): Course {
  const perpLeft = (direction - 90 + 360) % 360;
  const perpRight = (direction + 90) % 360;

  // Entry gate buoys (5m left/right of center p)
  const entryWhite = dest(lat, lng, 5, perpLeft);
  const entryOrange = dest(lat, lng, 5, perpRight);

  // Exit gate (50m in direction d from entry)
  const exitCenter = dest(lat, lng, 50, direction);
  const exitWhite = dest(exitCenter.lat, exitCenter.lng, 5, perpLeft);
  const exitOrange = dest(exitCenter.lat, exitCenter.lng, 5, perpRight);

  // Line endpoints: 200m from entry (= 150m from exit gate) along each buoy axis
  const lineWhiteEnd = dest(entryWhite.lat, entryWhite.lng, 200, direction);
  const lineOrangeEnd = dest(entryOrange.lat, entryOrange.lng, 200, direction);

  const MARKER_DISTANCES = [100, 150, 200];

  const elements: CourseElement[] = [
    // Entry gate
    { type: 'buoy', lat: entryWhite.lat, lng: entryWhite.lng, color: 'white' },
    { type: 'buoy', lat: entryOrange.lat, lng: entryOrange.lng, color: 'orange' },
    // Exit gate
    { type: 'buoy', lat: exitWhite.lat, lng: exitWhite.lng, color: 'white' },
    { type: 'buoy', lat: exitOrange.lat, lng: exitOrange.lng, color: 'orange' },
    // Yellow course lines: from exit gate to 200m-from-entry
    { type: 'line', from: exitWhite, to: lineWhiteEnd, color: 'yellow' },
    { type: 'line', from: exitOrange, to: lineOrangeEnd, color: 'yellow' },
    // Distance markers: small white dots at 100m, 150m, 200m from entry
    // Labels on the orange (right) side only
    ...MARKER_DISTANCES.flatMap(d => {
      const wPt = dest(entryWhite.lat, entryWhite.lng, d, direction);
      const oPt = dest(entryOrange.lat, entryOrange.lng, d, direction);
      return [
        { type: 'marker' as const, lat: wPt.lat, lng: wPt.lng, color: 'white' },
        { type: 'marker' as const, lat: oPt.lat, lng: oPt.lng, color: 'white', label: `${d}m` }
      ];
    })
  ];

  return { id, name, elements, center: { lat, lng }, direction };
}

/**
 * Return the depth and offset of a point relative to a course, plus its
 * absolute bearing from the course center.
 *
 * depth:   metres along the (direction+180) axis — positive = away from course
 * offset:  metres along the (direction+90) axis  — positive = right of course direction
 * bearing: absolute compass bearing from center to point (0–360)
 */
export function getTargetRelativeToCourse(
  point: LatLng,
  center: LatLng,
  courseDir: number
): { depth: number; offset: number; bearing: number } {
  const dist = turf.distance(
    [center.lng, center.lat],
    [point.lng, point.lat],
    { units: 'meters' }
  );

  if (dist < 1e-6) {
    return { depth: 0, offset: 0, bearing: (courseDir + 180) % 360 };
  }

  const bearing = turf.bearing([center.lng, center.lat], [point.lng, point.lat]);
  const dAway = (courseDir + 180) % 360;

  let angle = bearing - dAway;
  while (angle >  180) angle -= 360;
  while (angle < -180) angle += 360;

  const rad = angle * Math.PI / 180;
  return {
    depth: dist * Math.cos(rad),
    offset: dist * Math.sin(rad),
    bearing: (bearing + 360) % 360
  };
}

/**
 * Convert depth + offset (in course-relative coordinates) back to a LatLng.
 */
export function fromCourseRelative(
  depth: number,
  offset: number,
  center: LatLng,
  courseDir: number
): LatLng {
  const dist = Math.sqrt(depth * depth + offset * offset);
  if (dist < 1e-6) return center;

  const dAway = (courseDir + 180) % 360;
  const rotDeg = Math.atan2(offset, depth) * 180 / Math.PI;
  const bearing = ((dAway + rotDeg) + 360) % 360;

  const pt = turf.destination([center.lng, center.lat], dist, bearing, { units: 'meters' });
  return { lat: pt.geometry.coordinates[1], lng: pt.geometry.coordinates[0] };
}

/**
 * Build a Zone Accuracy (ZA) course from a center point and direction.
 *
 * Structure (all dimensions along/perpendicular to direction d):
 *   Width: 10m (5m each side). Left = orange buoys, right = white buoys.
 *
 *   Water gates G1–G4 at 0m, 12m, 24m, 36m from p.
 *   Each gate: orange buoy at –5m lateral, white buoy at +5m lateral.
 *   Score labels (21 / 5 / 8 / 16) in the centre of each gate's channel section.
 *
 *   Landing zones start at 36m + z1Offset from p:
 *     Z1  6m  →  3 pts
 *     Z2  6m  → 11 pts
 *     Z3  5m  → 19 pts
 *     Z4  4m  → 27 pts
 *     Z5  3m  → 34 pts
 *     Z6  2m  → 41 pts
 *     Centre zone (2m): transversely divided 3.5m/1m/1m/1m/3.5m → 46/48/50/48/46 pts
 *     Z9  2m  → 25 pts
 *     Z10 4m  →  5 pts
 */
export function makeZACourse(
  id: string,
  name: string,
  lat: number,
  lng: number,
  direction: number
): Course {
  const z1Offset = 8;
  const perpLeft  = (direction - 90 + 360) % 360;
  const perpRight = (direction + 90) % 360;
  const HALF_WIDTH = 5;

  /** Point at `ld` metres along course direction, then `lo` metres laterally.
   *  lo > 0 → right (white) side, lo < 0 → left (orange) side. */
  function cp(ld: number, lo: number): LatLng {
    const c = dest(lat, lng, ld, direction);
    if (lo === 0) return c;
    return dest(c.lat, c.lng, Math.abs(lo), lo > 0 ? perpRight : perpLeft);
  }

  const GATE_DISTS  = [0, 12, 24, 36];
  const GATE_SCORES = [21, 5, 8, 16];
  const GATE_LABELS = ['G1', 'G2', 'G3', 'G4'];

  const Z1_START = 36 + z1Offset;
  const LANDING_ZONES = [
    { width: 6, score: 3,    zoneLabel: 'Z1' },
    { width: 6, score: 11,   zoneLabel: 'Z2' },
    { width: 5, score: 19,   zoneLabel: 'Z3' },
    { width: 4, score: 27,   zoneLabel: 'Z4' },
    { width: 3, score: 34,   zoneLabel: 'Z5' },
    { width: 2, score: 41,   zoneLabel: 'Z6' },
    { width: 2, score: 50, zoneLabel: 'Z7', isCenter: true },
    { width: 2, score: 25,   zoneLabel: 'Z9' },
    { width: 4, score: 5,    zoneLabel: 'Z10' },
  ];

  const totalLength = Z1_START + LANDING_ZONES.reduce((s, z) => s + z.width, 0);

  const elements: CourseElement[] = [];

  // Full-length side rails
  elements.push({ type: 'line', from: cp(0, -HALF_WIDTH), to: cp(totalLength, -HALF_WIDTH), color: 'orange' });
  elements.push({ type: 'line', from: cp(0,  HALF_WIDTH), to: cp(totalLength,  HALF_WIDTH), color: 'white' });

  // Gates G1–G4: buoys + cross-lines + score labels on the gate line + name labels outside
  for (let i = 0; i < GATE_DISTS.length; i++) {
    const gd = GATE_DISTS[i];
    const lp = cp(gd, -HALF_WIDTH);
    const rp = cp(gd,  HALF_WIDTH);
    elements.push({ type: 'buoy',   lat: lp.lat, lng: lp.lng, color: 'orange' });
    elements.push({ type: 'buoy',   lat: rp.lat, lng: rp.lng, color: 'white'  });
    elements.push({ type: 'line',   from: lp, to: rp,          color: '#55aaff' });

    // Score label on the gate cross-line (centre)
    const scorePos = cp(gd, 0);
    elements.push({ type: 'marker', lat: scorePos.lat, lng: scorePos.lng, color: 'white', label: String(GATE_SCORES[i]) });

    // Gate name label outside the left (orange) rail
    const namePos = cp(gd, -(HALF_WIDTH + 2));
    elements.push({ type: 'marker', lat: namePos.lat, lng: namePos.lng, color: '#aaddff', label: GATE_LABELS[i] });
  }

  // Landing zones
  let zDist = Z1_START;
  for (const zone of LANDING_ZONES) {
    // Zone boundary divider
    elements.push({ type: 'line', from: cp(zDist, -HALF_WIDTH), to: cp(zDist, HALF_WIDTH), color: '#aaaaaa' });

    const zMid = zDist + zone.width / 2;

    // Zone name label outside the left (orange) rail
    const zNamePos = cp(zMid, -(HALF_WIDTH + 2));
    elements.push({ type: 'marker', lat: zNamePos.lat, lng: zNamePos.lng, color: '#aaddff', label: zone.zoneLabel });

    if (zone.isCenter) {
      // Transverse sub-divisions at ±0.5m and ±1.5m from centreline
      for (const lo of [-1.5, -0.5, 0.5, 1.5]) {
        elements.push({ type: 'line', from: cp(zDist, lo), to: cp(zDist + zone.width, lo), color: '#ff4444' });
      }
      // Sub-zone score labels: outer 46 (±3.25m), inner 48 (±1.0m), centre 50
      const subs: Array<{ lo: number; score: number; color: string }> = [
        { lo: -3.25, score: 46, color: 'white' },
        { lo: -1.0,  score: 48, color: 'white' },
        { lo:  0,    score: 50, color: 'red'   },
        { lo:  1.0,  score: 48, color: 'white' },
        { lo:  3.25, score: 46, color: 'white' },
      ];
      for (const sub of subs) {
        const pt = cp(zMid, sub.lo);
        elements.push({ type: 'marker', lat: pt.lat, lng: pt.lng, color: sub.color, label: String(sub.score) });
      }
    } else if (zone.score !== null) {
      const mid = cp(zMid, 0);
      elements.push({ type: 'marker', lat: mid.lat, lng: mid.lng, color: 'white', label: String(zone.score) });
    }

    zDist += zone.width;
  }

  // Final boundary
  elements.push({ type: 'line', from: cp(zDist, -HALF_WIDTH), to: cp(zDist, HALF_WIDTH), color: '#aaaaaa' });

  return { id, name, elements, center: { lat, lng }, direction };
}

/**
 * Build a Speed course from a centre point and direction.
 *
 * Five 10 m-wide gates on a circle of radius 53.48 m centred on the focal point F.
 * F lies perpendicular to d from p: d−90° (left carve) or d+90° (right carve).
 * Gates are spaced 18.75° apart (75° total arc over 4 intervals).
 * Travel direction at gate i rotates by i×18.75°: left carve subtracts, right adds.
 * Inside buoys (side facing F) = orange; outside buoys = white.
 */
export function makeSpeedCourse(
  id: string,
  name: string,
  lat: number,
  lng: number,
  direction: number,
  carveDirection: 'left' | 'right' = 'left'
): Course {
  const RADIUS    = 53.48;
  const NUM_GATES = 5;
  const GATE_ANGLE = 75 / (NUM_GATES - 1); // 18.75°
  const HALF_WIDTH = 5;

  // Focal point: perpendicular to d, on the inside of the carve
  const focalBearing = carveDirection === 'left'
    ? (direction - 90 + 360) % 360
    : (direction + 90) % 360;
  const focal = dest(lat, lng, RADIUS, focalBearing);

  interface GateInfo { center: LatLng; inside: LatLng; outside: LatLng; radiusBearing: number; insideBearing: number }

  const gates: GateInfo[] = [];
  for (let i = 0; i < NUM_GATES; i++) {
    const theta = i * GATE_ANGLE;
    // Travel direction at this gate
    const travelDir = carveDirection === 'left'
      ? (direction - theta + 360) % 360
      : (direction + theta) % 360;

    // Gate centre lies on the circle; the radius from F points toward the outside of the carve
    const radiusBearing = carveDirection === 'left'
      ? (travelDir + 90) % 360          // right of travel = outside for left carve
      : (travelDir - 90 + 360) % 360;   // left of travel  = outside for right carve

    const center = dest(focal.lat, focal.lng, RADIUS, radiusBearing);

    // Inside buoy (toward F) = orange; outside buoy (away from F) = white
    const insideBearing  = (radiusBearing + 180) % 360; // points toward F
    const outsideBearing = radiusBearing;                // points away from F

    gates.push({
      center,
      inside:  dest(center.lat, center.lng, HALF_WIDTH, insideBearing),
      outside: dest(center.lat, center.lng, HALF_WIDTH, outsideBearing),
      radiusBearing,
      insideBearing
    });
  }

  const elements: CourseElement[] = [];

  // Rails: arc lines along the circle, approximated with short segments
  const ARC_STEPS = 8;
  const arcStep = carveDirection === 'left' ? -GATE_ANGLE : GATE_ANGLE;
  for (let i = 0; i < gates.length - 1; i++) {
    const startBearing = gates[i].radiusBearing;
    for (let s = 0; s < ARC_STEPS; s++) {
      const b0 = (startBearing + (s / ARC_STEPS) * arcStep + 360) % 360;
      const b1 = (startBearing + ((s + 1) / ARC_STEPS) * arcStep + 360) % 360;
      // Inside arc (radius - HALF_WIDTH from focal) = orange
      elements.push({ type: 'line',
        from: dest(focal.lat, focal.lng, RADIUS - HALF_WIDTH, b0),
        to:   dest(focal.lat, focal.lng, RADIUS - HALF_WIDTH, b1),
        color: 'orange' });
      // Outside arc (radius + HALF_WIDTH from focal) = white
      elements.push({ type: 'line',
        from: dest(focal.lat, focal.lng, RADIUS + HALF_WIDTH, b0),
        to:   dest(focal.lat, focal.lng, RADIUS + HALF_WIDTH, b1),
        color: 'white' });
    }
  }

  // Gate buoys, cross-lines, and labels
  for (let i = 0; i < gates.length; i++) {
    const { center, inside, outside, insideBearing } = gates[i];
    elements.push({ type: 'buoy', lat: inside.lat,  lng: inside.lng,  color: 'orange' });
    elements.push({ type: 'buoy', lat: outside.lat, lng: outside.lng, color: 'white'  });
    elements.push({ type: 'line', from: inside, to: outside, color: '#55aaff' });

    // Gate label 3 m toward focal (inside the channel)
    const labelPos = dest(center.lat, center.lng, 3, insideBearing);
    elements.push({ type: 'marker', lat: labelPos.lat, lng: labelPos.lng, color: 'white', label: `G${i + 1}` });
  }

  return { id, name, elements, center: { lat, lng }, direction };
}

/** Build a Course object from stored parameters. */
export function buildCourse(params: CourseParams): Course {
  if (params.type === 'distance') {
    return makeDistanceCourse(params.id, params.name, params.lat, params.lng, params.direction);
  }
  if (params.type === 'speed') {
    return makeSpeedCourse(params.id, params.name, params.lat, params.lng, params.direction, params.carveDirection ?? 'left');
  }
  return makeZACourse(params.id, params.name, params.lat, params.lng, params.direction);
}

/** Parameters for the pre-built courses (also the template for duplicates). */
export const BUILT_IN_PARAMS: CourseParams[] = [
  {
    id: 'skydive-arizona-distance',
    name: 'Skydive Arizona: Distance',
    type: 'distance',
    lat: 32.80799563593153,
    lng: -111.58165927116396,
    direction: 214.756
  },
  {
    id: 'skydive-arizona-speed',
    name: 'Skydive Arizona: Speed',
    type: 'speed',
    lat: 32.808047486484774,
    lng: -111.58182489757063,
    direction: 163.722,
    carveDirection: 'right'
  },
  {
    id: 'skydive-arizona-za',
    name: 'Skydive Arizona: Zone Accuracy',
    type: 'zone-accuracy',
    lat: 32.80799563593153,
    lng: -111.58165927116396,
    direction: 214.756
  },
  {
    id: 'skydive-city-distance',
    name: 'Skydive City: Distance',
    type: 'distance',
    lat: 28.2187820,
    lng: -82.1514716,
    direction: 197.46
  },
  {
    id: 'skydive-city-speed',
    name: 'Skydive City: Speed',
    type: 'speed',
    lat: 28.2187600,
    lng: -82.1514781,
    direction: 235,
    carveDirection: 'left'
  },
  {
    id: 'skydive-city-za',
    name: 'Skydive City: Zone Accuracy',
    type: 'zone-accuracy',
    lat: 28.2188610,
    lng: -82.1512317,
    direction: 360 - 89.6920
  }
];

export const COURSES: Course[] = BUILT_IN_PARAMS.map(buildCourse);
