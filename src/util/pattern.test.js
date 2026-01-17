import { makePattern } from './pattern.js';

describe('makePattern', () => {
    it('returns empty array when legs is empty', () => {
        const result = makePattern({ descentRateMph: 12, glideRatio: 2.6, legs: [] });

        expect(result).toEqual([]);
    });

    it('returns empty array when descentRateMph is falsy', () => {
        const result = makePattern({ descentRateMph: 0, glideRatio: 2.6, legs: [ { altitude: 300, direction: 90 } ] });

        expect(result).toEqual([]);
    });

    it('returns empty array when descentRateMph is not a number', () => {
        const result = makePattern({
            descentRateMph: 'twelve',
            glideRatio: 2.6,
            legs: [ { altitude: 300, direction: 90 } ]
        });

        expect(result).toEqual([]);
    });

    it('creates a pattern with single leg', () => {
        const result = makePattern({
            descentRateMph: 12,
            glideRatio: 2.6,
            legs: [ { altitude: 300, direction: 0 } ]
        });

        expect(result.length).toBeGreaterThan(1);

        // First point should be at origin with alt 0, time 0
        expect(result[0].geometry.coordinates).toEqual([ 0, 0 ]);
        expect(result[0].properties.alt).toBe(0);
        expect(result[0].properties.time).toBe(0);
        expect(result[0].properties.pom).toBe(0);

        // Last point should have altitude equal to leg altitude
        const lastPoint = result[result.length - 1];

        expect(lastPoint.properties.alt).toBeCloseTo(300, 0);
        expect(lastPoint.properties.pom).toBe(1);
    });

    it('creates points with negative time (going backwards)', () => {
        const result = makePattern({
            descentRateMph: 12,
            glideRatio: 2.6,
            legs: [ { altitude: 300, direction: 0 } ]
        });

        // All points after the first should have negative time
        for (let i = 1; i < result.length; i++) {
            expect(result[i].properties.time).toBeLessThan(0);
        }
    });

    it('increases altitude along the pattern', () => {
        const result = makePattern({
            descentRateMph: 12,
            glideRatio: 2.6,
            legs: [ { altitude: 300, direction: 0 } ]
        });

        // Altitude should increase as we go through the pattern
        for (let i = 1; i < result.length; i++) {
            expect(result[i].properties.alt).toBeGreaterThanOrEqual(result[i - 1].properties.alt);
        }
    });

    it('creates pattern with multiple legs', () => {
        const result = makePattern({
            descentRateMph: 12,
            glideRatio: 2.6,
            legs: [
                { altitude: 300, direction: 90 },
                { altitude: 300, direction: 90 },
                { altitude: 300, direction: 90 }
            ]
        });

        // Total altitude should be sum of all legs
        const lastPoint = result[result.length - 1];

        expect(lastPoint.properties.alt).toBeCloseTo(900, 0);
    });

    it('marks points of manoeuvre (pom) at leg transitions', () => {
        const result = makePattern({
            descentRateMph: 12,
            glideRatio: 2.6,
            legs: [
                { altitude: 300, direction: 90 },
                { altitude: 300, direction: 90 }
            ]
        });

        // Count POM markers
        const poms = result.filter(p => p.properties.pom === 1);

        expect(poms.length).toBeGreaterThanOrEqual(2);
    });

    it('respects descent rate for time calculations', () => {
        const slowResult = makePattern({
            descentRateMph: 6,
            glideRatio: 2.6,
            legs: [ { altitude: 300, direction: 0 } ]
        });

        const fastResult = makePattern({
            descentRateMph: 12,
            glideRatio: 2.6,
            legs: [ { altitude: 300, direction: 0 } ]
        });

        // Slower descent should take more time (more negative)
        const slowTime = slowResult[slowResult.length - 1].properties.time;
        const fastTime = fastResult[fastResult.length - 1].properties.time;

        expect(slowTime).toBeLessThan(fastTime);
    });

    it('respects glide ratio for horizontal distance', () => {
        const lowGlideResult = makePattern({
            descentRateMph: 12,
            glideRatio: 2.0,
            legs: [ { altitude: 300, direction: 0 } ]
        });

        const highGlideResult = makePattern({
            descentRateMph: 12,
            glideRatio: 3.0,
            legs: [ { altitude: 300, direction: 0 } ]
        });

        // Higher glide ratio should result in longer horizontal distance
        // We can check by comparing the latitude of the last point (heading north)
        const lowLat = lowGlideResult[lowGlideResult.length - 1].geometry.coordinates[1];
        const highLat = highGlideResult[highGlideResult.length - 1].geometry.coordinates[1];

        expect(highLat).toBeGreaterThan(lowLat);
    });

    it('handles leg direction changes', () => {
        const result = makePattern({
            descentRateMph: 12,
            glideRatio: 2.6,
            legs: [
                { altitude: 300, direction: 90 }, // Turn 90 degrees left before this leg
                { altitude: 300, direction: -90 } // Turn 90 degrees right before this leg
            ]
        });

        expect(result.length).toBeGreaterThan(1);

        // Pattern should complete without error
        const lastPoint = result[result.length - 1];

        expect(lastPoint.properties.alt).toBeCloseTo(600, 0);
    });
});
