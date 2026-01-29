import * as turf from '@turf/turf';

interface PointData {
  lat: number;
  lng: number;
  alt?: number;
  time?: number;
  phase?: string;
  pom?: number | boolean;
}

export interface LegStats {
  legIndex: number;
  altTop: number;
  altBottom: number;
  timeSec: number;
  heading: number;      // Direction of travel from pre-wind path (reversed: end to start)
  bearing: number;      // Direction of travel from post-wind path
  distance: number;     // Distance in feet
  windDriftDist: number; // Wind drift distance in feet
  windDriftDir: number;  // Wind drift direction in degrees
  glideRatio: number;
}

export interface ManoeuvreStats {
  timeSec: number;
  initialBearing: number;
  finalBearing: number;
  distanceX: number;    // Distance in depth direction (feet)
  distanceY: number;    // Distance in offset direction (feet)
  windDriftDist: number;
  windDriftDir: number;
}

export interface PathStats {
  legs: LegStats[];
  manoeuvre: ManoeuvreStats | null;
  // Map from point index to leg index (-1 for manoeuvre)
  pointToSegment: Map<number, number>;
}

/**
 * Calculate bearing between two points in degrees (0-360)
 */
function calcBearing(from: PointData, to: PointData): number {
  const bearing = turf.bearing([from.lng, from.lat], [to.lng, to.lat]);
  return (bearing + 360) % 360;
}

/**
 * Calculate distance between two points in feet
 */
function calcDistance(from: PointData, to: PointData): number {
  return turf.distance([from.lng, from.lat], [to.lng, to.lat], { units: 'feet' });
}

/**
 * Calculate wind drift for a leg by comparing pre-wind and post-wind positions.
 * The per-leg drift is: (shift at start of leg) - (shift at end of leg)
 * where shift = postWind position - preWind position
 */
function calcWindDrift(
  preWindStart: PointData,
  preWindEnd: PointData,
  postWindStart: PointData,
  postWindEnd: PointData
): { distance: number; direction: number } {
  // Shift at start of leg (how much the start point moved due to wind correction)
  const shiftStartLng = postWindStart.lng - preWindStart.lng;
  const shiftStartLat = postWindStart.lat - preWindStart.lat;

  // Shift at end of leg
  const shiftEndLng = postWindEnd.lng - preWindEnd.lng;
  const shiftEndLat = postWindEnd.lat - preWindEnd.lat;

  // Per-leg drift = shift at end - shift at start
  // This gives the direction the wind pushes the canopy during this leg
  const driftLng = shiftEndLng - shiftStartLng;
  const driftLat = shiftEndLat - shiftStartLat;

  if (Math.abs(driftLng) < 1e-10 && Math.abs(driftLat) < 1e-10) {
    return { distance: 0, direction: 0 };
  }

  // Calculate drift distance and direction
  const driftEndPoint = {
    lat: preWindStart.lat + driftLat,
    lng: preWindStart.lng + driftLng
  };
  const distance = calcDistance(preWindStart, driftEndPoint);
  const direction = calcBearing(preWindStart, driftEndPoint);

  return { distance, direction };
}

/**
 * Find segments (legs) in a path by identifying POM boundaries
 */
function findSegments(path: PointData[]): { start: number; end: number; phase: string }[] {
  const segments: { start: number; end: number; phase: string }[] = [];
  let segmentStart = 0;

  for (let i = 1; i < path.length; i++) {
    // Start new segment at POMs or phase changes
    if (path[i].pom || path[i].phase !== path[segmentStart].phase) {
      segments.push({
        start: segmentStart,
        end: i,
        phase: path[segmentStart].phase ?? 'unknown'
      });
      segmentStart = i;
    }
  }

  // Add final segment if needed
  if (segmentStart < path.length - 1) {
    segments.push({
      start: segmentStart,
      end: path.length - 1,
      phase: path[segmentStart].phase ?? 'unknown'
    });
  }

  return segments;
}

/**
 * Calculate statistics for all segments in the path
 */
