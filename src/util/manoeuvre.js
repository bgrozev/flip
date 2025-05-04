import { Point } from '../util/geo.js';

export function createManoeuvrePath({ offsetXFt, offsetYFt, altitudeFt, duration, left }) {
    // TODO handle the case of offsets being 0
    const t0 = 0;
    const p0 = new Point(29.77, -97.77, t0, 1, altitudeFt);
    const p1 = p0.copy();
    const durationMs = duration * 1000;

    p1.translate(0, offsetYFt);
    p1.time = p1.time + (durationMs / 2);
    p1.alt = altitudeFt / 2;
    p1.pom = 0;


    const p2 = p1.copy();


    // We can't set the final heading if the last 2 points are on top of each other
    p2.translate(left ? 270 : 90, Math.max(offsetXFt, 3));
    p2.time = p2.time + (durationMs / 2);
    p2.alt = 0;

    return [ p2, p1, p0 ];
}
