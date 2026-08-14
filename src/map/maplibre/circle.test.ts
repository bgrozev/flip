import * as turf from '@turf/turf';
import { describe, expect, it } from 'vitest';

import { meterCirclePolygon } from './circle';

describe('meterCirclePolygon', () => {
  const center = { lat: 28.21887, lng: -82.15122 };

  it('honors the metric radius (all vertices ~radius from center)', () => {
    const radius = 250;
    const poly = meterCirclePolygon(center, radius);
    const ring = poly.geometry.coordinates[0];

    for (const [lng, lat] of ring) {
      const d = turf.distance([center.lng, center.lat], [lng, lat], { units: 'meters' });

      expect(d).toBeCloseTo(radius, 0);
    }
  });

  it('produces a closed ring with steps + 1 vertices', () => {
    const poly = meterCirclePolygon(center, 100, 32);
    const ring = poly.geometry.coordinates[0];

    expect(ring).toHaveLength(33);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('scales with the requested radius', () => {
    const small = meterCirclePolygon(center, 10);
    const large = meterCirclePolygon(center, 1000);
    const smallR = turf.distance(
      [center.lng, center.lat], small.geometry.coordinates[0][0], { units: 'meters' }
    );
    const largeR = turf.distance(
      [center.lng, center.lat], large.geometry.coordinates[0][0], { units: 'meters' }
    );

    expect(smallR).toBeCloseTo(10, 0);
    expect(largeR).toBeCloseTo(1000, 0);
  });
});
