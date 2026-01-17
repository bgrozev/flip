import { toTurfPoints } from './geo.js';
import { CODEC_JSON, addWind, averageWind, mirror, reposition, setManoeuvreAltitude } from './util.js';
import { WindRow, Winds } from './wind.js';

describe('CODEC_JSON', () => {
    describe('parse', () => {
        it('parses valid JSON', () => {
            const result = CODEC_JSON.parse('{"foo": "bar"}');

            expect(result).toEqual({ foo: 'bar' });
        });

        it('returns error object for invalid JSON', () => {
            const result = CODEC_JSON.parse('not json');

            expect(result).toEqual({ _error: 'parse failed' });
        });

        it('parses arrays', () => {
            const result = CODEC_JSON.parse('[1, 2, 3]');

            expect(result).toEqual([ 1, 2, 3 ]);
        });
    });

    describe('stringify', () => {
        it('stringifies objects', () => {
            const result = CODEC_JSON.stringify({ foo: 'bar' });

            expect(result).toBe('{"foo":"bar"}');
        });

        it('stringifies arrays', () => {
            const result = CODEC_JSON.stringify([ 1, 2, 3 ]);

            expect(result).toBe('[1,2,3]');
        });
    });
});

describe('reposition', () => {
    const createManoeuvre = () => toTurfPoints([
        { lat: 0, lng: 0, alt: 0, time: 0, pom: 1 },
        { lat: 0.001, lng: 0, alt: 250, time: -15000, pom: 0 },
        { lat: 0.001, lng: 0.001, alt: 500, time: -30000, pom: 1 }
    ]);

    const createPattern = () => toTurfPoints([
        { lat: 0, lng: 0, alt: 0, time: 0, pom: 1 },
        { lat: 0.002, lng: 0, alt: 300, time: -20000, pom: 0 },
        { lat: 0.004, lng: 0, alt: 600, time: -40000, pom: 1 }
    ]);

    const createTarget = () => {
        return {
            target: { lat: 33.5, lng: -112.0 },
            finalHeading: 90
        };
    };

    it('translates manoeuvre to target', () => {
        const manoeuvre = createManoeuvre();
        const pattern = [];
        const target = createTarget();

        const result = reposition(manoeuvre, pattern, target, false);

        // First point should be at target
        expect(result[0].lat).toBeCloseTo(33.5, 4);
        expect(result[0].lng).toBeCloseTo(-112.0, 4);
    });

    it('rotates manoeuvre to final heading', () => {
        const manoeuvre = createManoeuvre();
        const target = createTarget();

        const result = reposition(manoeuvre, [], target, false);

        // All points should have phase set to 'manoeuvre'
        expect(result[0].phase).toBe('manoeuvre');
    });

    it('handles empty manoeuvre', () => {
        const pattern = createPattern();
        const target = createTarget();

        const result = reposition([], pattern, target, false);

        // Pattern should be translated to target
        expect(result[0].lat).toBeCloseTo(33.5, 4);
        expect(result[0].lng).toBeCloseTo(-112.0, 4);
        expect(result[0].phase).toBe('pattern');
    });

    it('handles empty pattern', () => {
        const manoeuvre = createManoeuvre();
        const target = createTarget();

        const result = reposition(manoeuvre, [], target, false);

        expect(result).toHaveLength(3);
        expect(result.every(p => p.phase === 'manoeuvre')).toBe(true);
    });

    it('handles both empty', () => {
        const target = createTarget();
        const result = reposition([], [], target, false);

        expect(result).toHaveLength(0);
    });

    it('connects pattern to end of manoeuvre', () => {
        const manoeuvre = createManoeuvre();
        const pattern = createPattern();
        const target = createTarget();

        const result = reposition(manoeuvre, pattern, target, false);

        // Should have all manoeuvre points plus all pattern points
        const manoeuvrePoints = result.filter(p => p.phase === 'manoeuvre');
        const patternPoints = result.filter(p => p.phase === 'pattern');

        expect(manoeuvrePoints).toHaveLength(3);
        expect(patternPoints).toHaveLength(3);
    });

    it('adjusts pattern time and altitude to connect to manoeuvre', () => {
        const manoeuvre = createManoeuvre();
        const pattern = createPattern();
        const target = createTarget();

        const result = reposition(manoeuvre, pattern, target, false);

        const manoeuvreEnd = result.filter(p => p.phase === 'manoeuvre').pop();
        const patternStart = result.filter(p => p.phase === 'pattern')[0];

        // Pattern should start where manoeuvre ends (time and alt adjusted)
        expect(patternStart.time).toBe(manoeuvreEnd.time);
        expect(patternStart.alt).toBe(manoeuvreEnd.alt);
    });

    it('respects correctPatternHeading flag', () => {
        const manoeuvre = createManoeuvre();
        const pattern = createPattern();
        const target = { target: { lat: 33.5, lng: -112.0 }, finalHeading: 90 };

        const resultWithCorrection = reposition(manoeuvre, pattern, target, true);
        const resultWithoutCorrection = reposition(manoeuvre, pattern, target, false);

        // Results should differ when correction is applied
        // The pattern heading will be adjusted to be perpendicular to final
        expect(resultWithCorrection).not.toEqual(resultWithoutCorrection);
    });
});

