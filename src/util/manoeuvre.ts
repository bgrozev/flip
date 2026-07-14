import * as turf from '@turf/turf';
import { FlightPath, FlightPoint, ManoeuvreParams } from '../types';

/**
 * Length (in feet) of the final segment used when offsetXFt is 0. The final
 * approach direction is derived downstream from the bearing between the
 * last two points (setFinalHeading), so they must not coincide; 0.01 ft is
 * visually indistinguishable from a zero offset.
 */
const MIN_FINAL_SEGMENT_FT = 0.01;

export function createManoeuvrePath({
  offsetXFt,
  offsetYFt,
  altitudeFt,
  duration,
  left
}: ManoeuvreParams): FlightPath {
  const p0 = turf.point([0.1, -0.1], {
    time: 0,
    alt: altitudeFt,
    pom: 1
  }) as FlightPoint;
  const durationMs = duration * 1000;
  const p1 = turf.transformTranslate(p0, offsetYFt, 0, { units: 'feet' }) as FlightPoint;

  p1.properties.time = p1.properties.time + durationMs / 2;
  p1.properties.alt = altitudeFt / 2;
  p1.properties.pom = 0;

  // offsetXFt runs along the final-approach axis. Negative values offset to
  // the opposite side; 0 keeps p2 (visually) on top of p1, using a tiny
  // epsilon so the final heading stays defined.
  const finalSegmentFt = Math.max(Math.abs(offsetXFt), MIN_FINAL_SEGMENT_FT);
  let finalBearing = left ? 90 : 270;

  if (offsetXFt < 0) {
    finalBearing = (finalBearing + 180) % 360;
  }

  const p2 = turf.transformTranslate(p1, finalSegmentFt, finalBearing, {
    units: 'feet'
  }) as FlightPoint;

  p2.properties.time = p2.properties.time + durationMs / 2;
  p2.properties.alt = 0;
  p2.properties.pom = 1;

  return [p2, p1, p0];
}
