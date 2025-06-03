import * as turf from '@turf/turf';
import { Path, Point, ktsToFps, toTurfPoints, toFlipPoints, mirrorTurf, addWindTurf } from './geo.js';

export const CODEC_JSON = {
    parse: value => {
        try {
            return JSON.parse(value);
        } catch {
            return { _error: 'parse failed' };
        }
    },
    stringify: value => JSON.stringify(value)
};

export function reposition(manoeuvre, pattern, target, correctPatternHeading) {
    const manoeuvrePath = pathFromJson(manoeuvre);
    const patternPath = pathFromJson(pattern);

    function norm(x) {
        return Math.abs(((x + 540) % 360) - 180);
    }

    manoeuvrePath.translateTo(target.target);
    manoeuvrePath.setFinalHeading(target.finalHeading);

    if (manoeuvrePath.points.length > 0) {
        patternPath.translateTo(manoeuvrePath.points[manoeuvrePath.points.length - 1]);
    } else {
        patternPath.translateTo(target.target);
    }

    let patternFinalHeading = target.finalHeading;

    if (manoeuvrePath.points.length > 1) {
        const manoeuvreInitialHeading
            = manoeuvrePath.points[manoeuvrePath.points.length - 1].initialBearingTo(
                manoeuvrePath.points[manoeuvrePath.points.length - 2]);

        if (correctPatternHeading) {
            const h1 = (target.finalHeading + 90) % 360;
            const h2 = (target.finalHeading + 270) % 360;
            const d1 = norm(h1 - manoeuvreInitialHeading);
            const d2 = norm(h2 - manoeuvreInitialHeading);

            patternFinalHeading = d1 < d2 ? h1 : h2;
        } else {
            patternFinalHeading = manoeuvreInitialHeading;
        }
    }
    patternPath.setFinalHeading(patternFinalHeading);

    if (manoeuvrePath.points.length > 0 && patternPath.points.length > 0) {
        // Fix time and alt for pattern
        const m0 = { ...manoeuvrePath.points[manoeuvrePath.points.length - 1] };
        const p0 = { ...patternPath.points[0] };
        const timeOffset = p0.time - m0.time;
        const altOffset = p0.alt - m0.alt;

        for (let i = 0; i < patternPath.points.length; i++) {
            const p = patternPath.points[i];

            p.time = p.time - timeOffset;
            p.alt = p.alt - altOffset;
        }
    }

    return [
        ...manoeuvrePath.points.map(point => {
            return { ...point, phase: 'manoeuvre' };
        }),
        ...patternPath.points.map(point => {
            return { ...point, phase: 'pattern' };
        })
    ];

}

export function addWind(points, wind, interpolate) {
    if (!wind) {
        return points;
    }
    const turfPoints = toTurfPoints(points);
    const withWind = addWindTurf(turfPoints, wind, interpolate);

    return toFlipPoints(withWind);
}

export function averageWind(c1, c2) {
    if (c1.length <= 1) {
        return {};
    }

    const p1 = [ c1[c1.length -1].lng, c1[c1.length - 1].lat ];
    const p2 = [ c2[c2.length - 1].lng, c2[c2.length - 1].lat ];
    const distanceFt = turf.distance(p1, p2, { units: 'feet' });

    const seconds = (c1[0].time - c1[c1.length - 1].time) / 1000;
    const speedKts = (distanceFt / seconds) / ktsToFps;

    return { speedKts, direction: turf.bearing(p1, p2) };
}

export function mirror(points) {
    const turfPoints = toTurfPoints(points);
    const mirrored = mirrorTurf(turfPoints);

    return toFlipPoints(mirrored);
}

export function setManoeuvreAltitude(points, newAlt) {
    if (!points.length) {
        return;
    }

    const scale = newAlt / points[points.length - 1].alt;

    for (let i = 0; i < points.length; i++) {
        points[i].alt *= scale;
    }
}

// TODO: avoid this hack
function pathFromJson(pointsJson) {
    const points = [];

    for (let i = 0; i < pointsJson.length; i++) {
        const p = pointsJson[i];

        points.push(new Point(p.lat, p.lng, p.time, p.pom, p.alt));
    }

    return new Path(points);
}