export function calculatePathStats(
  preWindPath: PointData[],
  postWindPath: PointData[]
): PathStats {
  const legs: LegStats[] = [];
  const pointToSegment = new Map<number, number>();
  let manoeuvre: ManoeuvreStats | null = null;

  if (preWindPath.length < 2 || postWindPath.length < 2) {
    return { legs, manoeuvre, pointToSegment };
  }

  // Find pattern legs (segments between POMs in pattern phase)
  const patternPoints = postWindPath
    .map((p, i) => ({ ...p, originalIndex: i }))
    .filter(p => p.phase === 'pattern');

  const preWindPatternPoints = preWindPath.filter(p => p.phase === 'pattern');

  // Find leg boundaries (POMs)
  let legIndex = 0;
  let legStart = 0;

  for (let i = 0; i < patternPoints.length; i++) {
    const point = patternPoints[i];
    pointToSegment.set(point.originalIndex, legIndex);

    // Check if this is a POM (end of current leg)
    if (point.pom && i > legStart) {
      const startPoint = patternPoints[legStart];
      const endPoint = point;
      const preWindStart = preWindPatternPoints[legStart];
      const preWindEnd = preWindPatternPoints[i];

      if (preWindStart && preWindEnd) {
        const altTop = Math.max(startPoint.alt ?? 0, endPoint.alt ?? 0);
        const altBottom = Math.min(startPoint.alt ?? 0, endPoint.alt ?? 0);
        const timeSec = Math.abs((startPoint.time ?? 0) - (endPoint.time ?? 0)) / 1000;
        // Heading: from pre-wind path, reversed (end to start direction)
        const heading = calcBearing(preWindEnd, preWindStart);
        // Bearing: from post-wind path, reversed (end to start direction)
        const bearing = calcBearing(endPoint, startPoint);
        const distance = calcDistance(startPoint, endPoint);
        const altDiff = altTop - altBottom;
        const glideRatio = altDiff > 0 ? distance / altDiff : 0;

        const drift = calcWindDrift(preWindStart, preWindEnd, startPoint, endPoint);

        legs.push({
          legIndex,
          altTop,
          altBottom,
          timeSec,
          heading,
          bearing,
          distance,
          windDriftDist: drift.distance,
          windDriftDir: drift.direction,
          glideRatio
        });
      }

      legIndex++;
      legStart = i;
    }
  }

  // Calculate manoeuvre stats
  const manoeuvrePoints = postWindPath
    .map((p, i) => ({ ...p, originalIndex: i }))
    .filter(p => p.phase === 'manoeuvre');

  const preWindManoeuvrePoints = preWindPath.filter(p => p.phase === 'manoeuvre');

  if (manoeuvrePoints.length >= 2 && preWindManoeuvrePoints.length >= 2) {
    // Mark all manoeuvre points as segment -1
    for (const point of manoeuvrePoints) {
      pointToSegment.set(point.originalIndex, -1);
    }

    const first = manoeuvrePoints[0];
    const last = manoeuvrePoints[manoeuvrePoints.length - 1];
    const preWindFirst = preWindManoeuvrePoints[0];
    const preWindLast = preWindManoeuvrePoints[preWindManoeuvrePoints.length - 1];

    const timeSec = Math.abs((first.time ?? 0) - (last.time ?? 0)) / 1000;

    // Initial and final bearings (direction of travel)
    const initialBearing = manoeuvrePoints.length > 1
      ? calcBearing(manoeuvrePoints[0], manoeuvrePoints[1])
      : 0;
    const finalBearing = manoeuvrePoints.length > 1
      ? calcBearing(manoeuvrePoints[manoeuvrePoints.length - 2], manoeuvrePoints[manoeuvrePoints.length - 1])
      : 0;

    // Distance X (depth) and Y (offset) - using the final bearing as reference
    const totalDist = calcDistance(first, last);
    const bearingToEnd = calcBearing(first, last);
    const angleDiff = ((bearingToEnd - finalBearing) * Math.PI) / 180;
    const distanceX = Math.abs(totalDist * Math.cos(angleDiff));
    const distanceY = Math.abs(totalDist * Math.sin(angleDiff));

    const drift = calcWindDrift(preWindFirst, preWindLast, first, last);

    manoeuvre = {
      timeSec,
      initialBearing,
      finalBearing,
      distanceX,
      distanceY,
      windDriftDist: drift.distance,
      windDriftDir: drift.direction
    };
  }

  return { legs, manoeuvre, pointToSegment };
}

/**
 * Get the segment stats for a specific point
 */
export function getPointSegmentStats(
  pointIndex: number,
  stats: PathStats
): { type: 'leg'; stats: LegStats } | { type: 'manoeuvre'; stats: ManoeuvreStats } | null {
  const segmentIndex = stats.pointToSegment.get(pointIndex);

  if (segmentIndex === undefined) {
    return null;
  }

  if (segmentIndex === -1 && stats.manoeuvre) {
    return { type: 'manoeuvre', stats: stats.manoeuvre };
  }

  if (segmentIndex >= 0 && segmentIndex < stats.legs.length) {
    return { type: 'leg', stats: stats.legs[segmentIndex] };
  }

  return null;
}
