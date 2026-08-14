import * as turf from '@turf/turf';
import { FlightPath, FlightPoint } from '../types';

/**
 * Legacy flip point format (stored in localStorage and sample files).
 */
export interface LegacyFlipPoint {
  lat: number;
  lng: number;
  alt: number;
  time: number;
  pom: number | boolean;
  phase?: 'manoeuvre' | 'pattern';
}

/**
 * Convert a legacy flip point to a turf FlightPoint.
 */
export function legacyToFlightPoint(p: LegacyFlipPoint): FlightPoint {
  return turf.point([p.lng, p.lat], {
    alt: p.alt,
    time: p.time,
    pom: typeof p.pom === 'boolean' ? (p.pom ? 1 : 0) : p.pom,
    phase: p.phase
  }) as FlightPoint;
}

/**
 * Convert an array of legacy flip points to a FlightPath.
 */
export function legacyToFlightPath(points: LegacyFlipPoint[]): FlightPath {
  return points.map(p => legacyToFlightPoint(p));
}

/**
 * Check if a value looks like a legacy flip path (array of objects with lat/lng).
 */
export function isLegacyPath(value: unknown): value is LegacyFlipPoint[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  const first = value[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    'lat' in first &&
    'lng' in first &&
    !('geometry' in first)
  );
}

/**
 * Check if a value is already a FlightPath (array of turf points).
 */
export function isFlightPath(value: unknown): value is FlightPath {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  const first = value[0];
  return (
    typeof first === 'object' &&
    first !== null &&
    'geometry' in first &&
    'properties' in first
  );
}

/**
 * Migrate a value to FlightPath format if it's in legacy format.
 */
export function migrateToFlightPath(value: unknown): FlightPath {
  if (isFlightPath(value)) {
    return value;
  }
  if (isLegacyPath(value)) {
    return legacyToFlightPath(value);
  }
  return [];
}
