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

  it('fetches from OpenMeteo with default hour offset', async () => {
    const mockWinds = new Winds([new WindRow(0, 90, 10)]);
    (fetchOpenMeteo as jest.Mock).mockResolvedValue(mockWinds);

    const result = await fetchForecast(mockCenter);

    expect(fetchOpenMeteo).toHaveBeenCalledWith(mockCenter, 0, undefined);
    expect(result).toBe(mockWinds);
  });

  it('passes hour offset to OpenMeteo', async () => {
    const mockWinds = new Winds([new WindRow(0, 90, 10)]);
    (fetchOpenMeteo as jest.Mock).mockResolvedValue(mockWinds);

    const result = await fetchForecast(mockCenter, 6);

    expect(fetchOpenMeteo).toHaveBeenCalledWith(mockCenter, 6, undefined);
    expect(result).toBe(mockWinds);
  });

  it('passes abort signal to OpenMeteo', async () => {
    const mockWinds = new Winds([new WindRow(0, 90, 10)]);
    const controller = new AbortController();
    (fetchOpenMeteo as jest.Mock).mockResolvedValue(mockWinds);

    await fetchForecast(mockCenter, 0, controller.signal);

    expect(fetchOpenMeteo).toHaveBeenCalledWith(mockCenter, 0, controller.signal);
  });
});
