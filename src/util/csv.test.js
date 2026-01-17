/* eslint-env jest */

import { convertFromGnss, extractPathFromCsv, trim } from './csv.js';

// Mock console.log to prevent test output noise
beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => { /* noop */ });
});

afterEach(() => {
    console.log.mockRestore();
});

describe('extractPathFromCsv', () => {
    it('returns empty array for null input', () => {
        expect(extractPathFromCsv(null)).toEqual([]);
    });

    it('returns empty array for empty input', () => {
        expect(extractPathFromCsv([])).toEqual([]);
    });

    it('extracts path from CSV data', () => {
        const csv = [
            { lat: '33.5', lon: '-112.0', time: '2024-01-01T12:00:00Z', hMSL: 500, pom: false },
            { lat: '33.5001', lon: '-112.0', time: '2024-01-01T12:00:10Z', hMSL: 400, pom: false },
            { lat: '33.5002', lon: '-112.0', time: '2024-01-01T12:00:20Z', hMSL: 300, pom: true }
        ];

        const result = extractPathFromCsv(csv);

        // Result should skip the first row and reverse
        expect(result).toHaveLength(2);
    });

    it('converts lat/lon to numbers', () => {
        const csv = [
            { lat: '33.5', lon: '-112.0', time: '2024-01-01T12:00:00Z', hMSL: 500, pom: false },
            { lat: '33.5001', lon: '-112.001', time: '2024-01-01T12:00:10Z', hMSL: 400, pom: false }
        ];

        const result = extractPathFromCsv(csv);

        expect(typeof result[0].lat).toBe('number');
        expect(typeof result[0].lng).toBe('number');
    });

    it('converts hMSL to altitude in feet relative to final elevation', () => {
        const csv = [
            { lat: '33.5', lon: '-112.0', time: '2024-01-01T12:00:00Z', hMSL: 500, pom: false },
            { lat: '33.5001', lon: '-112.0', time: '2024-01-01T12:00:10Z', hMSL: 400, pom: false },
            { lat: '33.5002', lon: '-112.0', time: '2024-01-01T12:00:20Z', hMSL: 300, pom: false }
        ];

        const result = extractPathFromCsv(csv);

        // Final elevation is 300m, so last point should have 0 altitude
        // The path is reversed, so first in result is last in original
        expect(result[0].alt).toBe(0); // 300 - 300 = 0
        expect(result[1].alt).toBeCloseTo((400 - 300) * 3.28084, 2); // ~328 ft
    });

    it('reverses the path order', () => {
        const csv = [
            { lat: '33.5', lon: '-112.0', time: '2024-01-01T12:00:00Z', hMSL: 500, pom: false },
            { lat: '33.5001', lon: '-112.0', time: '2024-01-01T12:00:10Z', hMSL: 400, pom: false },
            { lat: '33.5002', lon: '-112.0', time: '2024-01-01T12:00:20Z', hMSL: 300, pom: false }
        ];

        const result = extractPathFromCsv(csv);

        // Path should be reversed - last CSV point becomes first
        expect(result[0].lat).toBe(33.5002);
    });

    it('converts time to milliseconds', () => {
        const csv = [
            { lat: '33.5', lon: '-112.0', time: '2024-01-01T12:00:00Z', hMSL: 500, pom: false },
            { lat: '33.5001', lon: '-112.0', time: '2024-01-01T12:00:10Z', hMSL: 400, pom: false }
        ];

        const result = extractPathFromCsv(csv);

        expect(typeof result[0].time).toBe('number');
        expect(result[0].time).toBeGreaterThan(0);
    });

    it('preserves pom flag', () => {
        const csv = [
            { lat: '33.5', lon: '-112.0', time: '2024-01-01T12:00:00Z', hMSL: 500, pom: false },
            { lat: '33.5001', lon: '-112.0', time: '2024-01-01T12:00:10Z', hMSL: 400, pom: true },
            { lat: '33.5002', lon: '-112.0', time: '2024-01-01T12:00:20Z', hMSL: 300, pom: false }
        ];

        const result = extractPathFromCsv(csv);

        // After reversal, the middle point with pom:true should be at index 1
        const pomPoint = result.find(p => p.pom === true);

        expect(pomPoint).toBeDefined();
    });
});

describe('trim', () => {
    it('handles null input', () => {
        expect(trim(null, 1000)).toBeUndefined();
    });

    it('handles short input', () => {
        const csv = [ { hMSL: 500 } ];

        expect(trim(csv, 1000)).toBeUndefined();
    });

    it('trims points above startAltitude', () => {
        const csv = [
            { hMSL: 600 }, // header row
            { hMSL: 600 }, // ~1640 ft AGL - above 1000, should be trimmed
            { hMSL: 500 }, // ~1312 ft AGL - above 1000, should be trimmed
            { hMSL: 350 }, // ~820 ft AGL - below 1000, first kept
            { hMSL: 200 }, // ~328 ft AGL
            { hMSL: 100 } // 0 ft AGL
        ];

        trim(csv, 1000);

        // Should have trimmed high altitude points
        expect(csv.length).toBeLessThan(6);
    });

    it('trims points below 10 ft at the end', () => {
        const csv = [
            { hMSL: 100 }, // header
            { hMSL: 100 }, // index 1
            { hMSL: 50 }, // ~0 ft AGL, should be trimmed
            { hMSL: 50 }, // ~0 ft AGL, should be trimmed
            { hMSL: 50 } // ~0 ft AGL, final elevation reference
        ];

        trim(csv, 200);

        // Low altitude points at the end should be trimmed
        expect(csv.length).toBeLessThanOrEqual(3);
    });
});

describe('convertFromGnss', () => {
    it('returns data unchanged if not GNSS format', () => {
        const data = 'lat,lon,time\n33.5,-112.0,2024-01-01';

        expect(convertFromGnss(data)).toBe(data);
    });

    it('converts GNSS format to standard CSV format', () => {
        const gnssData = `$FLYS,some header
$COL,lat,lon,hMSL,time
$UNIT,deg,deg,m,s
$GNSS,33.5,-112.0,500,0
$GNSS,33.5001,-112.0,400,10
$OTHER,ignored`;

        const result = convertFromGnss(gnssData);

        // Should have filtered to only $COL, $UNIT, and $GNSS lines
        expect(result).not.toContain('$FLYS');
        expect(result).not.toContain('$OTHER');

        // Should have removed prefixes
        expect(result).not.toContain('$COL,');
        expect(result).not.toContain('$UNIT,');

        // Should contain the data
        expect(result).toContain('lat,lon,hMSL,time');
        expect(result).toContain('$GNSS,33.5,-112.0,500,0');
    });

    it('preserves $GNSS prefix on data lines', () => {
        const gnssData = `$FLYS,header
$COL,lat,lon
$GNSS,33.5,-112.0`;

        const result = convertFromGnss(gnssData);

        // $GNSS lines keep their prefix (they'll be parsed separately)
        expect(result).toContain('$GNSS,33.5,-112.0');
    });
});
