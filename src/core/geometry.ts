import * as turf from '@turf/turf';
import { FlightPath, FlightPoint, LatLng, Target } from '../types';
import { latLngToPoint } from './coords';
import { ktsToFps } from './units';
import { WindProfile, getWindAt, prepWind } from './wind';

// Maximum distance (in feet) a target can move before wind data is invalidated
export const TARGET_MOVE_THRESHOLD_FT = 5000;

/**
 * Calculate the distance in feet between two points.
 * Points can be LatLng objects or [lng, lat] arrays.
 */
export function distanceFeet(
  point1: LatLng | [number, number],
  point2: LatLng | [number, number]
): number {
  const p1 = Array.isArray(point1) ? point1 : [point1.lng, point1.lat];
  const p2 = Array.isArray(point2) ? point2 : [point2.lng, point2.lat];

  return turf.distance(p1, p2, { units: 'feet' });
}

/**
 * Check if target has moved beyond the threshold distance.
 */
export function hasTargetMovedTooFar(
  oldTarget: LatLng,
  newTarget: LatLng,
  threshold: number = TARGET_MOVE_THRESHOLD_FT
): boolean {
  return distanceFeet(oldTarget, newTarget) > threshold;
}

/**
 * Normalize a bearing to 0-360 range.
 */
export function normalizeBearing(bearing: number): number {
  return (bearing + 360) % 360;
}

/**
 * Translate a path so that the first point is at the target location.
 */
export function translate(points: FlightPath, target: FlightPoint): FlightPath {
  if (points.length === 0) {
    return points;
  }

  const o = turf.clone(points[0]);
  const ret: FlightPath = [];

  ret.push(turf.clone(points[0]) as FlightPoint);
  ret[0].geometry.coordinates[0] = target.geometry.coordinates[0];
  ret[0].geometry.coordinates[1] = target.geometry.coordinates[1];

  for (let i = 1; i < points.length; i++) {
    const d = turf.distance(o, points[i], { units: 'feet' });
    const b = turf.bearing(o, points[i]);

    let c = turf.clone(points[i]) as FlightPoint;

    c.geometry.coordinates[0] = target.geometry.coordinates[0];
    c.geometry.coordinates[1] = target.geometry.coordinates[1];
    c = turf.transformTranslate(c, d, b, { units: 'feet' }) as FlightPoint;
    ret.push(c);
  }

  return ret;
}

/**
 * Rotate a path so the heading from point[1] to point[0] matches finalHeading.
 */
export function setFinalHeading(points: FlightPath, finalHeading: number): FlightPath {
  if (points.length < 2) {
    return points;
  }

  const currentHeading = turf.bearing(points[1], points[0]);
  const rotation = finalHeading - currentHeading;
  const ret = turf.transformRotate(turf.featureCollection(points), rotation, {
    pivot: points[0],
    mutate: false
  });

  return ret.features as FlightPath;
}

/**
 * Calculate initial bearing from p1 to p2.
 */
export function initialBearing(p1: FlightPoint, p2: FlightPoint): number {
  return normalizeBearing(turf.bearing(p1, p2));
}

/**
 * Project a point along a bearing (degrees) by a distance in meters.
 */
export function destinationPoint(from: LatLng, bearingDeg: number, distanceM: number): LatLng {
  const pt = turf.destination([from.lng, from.lat], distanceM, bearingDeg, { units: 'meters' });

  return { lat: pt.geometry.coordinates[1], lng: pt.geometry.coordinates[0] };
}

/**
 * Initial bearing from one LatLng to another, normalized to 0-360.
 */
export function bearingBetween(from: LatLng, to: LatLng): number {
  return normalizeBearing(turf.bearing([from.lng, from.lat], [to.lng, to.lat]));
}

/**
 * Mirror a path around the axis defined by the first two points.
 */
