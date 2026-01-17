import * as turf from '@turf/turf';

import {
    addWindTurf,
    initialBearing,
    ktsToFps,
    metersToFeet,
    mirrorTurf,
    mphToFps,
    normalizeBearing,
    setFinalHeading,
    setFinalHeadingTurf,
    toFlipPoints,
    toTurfPoint,
    toTurfPoints,
    translate,
    translateTurf
} from './geo.js';
import { WindRow, Winds } from './wind.js';


describe('Constants', () => {
    it('metersToFeet is approximately correct', () => {
        expect(metersToFeet).toBeCloseTo(3.28084, 4);
    });

    it('ktsToFps converts knots to feet per second', () => {
        // 1 knot = 1.68781 fps
        expect(ktsToFps).toBeCloseTo(1.68781, 4);
    });

    it('mphToFps converts mph to fps', () => {
        // 5280 feet / 3600 seconds = 1.4667 fps per mph
        expect(mphToFps).toBeCloseTo(1.4667, 3);
    });
});

describe('toTurfPoint', () => {
    it('converts a flip point to turf point', () => {
        const flipPoint = { lat: 33.5, lng: -112.0 };
        const turfPoint = toTurfPoint(flipPoint);

        expect(turfPoint.geometry.type).toBe('Point');
        expect(turfPoint.geometry.coordinates).toEqual([ -112.0, 33.5 ]);
    });

    it('preserves additional properties', () => {
        const flipPoint = {
            lat: 33.5,
            lng: -112.0,
            alt: 1000,
            time: 5000,
            pom: true,
            phase: 'pattern'
        };
        const turfPoint = toTurfPoint(flipPoint);

        expect(turfPoint.properties.alt).toBe(1000);
        expect(turfPoint.properties.time).toBe(5000);
        expect(turfPoint.properties.pom).toBe(true);
        expect(turfPoint.properties.phase).toBe('pattern');
    });
});

describe('toTurfPoints', () => {
    it('converts an array of flip points', () => {
        const flipPoints = [
            { lat: 33.5, lng: -112.0, alt: 0 },
            { lat: 33.6, lng: -112.1, alt: 1000 }
        ];
        const turfPoints = toTurfPoints(flipPoints);

        expect(turfPoints).toHaveLength(2);
        expect(turfPoints[0].geometry.coordinates).toEqual([ -112.0, 33.5 ]);
        expect(turfPoints[1].geometry.coordinates).toEqual([ -112.1, 33.6 ]);
    });

    it('handles empty array', () => {
        expect(toTurfPoints([])).toEqual([]);
    });
});

describe('toFlipPoints', () => {
    it('converts turf points back to flip points', () => {
        const turfPoints = [
            turf.point([ -112.0, 33.5 ], { alt: 0, time: 0 }),
            turf.point([ -112.1, 33.6 ], { alt: 1000, time: -5000 })
        ];
        const flipPoints = toFlipPoints(turfPoints);

        expect(flipPoints).toHaveLength(2);
        expect(flipPoints[0].lat).toBe(33.5);
        expect(flipPoints[0].lng).toBe(-112.0);
        expect(flipPoints[0].alt).toBe(0);
        expect(flipPoints[1].lat).toBe(33.6);
        expect(flipPoints[1].lng).toBe(-112.1);
    });
});

describe('normalizeBearing', () => {
    it('returns bearing unchanged when in 0-360 range', () => {
        expect(normalizeBearing(0)).toBe(0);
        expect(normalizeBearing(90)).toBe(90);
        expect(normalizeBearing(180)).toBe(180);
        expect(normalizeBearing(359)).toBe(359);
    });

    it('normalizes negative bearings', () => {
        expect(normalizeBearing(-90)).toBe(270);
        expect(normalizeBearing(-180)).toBe(180);
        expect(normalizeBearing(-270)).toBe(90);
        expect(normalizeBearing(-360)).toBe(0);
    });

    it('normalizes bearings over 360', () => {
        expect(normalizeBearing(360)).toBe(0);
        expect(normalizeBearing(450)).toBe(90);
        expect(normalizeBearing(720)).toBe(0);
    });
});

