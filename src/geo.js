import * as d3 from 'd3';

import { WindsAloft } from './windsaloft.js';

// Utils adapted from http://www.movable-type.co.uk/scripts/latlong.html

export const metersToFeet = 3.28084;

// Knots to feet-per-second
const ktsToFps = 1.68781;

// Miles per hour to feet per second.
const mphToFps = 5280 / 3600;

// Radius of the Earth in feet
const Rft = 6371008.7714 * metersToFeet;

function dtor(deg) {
    return deg * (Math.PI / 180);
}

function rtod(rad) {
    const deg = rad / (Math.PI / 180);

    return (deg + 360) % 360;
}

// Normalize to [-180,180].
function normalizeLng(lng) {
    return ((lng + 540) % 360) - 180;
}

export class Point {
    constructor(lat, lng, time, pom, alt) {
        this.lat = lat;
        this.lng = lng;
        this.time = time;
        this.pom = pom;
        this.alt = alt;

        this.copy = this.copy.bind(this);
        this.latRad = this.latRad.bind(this);
        this.lngRad = this.lngRad.bind(this);
        this.translate = this.translate.bind(this);
        this.initialBearingTo = this.initialBearingTo.bind(this);
        this.distanceTo = this.distanceTo.bind(this);
    }

    copy() {
        return new Point(this.lat, this.lng, this.time, this.pom, this.alt);
    }

    latRad() {
        return dtor(this.lat);
    }

    lngRad() {
        return dtor(this.lng);
    }

    /** Move this point a given distance in feet in a given direction/bearing. */
    translate(bearing, distanceFt) {
        const d = distanceFt / Rft;
        const lat1 = this.latRad();
        const lng1 = this.lngRad();
        const b = dtor(bearing);

        const lat2 = Math.asin(
            (Math.sin(lat1) * Math.cos(d)) + (Math.cos(lat1) * Math.sin(d) * Math.cos(b))
        );
        const lng2 = lng1
            + Math.atan2(
                Math.sin(b) * Math.sin(d) * Math.cos(lat1),
                Math.cos(d) - (Math.sin(lat1) * Math.sin(lat2))
            );

        this.lat = rtod(lat2);
        this.lng = normalizeLng(rtod(lng2));
    }

    /** Initial bearing from this point to another [point].. */
    initialBearingTo(point) {
        const φ1 = this.latRad();
        const φ2 = point.latRad();
        const Δλ = dtor(point.lng - this.lng);

        const x = (Math.cos(φ1) * Math.sin(φ2)) - (Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ));
        const y = Math.sin(Δλ) * Math.cos(φ2);
        const θ = Math.atan2(y, x);
        const bearing = rtod(θ);

        return (bearing + 360) % 360;
    }

    /** Distance in feet between this point and [point]. */
    distanceTo(point) {
        const λ1 = this.lngRad(), λ2 = point.lngRad(), φ1 = this.latRad(), φ2 = point.latRad();
        const Δφ = φ2 - φ1;
        const Δλ = λ2 - λ1;

        const a = (Math.sin(Δφ / 2) * Math.sin(Δφ / 2))
            + (Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2));
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = Rft * c;

        return d;
    }

    /** Rotate this point around [center] by [degrees] degrees. */
    rotate(degrees, center) {
        const distanceFt = center.distanceTo(this);
        const bearing = center.initialBearingTo(this);

        this.lat = center.lat;
        this.lng = center.lng;
        this.translate(bearing + degrees, distanceFt);
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
    return new WindsAloft(wind);
}

export class Path {
    constructor(points = []) {
        this.points = points;

        this.addPoint = this.addPoint.bind(this);
        this.copy = this.copy.bind(this);
        this.translate = this.translate.bind(this);
        this.rotate = this.rotate.bind(this);
        this.translateTo = this.translateTo.bind(this);
        this.mirror = this.mirror.bind(this);
        this.setFinalHeading = this.setFinalHeading.bind(this);
    }

    addPoint(point) {
        this.points.push(point);
    }

    copy() {
        return new Path(this.points.map(p => p.copy()));
    }

    /** Translate each point of this path a given distance in feet in a given bearing. */
    translate(bearing, distanceFt) {
        this.points.forEach(p => p.translate(bearing, distanceFt));
    }

    /** Rotate this path by [degrees] around [center] or the first point of the path if [center] is not specified. */
    rotate(degrees, center) {
        if (this.points.length === 0 || degrees % 360 === 0) {
            return;
        }

        this.points.forEach(p => p.rotate(degrees, center || this.points[0]));
    }

    /** Translate this path so that its first point's coordinates are [point]'s. */
    translateTo(point) {
        if (this.points.length === 0) {
            return;
        }

        const o = this.points[0].copy();

        // Change just lat/lng, maintain timestamp, etc.
        this.points[0].lat = point.lat;
        this.points[0].lng = point.lng;

        for (let i = 1; i < this.points.length; i++) {
            const d = o.distanceTo(this.points[i]);
            const b = o.initialBearingTo(this.points[i]);

            this.points[i].lat = point.lat;
            this.points[i].lng = point.lng;
            this.points[i].translate(b, d);
        }
    }

    /** Reflect this around the bearing defined by the first two points */
    mirror() {
        if (this.points.length < 2) {
            return;
        }

        const centerBearing = this.points[0].initialBearingTo(this.points[1]);
        const start = this.points[0];

        for (let i = 2; i < this.points.length; i++) {
            const p = this.points[i];
            const b = start.initialBearingTo(p);
            const d = start.distanceTo(p);

            const b2 = centerBearing - (b - centerBearing);

            p.lat = start.lat;
            p.lng = start.lng;
            p.translate(b2, d);
        }
    }

    /** Rotate this around the first point so that the second->first point have an initial bearing of [bearing]. */
    setFinalHeading(bearing) {
        if (this.points.length < 2) {
            return;
        }

        const b = this.points[1].initialBearingTo(this.points[0]);

        this.rotate(bearing - b);
    }

    /** Add wind to a path. * */
    addWind(winds, interpolate) {
        if (this.points.length <= 1) {
            return;
        }

        const preppedWinds = prepWind(winds);

        const start = this.points[0];

        let ms = 0;
        let offsetFt = 0;
        let offsetB = 0;

        for (let i = 1; i < this.points.length; i++) {
            // path is backwards in time...
            ms = this.points[i - 1].time - this.points[i].time;

            const wind = preppedWinds.getWindAt(this.points[i - 1].alt, interpolate);
            const dOffsetFt = ms / 1000 * wind.speedKts * ktsToFps;
            const dOffsetB = wind.direction;
            const offsetPoint = start.copy();

            offsetPoint.translate(offsetB, offsetFt);
            offsetPoint.translate(dOffsetB, dOffsetFt);

            offsetFt = start.distanceTo(offsetPoint);
            offsetB = start.initialBearingTo(offsetPoint);

            this.points[i].translate(offsetB, offsetFt);
        }
    }
}

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

    // Ground level.
    const p4 = p3.copy();

    p4.time = p3.time + 1;
    p4.alt = 0;

    csv.push({});
    const points = [ { }, p0, p1, p2, p3, p4 ];

    for (let i = 1; i < 6; i++) {
        csv.push({ });
        csv[i].lat = points[i].lat;
        csv[i].lon = points[i].lng;
        csv[i].hMSL = points[i].alt / metersToFeet;
        csv[i].time = new Date(points[i].time).toISOString();
        csv[i].pom = 1;
    }

    return csv;
}
