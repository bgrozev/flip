import * as turf from '@turf/turf';

import { Course, CourseElement, LatLng } from '../types';

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

export const COURSES: Course[] = [
  makeDistanceCourse(
    'skydive-city-distance',
    'Skydive City: Distance',
    28.2187820,
    -82.1514716,
    197.46
  )
];
