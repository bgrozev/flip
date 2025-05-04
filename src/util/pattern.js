import { Point, mphToFps } from '../util/geo.js';

export function makePattern({ descentRateMph = 12, glideRatio = 2.6, legs = [] }) {
    const points = [];

    if (legs.length === 0 || !descentRateMph || !(typeof descentRateMph === 'number')) {
        return points;
    }

    const p0 = new Point(29.77, -97.77, 0, 0, 0);

    points.push(p0);

    let heading = 0;

    for (let i = 0; i < legs.length; i++) {
        addLeg(points, descentRateMph, glideRatio, legs[i], heading);
        points[points.length - 1].pom = 1;
        if (i < legs.length - 1) {
            heading = heading - legs[i + 1].direction;
        }
    }

    return points;
}

function addLeg(points, descentRateMph, glideRatio, leg, heading) {
    const stepTms = 1000;
    const stepVft = descentRateMph * mphToFps * stepTms / 1000;
    const stepHft = stepVft * glideRatio;

    let addedVft = 0;

    while (addedVft + stepVft <= leg.altitude) {
        const p = points[points.length - 1].copy();

        p.pom = false;
        p.alt += stepVft;
        p.time -= stepTms;
        p.translate(heading, stepHft);
        addedVft += stepVft;

        points.push(p);
    }
    if (addedVft < leg.altitude) {
        const remVft = leg.altitude - addedVft;
        const remHft = remVft * glideRatio;
        const remTms = Math.round(1000 * (remVft / (descentRateMph * mphToFps)));
        const p = points[points.length - 1].copy();

        p.alt += remVft;
        p.time -= remTms;
        p.translate(heading, remHft);

        points.push(p);
    }
}
