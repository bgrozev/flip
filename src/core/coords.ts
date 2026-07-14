import * as turf from '@turf/turf';
import { FlightPath, FlightPoint, LatLng } from '../types';

/**
 * Convert a FlightPoint to a LatLng for Google Maps.
 */
export function pointToLatLng(p: FlightPoint): LatLng & { pom?: number | boolean; phase?: string; alt?: number; time?: number } {
  return {
    lat: p.geometry.coordinates[1],
    lng: p.geometry.coordinates[0],
    pom: p.properties.pom,
    phase: p.properties.phase,
    alt: p.properties.alt,
    time: p.properties.time
  };
}

/**
 * Convert a LatLng to a FlightPoint.
 */
export function latLngToPoint(
  ll: LatLng,
  properties: { alt?: number; time?: number; pom?: number | boolean; phase?: 'manoeuvre' | 'pattern' } = {}
): FlightPoint {
  return turf.point([ll.lng, ll.lat], {
    alt: properties.alt ?? 0,
    time: properties.time ?? 0,
    pom: properties.pom ?? 0,
    phase: properties.phase
  }) as FlightPoint;
}

/**
 * Convert a FlightPath to an array of LatLngs for Google Maps.
 * This is the primary conversion function used at the MapComponent boundary.
 */
export function pathToLatLngs(path: FlightPath): (LatLng & { pom?: number | boolean; phase?: string; alt?: number; time?: number })[] {
  return path.map(p => pointToLatLng(p));
}

/**
 * Convert an array of LatLngs to a FlightPath.
 */
export function latLngsToPath(lls: LatLng[]): FlightPath {
  return lls.map(ll => latLngToPoint(ll));
}
