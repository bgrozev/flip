import * as turf from '@turf/turf';
import { ktsToFps, toTurfPoint, toTurfPoints, toFlipPoints, mirrorTurf, addWindTurf, normalizeBearing, translateTurf, setFinalHeadingTurf } from './geo.js';

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
    let manoeuvrePoints = manoeuvre;
    let patternPoints = pattern;
    const turfTarget = toTurfPoint(target.target);

    function norm(x) {
        return Math.abs(((x + 540) % 360) - 180);
    }

    manoeuvrePoints = translateTurf(manoeuvrePoints, turfTarget);
    manoeuvrePoints = setFinalHeadingTurf(manoeuvrePoints, target.finalHeading);

    let patternTarget = (manoeuvrePoints.length > 0) ? manoeuvrePoints[manoeuvrePoints.length - 1] : turfTarget;
    patternPoints = translateTurf(patternPoints, patternTarget);

    let patternFinalHeading = target.finalHeading;

    if (manoeuvrePoints.length > 1) {
        const manoeuvreInitialHeading
            = normalizeBearing(turf.bearing(
                manoeuvrePoints[manoeuvrePoints.length - 1],
                manoeuvrePoints[manoeuvrePoints.length - 2]
            ));

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

    patternPoints = setFinalHeadingTurf(patternPoints, patternFinalHeading);

    if (manoeuvrePoints.length > 0 && patternPoints.length > 0) {
        // Fix time and alt for pattern
        const m0 = { ...manoeuvrePoints[manoeuvrePoints.length - 1] };
        const p0 = { ...patternPoints[0] };
        const timeOffset = p0.properties.time - m0.properties.time;
        const altOffset = p0.properties.alt - m0.properties.alt;

        for (let i = 0; i < patternPoints.length; i++) {
            const p = patternPoints[i];

            p.properties.time = p.properties.time - timeOffset;
            p.properties.alt = p.properties.alt - altOffset;
        }
    }

    const merged = [
        ...manoeuvrePoints.map(point => {
            point.properties.phase = 'manoeuvre';
            return point;
        }),
        ...patternPoints.map(point => {
            point.properties.phase = 'pattern';
            return point;
        })
    ];
    return toFlipPoints(merged);
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
