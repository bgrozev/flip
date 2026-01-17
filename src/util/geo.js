import * as turf from '@turf/turf';

import { Winds } from './wind.js';

export const metersToFeet = 3.28084;

// Knots to feet-per-second
export const ktsToFps = 1.68781;

// Miles per hour to feet per second.
export const mphToFps = 5280 / 3600;

function prepWind(winds) {
    const wind = [];

    // Filter out and rows with altitude that's out of in order (e.g. user entered altitudes 0, 1000, 500). Or an
    // empty row in the middle, etc.
    let prevAlt = -1;

    winds.winds.forEach(row => {
        if (row.altFt > prevAlt) {
            wind.push(row.copy());
            prevAlt = row.altFt;
        }
    });

    // Do we want to insert a [0,0,0] in case the first entry's alt is >0?
    return new Winds(wind);
}

export function toTurfPoint(p) {
    const props = {};

    for (const key of Object.keys(p)) {
        if (p.hasOwnProperty(key) && key !== 'lat' && key !== 'lng') {
            props[key] = p[key];
        }
    }

    return turf.point([ p.lng, p.lat ], props);
}
export function toTurfPoints(points) {
    return points.map(p => toTurfPoint(p));
}
function toFlipPoint(turfPoint) {
    const flipPoint = { lat: turfPoint.geometry.coordinates[1], lng: turfPoint.geometry.coordinates[0] };

    for (const key of Object.keys(turfPoint.properties)) {
        if (turfPoint.properties.hasOwnProperty(key)) {
            flipPoint[key] = turfPoint.properties[key];
        }
    }

    return flipPoint;
}
export function toFlipPoints(turfPoints) {
    return turfPoints.map(p => toFlipPoint(p));
}
export function normalizeBearing(bearing) {
    return (bearing + 360) % 360;
}

export function translateTurf(turfPoints, turfTarget) {
    if (turfPoints.length === 0) {
        return turfPoints;
    }

    const o = turf.clone(turfPoints[0]);

    const ret = [];

    ret.push(turf.clone(turfPoints[0]));
    ret[0].geometry.coordinates[0] = turfTarget.geometry.coordinates[0];
    ret[0].geometry.coordinates[1] = turfTarget.geometry.coordinates[1];

    for (let i = 1; i < turfPoints.length; i++) {
        const d = turf.distance(o, turfPoints[i], { units: 'feet' });
        const b = turf.bearing(o, turfPoints[i]);

        let c = turf.clone(turfPoints[i]);

        c.geometry.coordinates[0] = turfTarget.geometry.coordinates[0];
        c.geometry.coordinates[1] = turfTarget.geometry.coordinates[1];
        c = turf.transformTranslate(c, d, b, { units: 'feet' });
        ret.push(c);
    }

    return ret;
}

export function translate(points, target) {
    if (points.length < 1) {
        return points;
    }

    const translatedTurfPoints = translateTurf(toTurfPoints(points), toTurfPoint(target));

    return toFlipPoints(translatedTurfPoints);
}

export function setFinalHeadingTurf(turfPoints, finalHeading) {
    if (turfPoints.length < 2) {
        return turfPoints;
    }

    const currentHeading = turf.bearing(turfPoints[1], turfPoints[0]);
    const rotation = finalHeading - currentHeading;
    const ret = turf.transformRotate(
        turf.featureCollection(turfPoints),
        rotation,
        { pivot: turfPoints[0], mutate: false }
    );

    return ret.features;
}

export function setFinalHeading(points, finalHeading) {
    if (points.length < 2) {
        return points;
    }

    const rotatedTurfPoints = setFinalHeadingTurf(toTurfPoints(points), finalHeading);

    return toFlipPoints(rotatedTurfPoints);
}

export function initialBearing(p1, p2) {
    const point1 = toTurfPoint(p1);
    const point2 = toTurfPoint(p2);

    return normalizeBearing(turf.bearing(point1, point2));
}

export function mirrorTurf(turfPoints) {
    if (turfPoints.length < 2) {
        return turfPoints;
    }

    const mirrored = [ turfPoints[0], turfPoints[1] ];

    const centerBearing = normalizeBearing(turf.bearing(turfPoints[0], turfPoints[1]));
    const start = turfPoints[0];

    for (let i = 2; i < turfPoints.length; i++) {
        const p = turf.clone(turfPoints[i]);
        const b = turf.bearing(start, p);
        const d = turf.distance(start, p, { units: 'feet' });

        const b2 = centerBearing - (b - centerBearing);

        p.geometry.coordinates[0] = start.geometry.coordinates[0];
        p.geometry.coordinates[1] = start.geometry.coordinates[1];
        const m = turf.transformTranslate(p, d, b2, { units: 'feet' });

        mirrored.push(m);
    }

    return mirrored;
}

export function addWindTurf(turfPoints, wind, interpolate) {
    if (turfPoints.length <= 1) {
        return turfPoints;
    }

    const preppedWinds = prepWind(wind);
    const start = turfPoints[0];
    const ret = [ turf.clone(start) ];
    let ms = 0;
    let offsetFt = 0;
    let offsetB = 0;

    for (let i = 1; i < turfPoints.length; i++) {
        // path is backwards in time...
        ms = turfPoints[i - 1].properties.time - turfPoints[i].properties.time;

        const windAtAlt = preppedWinds.getWindAt(turfPoints[i - 1].properties.alt, interpolate);
        const dOffsetFt = ms / 1000 * windAtAlt.speedKts * ktsToFps;
        const dOffsetB = windAtAlt.direction;

        let offsetPoint = turf.clone(start);

        offsetPoint = turf.transformTranslate(offsetPoint, offsetFt, offsetB, { units: 'feet' });
        offsetPoint = turf.transformTranslate(offsetPoint, dOffsetFt, dOffsetB, { units: 'feet' });

        offsetFt = turf.distance(start, offsetPoint, { units: 'feet' });
        offsetB = normalizeBearing(turf.bearing(start, offsetPoint));

        ret.push(turf.transformTranslate(turfPoints[i], offsetFt, offsetB, { units: 'feet' }));
    }

    return ret;
}
