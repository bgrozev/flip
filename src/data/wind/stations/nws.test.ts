import { afterEach, vi } from 'vitest';

import { fetchNwsStationById, fetchNwsStations, nwsSource } from './nws';

// ZHills-ish target
const LAT = 28.2192;
const LNG = -82.1509;

/** ~0.01 deg latitude is ~3646 ft — keep test stations well within 10 mi. */
const NEAR = { lat: LAT + 0.01, lng: LNG };
const FAR = { lat: LAT + 1, lng: LNG }; // ~69 miles

interface MockStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

function pointsResponse() {
  return {
    properties: {
      observationStations: 'https://api.weather.gov/gridpoints/TBW/60,72/stations'
    }
  };
}

function stationsResponse(stations: MockStation[]) {
  return {
    features: stations.map(s => ({
      geometry: { coordinates: [s.lng, s.lat] },
      properties: { stationIdentifier: s.id, name: s.name }
    }))
  };
}

function observation(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: '2026-07-14T15:53:00Z',
    windDirection: { value: 90 },
    windSpeed: { value: 18.52 }, // km/h → 10 kts
    windGust: { value: null },
    temperature: { value: 30 },
    dewpoint: { value: 22 },
    seaLevelPressure: { value: 101500 },
    visibility: { value: 16000 },
    cloudLayers: [{ amount: 'SCT', base: { value: 1200 } }],
    ...overrides
  };
}

function observationsResponse(observations: unknown[]) {
  return { features: observations.map(properties => ({ properties })) };
}

/** Mock the NWS fetch chain: /points → stations list → per-station observations. */
function mockNws(
  stations: MockStation[],
  observationsById: Record<string, unknown[]>,
  stationMeta?: MockStation
) {
  return vi.fn((url: string) => {
    let body: unknown;

    if (url.includes('/points/')) {
      body = pointsResponse();
    } else if (url.endsWith('/stations')) {
      body = stationsResponse(stations);
    } else if (url.includes('/observations')) {
      const id = url.split('/stations/')[1].split('/')[0];

      body = observationsResponse(observationsById[id] ?? []);
    } else if (url.includes('/stations/')) {
      // station metadata (by-id lookup)
      const s = stationMeta;

      body = s
        ? { geometry: { coordinates: [s.lng, s.lat] }, properties: { name: s.name } }
        : {};
    }

    return Promise.resolve({ ok: body !== undefined, json: () => Promise.resolve(body) });
  });
}

describe('nwsSource', () => {
  it('conforms to the WindSource interface with discovery capability', () => {
    expect(nwsSource.id).toBe('nws');
    expect(nwsSource.kind).toBe('observed-station');
    expect(nwsSource.capabilities.discovery).toBe(true);
    expect(typeof nwsSource.fetch).toBe('function');
  });
});

describe('fetchNwsStations', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('discovers stations near a location and parses observations', async () => {
    vi.stubGlobal('fetch', mockNws(
      [{ id: 'KZPH', name: 'Zephyrhills Municipal', ...NEAR }],
      { KZPH: [observation()] }
    ));

    const stations = await fetchNwsStations(LAT, LNG, 10 * 5280);

    expect(stations).toHaveLength(1);
    const s = stations[0];

    expect(s.id).toBe('nws-KZPH');
    expect(s.source).toBe('NWS');
    expect(s.wind.direction).toBe(90);
    expect(s.wind.speedKts).toBeCloseTo(10, 3);
    expect(s.observedAt).toEqual(new Date('2026-07-14T15:53:00Z'));
    expect(s.temperatureC).toBe(30);
    expect(s.distanceFt).toBeGreaterThan(0);
    expect(s.distanceFt).toBeLessThan(10 * 5280);
  });

  it('filters out stations beyond the range', async () => {
    vi.stubGlobal('fetch', mockNws(
      [
        { id: 'KZPH', name: 'Near', ...NEAR },
        { id: 'KFAR', name: 'Far', ...FAR }
      ],
      { KZPH: [observation()], KFAR: [observation()] }
    ));

    const stations = await fetchNwsStations(LAT, LNG, 10 * 5280);

    expect(stations.map(s => s.id)).toEqual(['nws-KZPH']);
  });

  it('skips partial observations with null wind and uses the next one', async () => {
    vi.stubGlobal('fetch', mockNws(
      [{ id: 'KZPH', name: 'Zephyrhills', ...NEAR }],
      {
        KZPH: [
          observation({ windDirection: { value: null } }),
          observation({ windDirection: { value: 270 } })
        ]
      }
    ));

    const stations = await fetchNwsStations(LAT, LNG, 10 * 5280);

    expect(stations).toHaveLength(1);
    expect(stations[0].wind.direction).toBe(270);
  });

  it('drops stations with no valid observations at all', async () => {
    vi.stubGlobal('fetch', mockNws(
      [{ id: 'KZPH', name: 'Zephyrhills', ...NEAR }],
      { KZPH: [observation({ windSpeed: { value: null } })] }
    ));

    const stations = await fetchNwsStations(LAT, LNG, 10 * 5280);

    expect(stations).toHaveLength(0);
  });

  it('sorts results by distance', async () => {
    vi.stubGlobal('fetch', mockNws(
      [
        { id: 'KTWO', name: 'Two', lat: LAT + 0.02, lng: LNG },
        { id: 'KONE', name: 'One', ...NEAR }
      ],
      { KONE: [observation()], KTWO: [observation()] }
    ));

    const stations = await fetchNwsStations(LAT, LNG, 10 * 5280);

    expect(stations.map(s => s.id)).toEqual(['nws-KONE', 'nws-KTWO']);
  });
});

describe('fetchNwsStationById', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches metadata then observations for a specific station', async () => {
    const meta = { id: 'KZPH', name: 'Zephyrhills Municipal', ...NEAR };

    vi.stubGlobal('fetch', mockNws([], { KZPH: [observation()] }, meta));

    const station = await fetchNwsStationById('KZPH', LAT, LNG);

    expect(station?.id).toBe('nws-KZPH');
    expect(station?.name).toBe('Zephyrhills Municipal');
    expect(station?.wind.speedKts).toBeCloseTo(10, 3);
  });
});
