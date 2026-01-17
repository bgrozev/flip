import * as turf from '@turf/turf';

import { createManoeuvrePath } from './manoeuvre.js';

describe('createManoeuvrePath', () => {
    it('creates a path with 3 points', () => {
        const result = createManoeuvrePath({
            offsetXFt: 500,
            offsetYFt: 1000,
            altitudeFt: 800,
            duration: 60,
            left: true
        });

        expect(result).toHaveLength(3);
    });

    it('sets correct altitude progression', () => {
        const result = createManoeuvrePath({
            offsetXFt: 500,
            offsetYFt: 1000,
            altitudeFt: 800,
            duration: 60,
            left: true
        });

        // Path is returned in reverse order: [p2, p1, p0]
        // p2 (end of manoeuvre) has alt 0
        // p1 (middle) has alt/2
        // p0 (start) has full altitude
        expect(result[0].properties.alt).toBe(0);
        expect(result[1].properties.alt).toBe(400);
        expect(result[2].properties.alt).toBe(800);
    });

    it('sets correct time progression', () => {
        const result = createManoeuvrePath({
            offsetXFt: 500,
            offsetYFt: 1000,
            altitudeFt: 800,
            duration: 60,
            left: true
        });

        // Path is in reverse, so times go from 0 to positive
        // p2 at time 60000 (60 sec * 1000), p1 at 30000, p0 at 0
        expect(result[0].properties.time).toBe(60000);
        expect(result[1].properties.time).toBe(30000);
        expect(result[2].properties.time).toBe(0);
    });

    it('marks POMs correctly', () => {
        const result = createManoeuvrePath({
            offsetXFt: 500,
            offsetYFt: 1000,
            altitudeFt: 800,
            duration: 60,
            left: true
        });

        // First point (p2) and last point (p0) should be POMs
        expect(result[0].properties.pom).toBe(1);
        expect(result[1].properties.pom).toBe(0);
        expect(result[2].properties.pom).toBe(1);
    });

    it('creates left turn when left=true', () => {
        const result = createManoeuvrePath({
            offsetXFt: 500,
            offsetYFt: 1000,
            altitudeFt: 800,
            duration: 60,
            left: true
        });

        // With left turn, p2 should be offset 90 degrees (east) from p1
        const p1 = result[1];
        const p2 = result[0];

        const bearing = turf.bearing(p1, p2);


        // Bearing should be approximately 90 (east) for left turn
        expect(Math.abs(bearing - 90) < 5 || Math.abs(bearing + 270) < 5).toBe(true);
    });

    it('creates right turn when left=false', () => {
        const result = createManoeuvrePath({
            offsetXFt: 500,
            offsetYFt: 1000,
            altitudeFt: 800,
            duration: 60,
            left: false
        });

        // With right turn, p2 should be offset 270 degrees (west) from p1
        const p1 = result[1];
        const p2 = result[0];

        const bearing = turf.bearing(p1, p2);


        // Bearing should be approximately 270 (west) or -90 for right turn
        expect(Math.abs(bearing - 270) < 5 || Math.abs(bearing + 90) < 5).toBe(true);
    });

    it('respects offsetYFt for forward/back offset', () => {
        const smallOffset = createManoeuvrePath({
            offsetXFt: 500,
            offsetYFt: 500,
            altitudeFt: 800,
            duration: 60,
            left: true
        });

        const largeOffset = createManoeuvrePath({
            offsetXFt: 500,
            offsetYFt: 2000,
            altitudeFt: 800,
            duration: 60,
            left: true
        });

        // Distance from start to middle point should be larger with larger offsetY
        const smallDist = turf.distance(smallOffset[2], smallOffset[1], { units: 'feet' });
        const largeDist = turf.distance(largeOffset[2], largeOffset[1], { units: 'feet' });

        expect(largeDist).toBeGreaterThan(smallDist);
    });

    it('respects offsetXFt for lateral offset', () => {
        const smallOffset = createManoeuvrePath({
            offsetXFt: 200,
            offsetYFt: 1000,
            altitudeFt: 800,
            duration: 60,
            left: true
        });

        const largeOffset = createManoeuvrePath({
            offsetXFt: 1000,
            offsetYFt: 1000,
            altitudeFt: 800,
            duration: 60,
            left: true
        });

        // Distance from middle to end point should be larger with larger offsetX
        const smallDist = turf.distance(smallOffset[1], smallOffset[0], { units: 'feet' });
        const largeDist = turf.distance(largeOffset[1], largeOffset[0], { units: 'feet' });

        expect(largeDist).toBeGreaterThan(smallDist);
    });

    it('enforces minimum 3ft offsetX to allow heading calculation', () => {
        const result = createManoeuvrePath({
            offsetXFt: 0,
            offsetYFt: 1000,
            altitudeFt: 800,
            duration: 60,
            left: true
        });

        // Even with offsetX=0, the path should have distinct last two points
        const dist = turf.distance(result[1], result[0], { units: 'feet' });

        expect(dist).toBeGreaterThanOrEqual(3);
    });

    it('handles different durations', () => {
        const short = createManoeuvrePath({
            offsetXFt: 500,
            offsetYFt: 1000,
            altitudeFt: 800,
            duration: 30,
            left: true
        });

        const long = createManoeuvrePath({
            offsetXFt: 500,
            offsetYFt: 1000,
            altitudeFt: 800,
            duration: 120,
            left: true
        });

        expect(short[0].properties.time).toBe(30000);
        expect(long[0].properties.time).toBe(120000);
    });
});
