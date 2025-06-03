import * as turf from '@turf/turf';

import { Winds } from './wind.js';

export const metersToFeet = 3.28084;

// Knots to feet-per-second
export const ktsToFps = 1.68781;

// Miles per hour to feet per second.
export const mphToFps = 5280 / 3600;

export class Point {
    constructor(lat, lng, time, pom, alt) {
        this.lat = lat;
        this.lng = lng;
        this.time = time;
        this.pom = pom;
        this.alt = alt;

        this.copy = this.copy.bind(this);
        this.translate = this.translate.bind(this);
        this.initialBearingTo = this.initialBearingTo.bind(this);
        this.distanceTo = this.distanceTo.bind(this);
    }

    copy() {
        return new Point(this.lat, this.lng, this.time, this.pom, this.alt);
    }

    /** Move this point a given distance in feet in a given direction/bearing. */
    translate(b, distanceFt) {
        const newPoint = turf.transformTranslate(toTurfPoint(this), distanceFt, b, { units: 'feet' });

        this.lng = newPoint.geometry.coordinates[0];
        this.lat = newPoint.geometry.coordinates[1];
    }

    /** Initial bearing from this point to another [point].. */
    initialBearingTo(p) {
        return normalizeBearing(turf.bearing(toTurfPoint(this), toTurfPoint(p)));
    }

    /** Distance in feet between this point and [point]. */
    distanceTo(p) {
        return turf.distance(toTurfPoint(this), toTurfPoint(p), { units: 'feet' });
    }

    /** Rotate this point around [center] by [degrees] degrees. */
    rotate(degrees, center) {
        const distanceFt = center.distanceTo(this);
        const b = center.initialBearingTo(this);

        this.lat = center.lat;
        this.lng = center.lng;
        this.translate(b + degrees, distanceFt);
    }
}

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

export class Path {
    constructor(points = []) {
        this.points = points;

        this.copy = this.copy.bind(this);
        this.translate = this.translate.bind(this);
        this.rotate = this.rotate.bind(this);
        this.translateTo = this.translateTo.bind(this);
        this.setFinalHeading = this.setFinalHeading.bind(this);
    }

    copy() {
        return new Path(this.points.map(p => p.copy()));
    }

    /** Translate each point of this path a given distance in feet in a given bearing. */
    translate(b, distanceFt) {
        this.points.forEach(p => p.translate(b, distanceFt));
    }

    /** Rotate this path by [degrees] around [center] or the first point of the path if [center] is not specified. */
    rotate(degrees, center) {
        if (this.points.length === 0 || degrees % 360 === 0) {
            return;
        }

        this.points.forEach(p => p.rotate(degrees, center || this.points[0]));
    }

    /** Translate this path so that its first point's coordinates are [point]'s. */
    translateTo(p) {
        if (this.points.length === 0) {
            return;
        }

        const o = this.points[0].copy();

        // Change just lat/lng, maintain timestamp, etc.
        this.points[0].lat = p.lat;
        this.points[0].lng = p.lng;

        for (let i = 1; i < this.points.length; i++) {
            const d = o.distanceTo(this.points[i]);
            const b = o.initialBearingTo(this.points[i]);

            this.points[i].lat = p.lat;
            this.points[i].lng = p.lng;
            this.points[i].translate(b, d);
        }
    }

    /** Rotate this around the first point so that the second->first point have an initial bearing of [bearing]. */
    setFinalHeading(bearing) {
        if (this.points.length < 2) {
            return;
        }

        const b = this.points[1].initialBearingTo(this.points[0]);

        this.rotate(normalizeBearing(bearing + 360 - b));
    }
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

function translateTurf(turfPoints, turfTarget) {
    if (turfPoints.length < 1) {
        return turfPoints;
    }

    const angle = turf.bearing(turfPoints[0], turfTarget);
    const dist = turf.distance(turfPoints[0], turfTarget, { units: 'feet' });

    return turfPoints.map((p) => transformTranslate(p, dist, angle, { units: 'feet' }));
}

export function translate(points, target) {
    if (points.length < 1) {
        return points
    }

    const translatedTurfPoints = translateTurf(toTurfPoints(points), toTurfPoint(target));

    return toFlipPoints(translatedTurfPoints);
}

function setFinalHeadingTurf(turfPoints, finalHeading) {
    if (turfPoints.length < 2) {
        return turfPoints;
    }

    const currentHeading = turf.bearing(turfPoints[1], turfPoints[0]);
    return turf.transformRotate(turfPoints, finalHeading - currentHeading, { pivot: turfPoints[0], mutate: false });
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
    const ret = [ turf.clone(start) ]
    let ms = 0;
    let offsetFt = 0;
    let offsetB = 0;

    for (let i = 1; i < turfPoints.length; i++) {
        // path is backwards in time...
        ms = turfPoints[i - 1].properties.time - turfPoints[i].properties.time;

        const wind = preppedWinds.getWindAt(turfPoints[i - 1].properties.alt, interpolate);
        const dOffsetFt = ms / 1000 * wind.speedKts * ktsToFps;
        const dOffsetB = wind.direction;

        let offsetPoint = turf.clone(start);
        offsetPoint = turf.transformTranslate(offsetPoint, offsetFt, offsetB, { units: 'feet' });
        offsetPoint = turf.transformTranslate(offsetPoint, dOffsetFt, dOffsetB, { units: 'feet' });

        offsetFt = turf.distance(start, offsetPoint, { units: 'feet' });
        offsetB = normalizeBearing(turf.bearing(start, offsetPoint));

        ret.push(turf.transformTranslate(turfPoints[i], offsetFt, offsetB, { units: 'feet' }));
    }

    return ret
}
