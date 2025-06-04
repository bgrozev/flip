import * as turf from '@turf/turf';
import { mphToFps, toFlipPoints } from '../util/geo.js';

export function makePattern({ descentRateMph = 12, glideRatio = 2.6, legs = [] }) {
    const points = [];

    if (legs.length === 0 || !descentRateMph || !(typeof descentRateMph === 'number')) {
        return points;
    }

    const p0 = turf.point([ 0, 0 ]);
    p0.properties.alt = 0;
    p0.properties.time = 0;
    p0.properties.pom = 0;

    points.push(p0);

    let heading = 0;

    for (let i = 0; i < legs.length; i++) {
        addLeg(points, descentRateMph, glideRatio, legs[i], heading);
        points[points.length - 1].properties.pom = 1;
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
        const p = turf.clone(points[points.length - 1]);

        p.properties.pom = false;
        p.properties.alt += stepVft;
        p.properties.time -= stepTms;
        addedVft += stepVft;

        points.push(turf.transformTranslate(p, stepHft, heading, { units: 'feet' }));
    }
    if (addedVft < leg.altitude) {
        const remVft = leg.altitude - addedVft;
        const remHft = remVft * glideRatio;
        const remTms = Math.round(1000 * (remVft / (descentRateMph * mphToFps)));
        const p = turf.clone(points[points.length - 1]);

        p.properties.alt += remVft;
        p.properties.time -= remTms;

        points.push(turf.transformTranslate(p, remHft, heading, { units: 'feet' }));
    }
}