export function mirror(points: FlightPath): FlightPath {
  if (points.length < 2) {
    return points;
  }

  const mirrored: FlightPath = [points[0], points[1]];

  const centerBearing = normalizeBearing(turf.bearing(points[0], points[1]));
  const start = points[0];

  for (let i = 2; i < points.length; i++) {
    const p = turf.clone(points[i]) as FlightPoint;
    const b = turf.bearing(start, p);
    const d = turf.distance(start, p, { units: 'feet' });

    const b2 = centerBearing - (b - centerBearing);

    p.geometry.coordinates[0] = start.geometry.coordinates[0];
    p.geometry.coordinates[1] = start.geometry.coordinates[1];
    const m = turf.transformTranslate(p, d, b2, { units: 'feet' }) as FlightPoint;

    mirrored.push(m);
  }

  return mirrored;
}

/**
 * Apply wind correction to a path.
 * Path is processed backward from landing point to exit.
 * Final point stays fixed at target, earlier points are offset based on wind.
 */
export function addWind(
  points: FlightPath,
  wind: WindProfile,
  interpolate?: boolean
): FlightPath {
  if (points.length <= 1) {
    return points;
  }

  const preppedWinds = prepWind(wind);
  const start = points[0];
  const ret: FlightPath = [turf.clone(start) as FlightPoint];
  let offsetFt = 0;
  let offsetB = 0;

  for (let i = 1; i < points.length; i++) {
    // path is backwards in time...
    const ms = points[i - 1].properties.time - points[i].properties.time;

    const windAtAlt = getWindAt(preppedWinds, points[i - 1].properties.alt, interpolate);
    const dOffsetFt = (ms / 1000) * windAtAlt.speedKts * ktsToFps;
    const dOffsetB = windAtAlt.direction;

    let offsetPoint = turf.clone(start) as FlightPoint;

    offsetPoint = turf.transformTranslate(offsetPoint, offsetFt, offsetB, {
      units: 'feet'
    }) as FlightPoint;
    offsetPoint = turf.transformTranslate(offsetPoint, dOffsetFt, dOffsetB, {
      units: 'feet'
    }) as FlightPoint;

    offsetFt = turf.distance(start, offsetPoint, { units: 'feet' });
    offsetB = normalizeBearing(turf.bearing(start, offsetPoint));

    ret.push(
      turf.transformTranslate(points[i], offsetFt, offsetB, {
        units: 'feet'
      }) as FlightPoint
    );
  }

  return ret;
}

/**
 * Reposition manoeuvre and pattern paths to the target location and heading.
 * Returns a merged FlightPath with phase information.
 */
export function reposition(
  manoeuvre: FlightPath,
  pattern: FlightPath,
  target: Target,
  correctPatternHeading: boolean
): FlightPath {
  let manoeuvrePoints = manoeuvre;
  let patternPoints = pattern;
  const turfTarget = latLngToPoint(target.target);

  function norm(x: number): number {
    return Math.abs(((x + 540) % 360) - 180);
  }

  manoeuvrePoints = translate(manoeuvrePoints, turfTarget);
  manoeuvrePoints = setFinalHeading(manoeuvrePoints, target.finalHeading);

  const patternTarget =
    manoeuvrePoints.length > 0
      ? manoeuvrePoints[manoeuvrePoints.length - 1]
      : turfTarget;

  patternPoints = translate(patternPoints, patternTarget);

  let patternFinalHeading = target.finalHeading;

  if (manoeuvrePoints.length > 1) {
    const manoeuvreInitialHeading = normalizeBearing(
      turf.bearing(
        manoeuvrePoints[manoeuvrePoints.length - 1],
        manoeuvrePoints[manoeuvrePoints.length - 2]
      )
    );

    if (correctPatternHeading) {
      const h1 = (target.finalHeading + 90) % 360;
      const h2 = (target.finalHeading + 270) % 360;
      const d1 = norm(h1 - manoeuvreInitialHeading);
      const d2 = norm(h2 - manoeuvreInitialHeading);

      patternFinalHeading = d1 < d2 ? h1 : h2;
    } else {
      patternFinalHeading = manoeuvreInitialHeading;
    }
  }

  patternPoints = setFinalHeading(patternPoints, patternFinalHeading);

  // Time/alt offsets making the pattern connect to the end of the manoeuvre
  let timeOffset = 0;
  let altOffset = 0;

  if (manoeuvrePoints.length > 0 && patternPoints.length > 0) {
    const m0 = manoeuvrePoints[manoeuvrePoints.length - 1];
    const p0 = patternPoints[0];

    timeOffset = p0.properties.time - m0.properties.time;
    altOffset = p0.properties.alt - m0.properties.alt;
  }

  // Produce new point objects — never mutate the (possibly memoized) inputs
  const merged: FlightPath = [
    ...manoeuvrePoints.map(point => ({
      ...point,
      properties: { ...point.properties, phase: 'manoeuvre' as const }
    })),
    ...patternPoints.map(point => ({
      ...point,
      properties: {
        ...point.properties,
        time: point.properties.time - timeOffset,
        alt: point.properties.alt - altOffset,
        phase: 'pattern' as const
      }
    }))
  ];

  return merged;
}

