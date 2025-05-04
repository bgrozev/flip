import { Point, ktsToFps, pathFromJson } from './geo.js';

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

export function addWind(points, wind) {
    if (!wind) {
        return [];
    }
    const path = pathFromJson(points);

    path.addWind(wind, true);

    return path.points;
}

export function averageWind(c1, c2) {
    if (c1.length <= 1) {
        return {};
    }

    const p1 = new Point(c1[c1.length - 1].lat, c1[c1.length - 1].lng);
    const p2 = new Point(c2[c2.length - 1].lat, c2[c2.length - 1].lng);

    const seconds = (c1[0].time - c1[c1.length - 1].time) / 1000;
    const speedKts = (p1.distanceTo(p2) / seconds) / ktsToFps;

    return { speedKts, direction: p1.initialBearingTo(p2) };
}

export function mirror(points) {
    const path = pathFromJson(points);

    path.mirror();

    return path.points;
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