describe('translateTurf', () => {
    it('returns empty array for empty input', () => {
        const result = translateTurf([], turf.point([ 0, 0 ]));

        expect(result).toEqual([]);
    });

    it('moves single point to target', () => {
        const points = [ turf.point([ 0, 0 ], { alt: 0 }) ];
        const target = turf.point([ -112.0, 33.5 ]);
        const result = translateTurf(points, target);

        expect(result).toHaveLength(1);
        expect(result[0].geometry.coordinates[0]).toBeCloseTo(-112.0, 5);
        expect(result[0].geometry.coordinates[1]).toBeCloseTo(33.5, 5);
    });

    it('preserves relative positions when translating', () => {
        // Create two points 1000 feet apart
        const p1 = turf.point([ 0, 0 ], { alt: 0 });
        const p2 = turf.transformTranslate(turf.point([ 0, 0 ]), 1000, 0, { units: 'feet' });

        p2.properties = { alt: 500 };

        const target = turf.point([ -112.0, 33.5 ]);
        const result = translateTurf([ p1, p2 ], target);

        // Distance between translated points should still be ~1000 feet
        const distance = turf.distance(result[0], result[1], { units: 'feet' });

        expect(distance).toBeCloseTo(1000, -1);
    });
});

describe('translate', () => {
    it('handles empty array', () => {
        const result = translate([], { lat: 33.5, lng: -112.0 });

        expect(result).toEqual([]);
    });

    it('translates flip points to target', () => {
        const points = [
            { lat: 0, lng: 0, alt: 0 },
            { lat: 0.01, lng: 0, alt: 500 }
        ];
        const target = { lat: 33.5, lng: -112.0 };
        const result = translate(points, target);

        expect(result[0].lat).toBeCloseTo(33.5, 5);
        expect(result[0].lng).toBeCloseTo(-112.0, 5);
    });
});

describe('setFinalHeadingTurf', () => {
    it('returns unchanged for less than 2 points', () => {
        const single = [ turf.point([ 0, 0 ]) ];

        expect(setFinalHeadingTurf(single, 90)).toEqual(single);
        expect(setFinalHeadingTurf([], 90)).toEqual([]);
    });

    it('rotates points to achieve final heading', () => {
        // Create points with initial heading of 0 (north)
        const p1 = turf.point([ 0, 0 ], { alt: 0 });
        const p2 = turf.point([ 0, 0.01 ], { alt: 500 }); // north of p1

        const result = setFinalHeadingTurf([ p1, p2 ], 90);

        // After rotation, bearing from p2 to p1 should be 90 (east)
        const newBearing = turf.bearing(result[1], result[0]);

        expect(normalizeBearing(newBearing)).toBeCloseTo(90, 0);
    });
});

describe('setFinalHeading', () => {
    it('handles less than 2 points', () => {
        expect(setFinalHeading([], 90)).toEqual([]);
        expect(setFinalHeading([ { lat: 0, lng: 0 } ], 90)).toEqual([ { lat: 0, lng: 0 } ]);
    });
});

describe('initialBearing', () => {
    it('calculates bearing between two points', () => {
        const p1 = { lat: 33.5, lng: -112.0 };
        const p2 = { lat: 33.6, lng: -112.0 }; // due north

        const bearing = initialBearing(p1, p2);

        expect(bearing).toBeCloseTo(0, 0);
    });

    it('returns normalized bearing', () => {
        const p1 = { lat: 33.5, lng: -112.0 };
        const p2 = { lat: 33.4, lng: -112.0 }; // due south

        const bearing = initialBearing(p1, p2);

        expect(bearing).toBeCloseTo(180, 0);
    });
});

