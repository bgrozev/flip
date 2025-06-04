import * as turf from '@turf/turf';
import { toFlipPoints } from '../util/geo.js';

export function createManoeuvrePath({ offsetXFt, offsetYFt, altitudeFt, duration, left }) {
    // TODO handle the case of offsets being 0
    const p0 = turf.point([ 0.1, -0.1 ], { time: 0, alt: altitudeFt, pom: 1 } )
    const durationMs = duration * 1000;
    const p1 = turf.transformTranslate(p0, offsetYFt, 0, { units: 'feet' });

    p1.properties.time = p1.properties.time + (durationMs / 2);
    p1.properties.alt = altitudeFt / 2;
    p1.properties.pom = 0;

    // We can't set the final heading if the last 2 points are on top of each other, offset at least 3 ft
    const p2 = turf.transformTranslate(p1, Math.max(offsetXFt, 3), left ? 90 : 270, { units: 'feet' });
    p2.properties.time = p2.properties.time + (durationMs / 2);
    p2.properties.alt = 0;
    p2.properties.pom = 1;

    return [ p2, p1, p0 ];
}
