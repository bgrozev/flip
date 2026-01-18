import * as turf from '@turf/turf';
import { FlightPath, FlightPoint, LatLng } from '../types';
import { Winds, WindRow } from './wind';

export const metersToFeet = 3.28084;

// Knots to feet-per-second
export const ktsToFps = 1.68781;

// Miles per hour to feet per second.
export const mphToFps = 5280 / 3600;

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

function prepWind(winds: Winds): Winds {
  const wind: WindRow[] = [];

  // Filter out any rows with altitude that's out of order (e.g. user entered altitudes 0, 1000, 500).
  // Or an empty row in the middle, etc.
  let prevAlt = -1;

  winds.winds.forEach(row => {
    if (row.altFt > prevAlt) {
      wind.push(row.copy());
      prevAlt = row.altFt;
    }
  });

  return new Winds(wind);
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
  wind: Winds,
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

    const windAtAlt = preppedWinds.getWindAt(points[i - 1].properties.alt, interpolate);
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
