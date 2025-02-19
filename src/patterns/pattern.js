import * as d3 from 'd3';

import { Point, metersToFeet, mphToFps } from '../util/geo.js';

// Make a standard downwind-base-final pattern
export function makePattern(pattern) {
    const csv = d3.csvParse('time,lat,lon,hMSL,pom');

    // Entry.
    const t0 = new Date().getTime();
    const p0 = new Point(29.77, -97.77, t0, 1, pattern.entryFt);

    // Turn to base.
    const p1 = p0.copy();
    const t1 = 1000 * (pattern.entryFt - pattern.baseFt) / (pattern.descentRateMph * mphToFps);
    const l1 = (pattern.entryFt - pattern.baseFt) * pattern.gr;

    p1.translate(pattern.zPattern ? 0 : 180, l1);
    p1.time = p1.time + t1;
    p1.alt = pattern.baseFt;

    // Turn to final.
    const p2 = p1.copy();
    const t2 = 1000 * (pattern.baseFt - pattern.finalFt) / (pattern.descentRateMph * mphToFps);
    const l2 = (pattern.baseFt - pattern.finalFt) * pattern.gr;

    p2.translate(90, l2);
    p2.time = p2.time + t2;
    p2.alt = pattern.finalFt;

    // Finish the pattern.
    const p3 = p2.copy();
    const t3 = 1000 * (pattern.finalFt - pattern.finishFt) / (pattern.descentRateMph * mphToFps);
    const l3 = (pattern.finalFt - pattern.finishFt) * pattern.gr;

    p3.translate(0, l3);
    p3.time = p3.time + t3;
    p3.alt = pattern.finishFt;

    const points = [ { }, p0, p1, p2, p3 ];

    if (pattern.finishFt > 0) {
        // Ground level.
        const p4 = p3.copy();

        p4.time = p3.time + 1;
        p4.alt = 0;
        points.push(p4);
    }

    csv.push({});

    for (let i = 1; i < points.length; i++) {
        csv.push({ });
        csv[i].lat = points[i].lat;
        csv[i].lon = points[i].lng;
        csv[i].hMSL = points[i].alt / metersToFeet;
        csv[i].time = new Date(points[i].time).toISOString();
        csv[i].pom = 1;
    }

    return csv;
}