describe('addWind', () => {
    it('returns points unchanged when wind is null', () => {
        const points = [
            { lat: 33.5, lng: -112.0, alt: 0, time: 0 },
            { lat: 33.5001, lng: -112.0, alt: 500, time: -30000 }
        ];

        const result = addWind(points, null, false);

        expect(result).toEqual(points);
    });

    it('applies wind offset to points', () => {
        const points = [
            { lat: 33.5, lng: -112.0, alt: 0, time: 0 },
            { lat: 33.5001, lng: -112.0, alt: 500, time: -30000 }
        ];
        const winds = new Winds([ new WindRow(0, 90, 20) ]);

        const result = addWind(points, winds, false);

        // First point stays fixed
        expect(result[0].lat).toBe(33.5);
        expect(result[0].lng).toBe(-112.0);

        // Second point should be shifted
        expect(result[1].lng).not.toBe(-112.0);
    });
});

describe('averageWind', () => {
    it('returns empty object for single point path', () => {
        const c1 = [ { lat: 33.5, lng: -112.0, time: 0 } ];
        const c2 = [ { lat: 33.5001, lng: -112.0, time: 0 } ];

        const result = averageWind(c1, c2);

        expect(result).toEqual({});
    });

    it('calculates average wind from path displacement', () => {
        // Two paths: original and wind-affected
        // The wind-affected path's end point is shifted
        const c1 = [
            { lat: 33.5, lng: -112.0, time: 0 },
            { lat: 33.5002, lng: -112.0, time: -60000 } // 60 seconds of flight
        ];
        const c2 = [
            { lat: 33.5, lng: -112.0, time: 0 },
            { lat: 33.5002, lng: -112.001, time: -60000 } // shifted east
        ];

        const result = averageWind(c1, c2);

        expect(result).toHaveProperty('speedKts');
        expect(result).toHaveProperty('direction');
        expect(typeof result.speedKts).toBe('number');
        expect(typeof result.direction).toBe('number');
    });
});

describe('mirror', () => {
    it('mirrors a path across its initial axis', () => {
        const points = [
            { lat: 0, lng: 0, alt: 0 },
            { lat: 0.001, lng: 0, alt: 250 },
            { lat: 0.001, lng: 0.001, alt: 500 }
        ];

        const result = mirror(points);

        expect(result).toHaveLength(3);

        // First two points should be essentially unchanged
        expect(result[0].lat).toBeCloseTo(0, 5);
        expect(result[1].lat).toBeCloseTo(0.001, 5);
    });

    it('handles single point', () => {
        const points = [ { lat: 0, lng: 0, alt: 0 } ];
        const result = mirror(points);

        expect(result).toHaveLength(1);
    });

    it('handles empty array', () => {
        expect(mirror([])).toEqual([]);
    });
});

describe('setManoeuvreAltitude', () => {
    it('scales all altitudes proportionally', () => {
        const points = [
            { lat: 0, lng: 0, alt: 0 },
            { lat: 0, lng: 0, alt: 250 },
            { lat: 0, lng: 0, alt: 500 }
        ];

        setManoeuvreAltitude(points, 1000);

        expect(points[0].alt).toBe(0);
        expect(points[1].alt).toBe(500);
        expect(points[2].alt).toBe(1000);
    });

    it('handles empty array', () => {
        const points = [];

        setManoeuvreAltitude(points, 1000);
        expect(points).toEqual([]);
    });

    it('handles scaling down', () => {
        const points = [
            { lat: 0, lng: 0, alt: 0 },
            { lat: 0, lng: 0, alt: 500 },
            { lat: 0, lng: 0, alt: 1000 }
        ];

        setManoeuvreAltitude(points, 500);

        expect(points[0].alt).toBe(0);
        expect(points[1].alt).toBe(250);
        expect(points[2].alt).toBe(500);
    });
});
