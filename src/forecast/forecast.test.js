/* eslint-env jest */
import { WindRow, Winds } from '../util/wind.js';

import {
    SOURCE_DZ,
    SOURCE_MANUAL,
    SOURCE_OPEN_METEO,
    SOURCE_WINDS_ALOFT,
    fetchForecast,
    forecastSourceLabel
} from './forecast.js';
import { fetchOpenMeteo } from './openmeteo.js';
import { fetchWindsAloft } from './windsaloft.js';

// Mock the fetch functions
jest.mock('./openmeteo.js', () => {
    return {
        fetchOpenMeteo: jest.fn()
    };
});

jest.mock('./windsaloft.js', () => {
    return {
        fetchWindsAloft: jest.fn()
    };
});

describe('Source Constants', () => {
    it('defines all source constants', () => {
        expect(SOURCE_MANUAL).toBe('manual');
        expect(SOURCE_WINDS_ALOFT).toBe('winds-aloft');
        expect(SOURCE_DZ).toBe('dropzone-specific');
        expect(SOURCE_OPEN_METEO).toBe('open-meteo');
    });
});

describe('forecastSourceLabel', () => {
    it('returns correct label for manual source', () => {
        expect(forecastSourceLabel(SOURCE_MANUAL)).toBe('set manually');
    });

    it('returns correct label for dropzone-specific source', () => {
        expect(forecastSourceLabel(SOURCE_DZ)).toBe('observed conditions');
    });

    it('returns correct label for winds aloft source', () => {
        expect(forecastSourceLabel(SOURCE_WINDS_ALOFT)).toBe('WindsAloft');
    });

    it('returns correct label for open meteo source', () => {
        expect(forecastSourceLabel(SOURCE_OPEN_METEO)).toBe('OpenMeteo GFS');
    });

    it('returns invalid for unknown source', () => {
        expect(forecastSourceLabel('unknown')).toBe('invalid');
        expect(forecastSourceLabel(null)).toBe('invalid');
        expect(forecastSourceLabel(undefined)).toBe('invalid');
    });
});

describe('fetchForecast', () => {
    const mockCenter = { lat: 33.5, lng: -112.0 };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('fetches from OpenMeteo when source is open-meteo', async () => {
        const mockWinds = new Winds([ new WindRow(0, 90, 10) ]);

        fetchOpenMeteo.mockResolvedValue(mockWinds);

        const result = await fetchForecast(SOURCE_OPEN_METEO, mockCenter, null);

        expect(fetchOpenMeteo).toHaveBeenCalledWith(mockCenter);
        expect(fetchWindsAloft).not.toHaveBeenCalled();
        expect(result).toBe(mockWinds);
    });

    it('fetches from WindsAloft when source is winds-aloft', async () => {
        const mockWinds = new Winds([ new WindRow(0, 180, 15) ]);

        fetchWindsAloft.mockResolvedValue(mockWinds);

        const result = await fetchForecast(SOURCE_WINDS_ALOFT, mockCenter, null);

        expect(fetchWindsAloft).toHaveBeenCalledWith(mockCenter, 0);
        expect(fetchOpenMeteo).not.toHaveBeenCalled();
        expect(result).toBe(mockWinds);
    });

    it('fetches ground wind when fetchDzGroundWind is provided', async () => {
        const mockWinds = new Winds([ new WindRow(0, 90, 10), new WindRow(1000, 180, 20) ]);
        const mockGroundWind = new WindRow(0, 270, 5);
        const mockFetchGroundWind = jest.fn().mockResolvedValue(mockGroundWind);

        fetchOpenMeteo.mockResolvedValue(mockWinds);

        const result = await fetchForecast(SOURCE_OPEN_METEO, mockCenter, mockFetchGroundWind);

        expect(mockFetchGroundWind).toHaveBeenCalled();
        expect(result.winds[0].direction).toBe(270);
        expect(result.winds[0].speedKts).toBe(5);
        expect(result.groundSource).toBe(SOURCE_DZ);
    });

    it('continues without ground wind if fetch fails', async () => {
        const mockWinds = new Winds([ new WindRow(0, 90, 10) ]);
        const mockFetchGroundWind = jest.fn().mockRejectedValue(new Error('Network error'));

        fetchOpenMeteo.mockResolvedValue(mockWinds);

        // Spy on console.log to verify error is logged
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { /* noop */ });

        const result = await fetchForecast(SOURCE_OPEN_METEO, mockCenter, mockFetchGroundWind);

        expect(result).toBe(mockWinds);
        expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch DZ winds, continue without.');

        consoleSpy.mockRestore();
    });

    it('does not set ground source when ground wind fetch returns null', async () => {
        const mockWinds = new Winds([ new WindRow(0, 90, 10) ]);
        const mockFetchGroundWind = jest.fn().mockResolvedValue(null);

        fetchOpenMeteo.mockResolvedValue(mockWinds);

        const result = await fetchForecast(SOURCE_OPEN_METEO, mockCenter, mockFetchGroundWind);

        expect(result.groundSource).toBe(SOURCE_MANUAL);
    });

    it('returns null for unknown forecast source', async () => {
        const result = await fetchForecast('unknown', mockCenter, null);

        expect(fetchOpenMeteo).not.toHaveBeenCalled();
        expect(fetchWindsAloft).not.toHaveBeenCalled();

        // Result will be null since no fetch was made
        expect(result).toBeNull();
    });
});
