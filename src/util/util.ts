import * as turf from '@turf/turf';
import { FlightPath, Target } from '../types';
import { ktsToFps, normalizeBearing, setFinalHeading, translate } from './geo';
import { latLngToPoint } from './coords';

export const CODEC_JSON = {
  parse: (value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return { _error: 'parse failed' };
    }
  },
  stringify: (value: unknown) => JSON.stringify(value)
};

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

  if (manoeuvrePoints.length > 0 && patternPoints.length > 0) {
    // Fix time and alt for pattern
    const m0 = manoeuvrePoints[manoeuvrePoints.length - 1];
    const p0 = patternPoints[0];
    const timeOffset = p0.properties.time - m0.properties.time;
    const altOffset = p0.properties.alt - m0.properties.alt;

    for (let i = 0; i < patternPoints.length; i++) {
      const p = patternPoints[i];
      p.properties.time = p.properties.time - timeOffset;
      p.properties.alt = p.properties.alt - altOffset;
    }
  }

  const merged: FlightPath = [
    ...manoeuvrePoints.map(point => {
      point.properties.phase = 'manoeuvre';
      return point;
    }),
    ...patternPoints.map(point => {
      point.properties.phase = 'pattern';
      return point;
    })
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

/**
 * Scale the altitude of all points in a manoeuvre.
 */
export function setManoeuvreAltitude(points: FlightPath, newAlt: number): void {
  if (!points.length) {
    return;
  }

  const scale = newAlt / points[points.length - 1].properties.alt;

  for (let i = 0; i < points.length; i++) {
    points[i].properties.alt *= scale;
  }
}
