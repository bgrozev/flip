import { vi } from 'vitest';

import {
  SOURCE_DZ,
  SOURCE_MANUAL,
  SOURCE_OPEN_METEO,
  SOURCE_SOUNDING,
  forecastSourceLabel
} from '../../core/wind';
import { WIND_SOURCES, fetchForecast } from './index';
import { fetchOpenMeteo } from './openmeteo';

vi.mock('./openmeteo', () => {
  const mockFetch = vi.fn();

  return {
    fetchOpenMeteo: mockFetch,
    openMeteoSource: {
      id: 'open-meteo',
      label: 'OpenMeteo',
      kind: 'model-forecast',
      capabilities: {},
      fetch: mockFetch
    }
  };
});

describe('source constants', () => {
  it('defines all source constants', () => {
    expect(SOURCE_MANUAL).toBe('manual');
    expect(SOURCE_DZ).toBe('dropzone-specific');
    expect(SOURCE_OPEN_METEO).toBe('open-meteo');
    expect(SOURCE_SOUNDING).toBe('sounding');
  });
});

describe('forecastSourceLabel', () => {
  it('labels every known source', () => {
    expect(forecastSourceLabel(SOURCE_MANUAL)).toBe('set manually');
    expect(forecastSourceLabel(SOURCE_DZ)).toBe('observed conditions');
    expect(forecastSourceLabel(SOURCE_OPEN_METEO)).toBe('OpenMeteo');
    expect(forecastSourceLabel(SOURCE_SOUNDING)).toBe('sounding');
  });

  it('returns invalid for unknown source', () => {
    expect(forecastSourceLabel('unknown' as any)).toBe('invalid');
    expect(forecastSourceLabel(null as any)).toBe('invalid');
    expect(forecastSourceLabel(undefined as any)).toBe('invalid');
  });
});

describe('WIND_SOURCES registry', () => {
  it('contains conforming sources with unique ids', () => {
    const kinds = ['model-forecast', 'sounding', 'observed-station'];
    const ids = WIND_SOURCES.map(s => s.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(WIND_SOURCES.length).toBeGreaterThanOrEqual(4);

    for (const source of WIND_SOURCES) {
      expect(source.id).toBeTruthy();
      expect(source.label).toBeTruthy();
      expect(kinds).toContain(source.kind);
      expect(typeof source.fetch).toBe('function');
      expect(source.capabilities).toBeDefined();
    }
  });

  it('includes the OpenMeteo aloft source and the observed providers', () => {
    const byId = Object.fromEntries(WIND_SOURCES.map(s => [s.id, s]));

    expect(byId['open-meteo'].kind).toBe('model-forecast');
    expect(byId.nws.kind).toBe('observed-station');
    expect(byId.nws.capabilities.discovery).toBe(true);
    expect(byId.csc.kind).toBe('observed-station');
    expect(byId.spaceland.kind).toBe('observed-station');
  });
});

describe('fetchForecast', () => {
  const mockCenter = { lat: 33.5, lng: -112.0 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches to the OpenMeteo source with the given opts', async () => {
    const profile = { winds: [], aloftSource: SOURCE_OPEN_METEO, groundSource: SOURCE_OPEN_METEO };
    (fetchOpenMeteo as ReturnType<typeof vi.fn>).mockResolvedValue(profile);

    const controller = new AbortController();
    const result = await fetchForecast(mockCenter, { hourOffset: 6, signal: controller.signal });

    expect(fetchOpenMeteo).toHaveBeenCalledWith(
      mockCenter,
      { hourOffset: 6, signal: controller.signal }
    );
    expect(result).toBe(profile);
  });
});
