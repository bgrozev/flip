/**
 * Meter-radius circle geometry for MapLibre.
 *
 * MapLibre has no built-in geographic circle: its layers draw pixel-radius
 * circles, not ground circles that scale with zoom. The Google adapter's
 * `MapCircle` is sized in meters, so to reach parity we approximate the
 * ground circle as a many-sided polygon (via turf) and feed that GeoJSON to
 * a fill/line layer.
 */
import * as turf from '@turf/turf';
import type { Feature, Polygon } from 'geojson';

import { LatLng } from '../../types';

/**
 * A GeoJSON polygon approximating a circle of `radiusMeters` around `center`.
 * `steps` controls smoothness (vertices around the ring). The polygon honors
 * the metric radius, so it renders at the correct ground size at every zoom.
 */
export function meterCirclePolygon(
  center: LatLng,
  radiusMeters: number,
  steps = 64
): Feature<Polygon> {
  return turf.circle([center.lng, center.lat], radiusMeters, {
    steps,
    units: 'meters'
  });
}
