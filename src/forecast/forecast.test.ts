/* eslint-env jest */
import { WindRow, Winds } from '../util/wind';

import {
  SOURCE_DZ,
  SOURCE_MANUAL,
  SOURCE_OPEN_METEO,
  fetchForecast,
  forecastSourceLabel
} from './forecast';
import { fetchOpenMeteo } from './openmeteo';

// Mock the fetch functions
jest.mock('./openmeteo', () => ({
  fetchOpenMeteo: jest.fn()
}));

describe('Source Constants', () => {
  it('defines all source constants', () => {
    expect(SOURCE_MANUAL).toBe('manual');
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

  it('returns correct label for open meteo source', () => {
    expect(forecastSourceLabel(SOURCE_OPEN_METEO)).toBe('OpenMeteo GFS');
  });

  it('returns invalid for unknown source', () => {
    expect(forecastSourceLabel('unknown' as any)).toBe('invalid');
    expect(forecastSourceLabel(null as any)).toBe('invalid');
    expect(forecastSourceLabel(undefined as any)).toBe('invalid');
  });
});

describe('fetchForecast', () => {
  const mockCenter = { lat: 33.5, lng: -112.0 };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches from OpenMeteo', async () => {
    const mockWinds = new Winds([new WindRow(0, 90, 10)]);
    (fetchOpenMeteo as jest.Mock).mockResolvedValue(mockWinds);

    const result = await fetchForecast(mockCenter, undefined);

    expect(fetchOpenMeteo).toHaveBeenCalledWith(mockCenter, 0, undefined);
    expect(result).toBe(mockWinds);
  });

  it('fetches ground wind when fetchDzGroundWind is provided', async () => {
    const mockWinds = new Winds([new WindRow(0, 90, 10), new WindRow(1000, 180, 20)]);
    const mockGroundWind = new WindRow(0, 270, 5);
    const mockFetchGroundWind = jest.fn().mockResolvedValue(mockGroundWind);

    (fetchOpenMeteo as jest.Mock).mockResolvedValue(mockWinds);

    const result = await fetchForecast(mockCenter, mockFetchGroundWind);

    expect(mockFetchGroundWind).toHaveBeenCalled();
    expect(result.winds[0].direction).toBe(270);
    expect(result.winds[0].speedKts).toBe(5);
    expect(result.groundSource).toBe(SOURCE_DZ);
  });

  it('continues without ground wind if fetch fails', async () => {
    const mockWinds = new Winds([new WindRow(0, 90, 10)]);
    const mockFetchGroundWind = jest.fn().mockRejectedValue(new Error('Network error'));

    (fetchOpenMeteo as jest.Mock).mockResolvedValue(mockWinds);

    // Spy on console.log to verify error is logged
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => { /* noop */ });

    const result = await fetchForecast(mockCenter, mockFetchGroundWind);

    expect(result).toBe(mockWinds);
    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch DZ winds, continue without.');

    consoleSpy.mockRestore();
  });

  it('does not set ground source when ground wind fetch returns null', async () => {
    const mockWinds = new Winds([new WindRow(0, 90, 10)]);
    const mockFetchGroundWind = jest.fn().mockResolvedValue(null);

    (fetchOpenMeteo as jest.Mock).mockResolvedValue(mockWinds);

    const result = await fetchForecast(mockCenter, mockFetchGroundWind);

    expect(result.groundSource).toBe(SOURCE_MANUAL);
  });
});
