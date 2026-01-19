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