/**
 * Calculate average wind effect by comparing two paths.
 */
export function averageWind(
  c1: FlightPath,
  c2: FlightPath
): { speedKts?: number; direction?: number } {
  if (c1.length <= 1) {
    return {};
  }

  const p1: [number, number] = [
    c1[c1.length - 1].geometry.coordinates[0],
    c1[c1.length - 1].geometry.coordinates[1]
  ];
  const p2: [number, number] = [
    c2[c2.length - 1].geometry.coordinates[0],
    c2[c2.length - 1].geometry.coordinates[1]
  ];
  const distanceFt = turf.distance(p1, p2, { units: 'feet' });

  const seconds =
    (c1[0].properties.time - c1[c1.length - 1].properties.time) / 1000;
  const speedKts = distanceFt / seconds / ktsToFps;

  const bearing = turf.bearing(p1, p2);
  return { speedKts, direction: (bearing + 360) % 360 };
}

/**
 * Straighten curved legs in a wind-corrected path.
 *
 * Wind shear can cause what should be straight pattern legs to appear curved,
 * because each point is offset by a different wind vector. This function
 * redistributes non-POM points within each pattern leg so they lie evenly
 * spaced on the straight line between the leg's two endpoint POMs.
 *
 * Only the pattern phase is affected; the manoeuvre turn is left unchanged.
 * The wind drift calculation is not altered — only the visual positions of
 * intermediate points change.
 */
export function straightenLegs(path: FlightPath): FlightPath {
  if (path.length === 0) return path;

  // Build the list of segment boundary indices for the pattern phase.
  // A boundary is either the first pattern point or a POM within the pattern.
  const boundaries: number[] = [];
  let firstPatternIdx = -1;

  for (let i = 0; i < path.length; i++) {
    const point = path[i];

    if (point.properties.phase !== 'pattern') continue;

    if (firstPatternIdx === -1) {
      firstPatternIdx = i;
      boundaries.push(i);
    }

    if (point.properties.pom && i !== firstPatternIdx) {
      boundaries.push(i);
    }
  }

  if (boundaries.length < 2) return path;

  // Deep-copy geometry so we don't mutate the original path
  const result: FlightPath = path.map(p => ({
    ...p,
    geometry: { ...p.geometry, coordinates: [...p.geometry.coordinates] }
  }));

  for (let b = 0; b < boundaries.length - 1; b++) {
    const startIdx = boundaries[b];
    const endIdx = boundaries[b + 1];
    const intermediateCount = endIdx - startIdx - 1;

    if (intermediateCount === 0) continue;

    const [startLng, startLat] = path[startIdx].geometry.coordinates;
    const [endLng, endLat] = path[endIdx].geometry.coordinates;

    for (let k = 1; k <= intermediateCount; k++) {
      const t = k / (intermediateCount + 1);

      result[startIdx + k] = {
        ...path[startIdx + k],
        geometry: {
          type: 'Point',
          coordinates: [
            startLng + t * (endLng - startLng),
            startLat + t * (endLat - startLat)
          ]
        }
      };
    }
  }

  return result;
}