describe('mirrorTurf', () => {
    it('returns unchanged for less than 2 points', () => {
        const single = [ turf.point([ 0, 0 ]) ];

        expect(mirrorTurf(single)).toEqual(single);
        expect(mirrorTurf([])).toEqual([]);
    });

    it('keeps first two points unchanged', () => {
        const p1 = turf.point([ 0, 0 ], { alt: 0 });
        const p2 = turf.point([ 0, 0.001 ], { alt: 100 });
        const p3 = turf.point([ 0.001, 0.002 ], { alt: 200 });

        const result = mirrorTurf([ p1, p2, p3 ]);

        expect(result[0].geometry.coordinates).toEqual(p1.geometry.coordinates);
        expect(result[1].geometry.coordinates).toEqual(p2.geometry.coordinates);
    });

    it('mirrors third point across the axis defined by first two points', () => {
        // Create a simple L-shape: 0,0 -> 0,1 -> 1,1
        const p1 = turf.point([ 0, 0 ], { alt: 0 });
        const p2 = turf.transformTranslate(turf.clone(p1), 1000, 0, { units: 'feet' });

        p2.properties = { alt: 500 };
        const p3 = turf.transformTranslate(turf.clone(p2), 1000, 90, { units: 'feet' });

        p3.properties = { alt: 1000 };

        const result = mirrorTurf([ p1, p2, p3 ]);

        // The mirrored p3 should be on the opposite side
        // Original goes right (east), mirrored should go left (west)
        const originalBearing = turf.bearing(p1, p3);
        const mirroredBearing = turf.bearing(result[0], result[2]);

        // Bearings should be reflections across the center axis
        expect(Math.abs(mirroredBearing - originalBearing)).toBeGreaterThan(1);
    });
});

describe('addWindTurf', () => {
    it('returns unchanged for 0 or 1 points', () => {
        const winds = new Winds([ new WindRow(0, 90, 10) ]);

        expect(addWindTurf([], winds, false)).toEqual([]);

        const single = [ turf.point([ 0, 0 ], { alt: 0, time: 0 }) ];
        const result = addWindTurf(single, winds, false);

        expect(result).toHaveLength(1);
    });

    it('keeps first point fixed (landing point)', () => {
        const winds = new Winds([ new WindRow(0, 90, 20) ]);
        const p1 = turf.point([ -112.0, 33.5 ], { alt: 0, time: 0 });
        const p2 = turf.point([ -112.0, 33.5001 ], { alt: 500, time: -30000 });

        const result = addWindTurf([ p1, p2 ], winds, false);

        expect(result[0].geometry.coordinates[0]).toBe(-112.0);
        expect(result[0].geometry.coordinates[1]).toBe(33.5);
    });

    it('offsets earlier points based on wind', () => {
        const winds = new Winds([ new WindRow(0, 90, 20) ]); // 20 knots from east
        const p1 = turf.point([ -112.0, 33.5 ], { alt: 0, time: 0 });
        const p2 = turf.point([ -112.0, 33.5001 ], { alt: 500, time: -30000 }); // 30 seconds earlier

        const result = addWindTurf([ p1, p2 ], winds, false);

        // Second point should be shifted east (wind direction 90)
        expect(result[1].geometry.coordinates[0]).toBeGreaterThan(-112.0);
    });

    it('accumulates wind offset over multiple points', () => {
        const winds = new Winds([ new WindRow(0, 90, 20) ]);
        const p1 = turf.point([ -112.0, 33.5 ], { alt: 0, time: 0 });
        const p2 = turf.point([ -112.0, 33.5001 ], { alt: 250, time: -15000 });
        const p3 = turf.point([ -112.0, 33.5002 ], { alt: 500, time: -30000 });

        const result = addWindTurf([ p1, p2, p3 ], winds, false);

        // Each subsequent point should be offset more
        const offset2 = result[1].geometry.coordinates[0] - -112.0;
        const offset3 = result[2].geometry.coordinates[0] - -112.0;

        expect(offset3).toBeGreaterThan(offset2);
    });

    it('uses altitude-appropriate wind when winds vary', () => {
        const winds = new Winds([
            new WindRow(0, 90, 5),
            new WindRow(1000, 270, 20)
        ]);

        const p1 = turf.point([ -112.0, 33.5 ], { alt: 0, time: 0 });
        const p2 = turf.point([ -112.0, 33.5001 ], { alt: 500, time: -30000 });
        const p3 = turf.point([ -112.0, 33.5002 ], { alt: 1500, time: -60000 });

        const result = addWindTurf([ p1, p2, p3 ], winds, false);

        // Points are processed - we just verify it doesn't crash and returns correct length
        expect(result).toHaveLength(3);
    });
});
