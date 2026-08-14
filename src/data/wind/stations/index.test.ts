import { vi } from 'vitest';

import { ObservedWindStation } from '../../../types';
import {
  OBSERVED_STATION_SOURCES,
  fetchObservedStations,
  nearestGroundWindStation
} from './index';
import { fetchNwsStationById } from './nws';

// West Tennessee Skydiving (Bolivar) — a dropzone with a supplemental station
// list: KM08's AWOS is not returned by NWS gridpoint discovery, so it has to be
// fetched by id. (ZHills used to serve this role, but KZPH *is* discovered.)
const BOLIVAR = { lat: 35.22037, lng: -89.18982 };
// ZHills — a dropzone with no supplement (KZPH comes from discovery)
const ZHILLS = { lat: 28.2192, lng: -82.1509 };
// Middle of the Gulf — no DZ, no site feeds
const NOWHERE = { lat: 27.0, lng: -88.0 };

function station(id: string, distanceFt: number, source = 'NWS'): ObservedWindStation {
  return {
    id,
    name: id,
    source,
    lat: 0,
    lng: 0,
    distanceFt,
    observedAt: new Date('2026-07-14T15:00:00Z'),
    wind: { direction: 90, speedKts: 10 }
  };
}

vi.mock('./nws', () => ({
  nwsSource: {
    id: 'nws',
    label: 'National Weather Service',
    kind: 'observed-station',
    capabilities: { discovery: true },
    fetch: vi.fn()
  },
  fetchNwsStationById: vi.fn()
}));

vi.mock('./csc', () => ({
  cscSource: {
    id: 'csc',
    label: 'CSC',
    kind: 'observed-station',
    capabilities: {},
    fetch: vi.fn().mockResolvedValue([])
  }
}));

vi.mock('./spaceland', () => ({
  spacelandSource: {
    id: 'spaceland',
    label: 'Spaceland',
    kind: 'observed-station',
    capabilities: {},
    fetch: vi.fn().mockResolvedValue([])
  }
}));

function nwsFetchMock() {
  const nws = OBSERVED_STATION_SOURCES.find(s => s.id === 'nws')!;

  return nws.fetch as ReturnType<typeof vi.fn>;
}

describe('fetchObservedStations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('takes a location, not a dropzone: discovery works anywhere', async () => {
    nwsFetchMock().mockResolvedValue([station('nws-KAAA', 5000)]);
    (fetchNwsStationById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const stations = await fetchObservedStations(NOWHERE);

    expect(nwsFetchMock()).toHaveBeenCalledWith(NOWHERE);
    expect(stations.map(s => s.id)).toEqual(['nws-KAAA']);
    // No dropzone near the middle of the Gulf → no supplemental lookups
    expect(fetchNwsStationById).not.toHaveBeenCalled();
  });

  it('adds supplemental DZ-listed stations and dedupes against discovery', async () => {
    nwsFetchMock().mockResolvedValue([
      station('nws-KM08', 3000),
      station('nws-KMKL', 40000)
    ]);
    (fetchNwsStationById as ReturnType<typeof vi.fn>).mockResolvedValue(station('nws-KM08', 3000));

    const stations = await fetchObservedStations(BOLIVAR);

    // KM08 appears once even though both the supplement and discovery found it
    expect(stations.filter(s => s.id === 'nws-KM08')).toHaveLength(1);
    expect(fetchNwsStationById).toHaveBeenCalledWith('KM08', BOLIVAR.lat, BOLIVAR.lng);
  });

  it('does not look up supplements for a dropzone that lists none', async () => {
    nwsFetchMock().mockResolvedValue([station('nws-KZPH', 3000)]);

    const stations = await fetchObservedStations(ZHILLS);

    // ZHills relies purely on discovery — no by-id supplement fetch
    expect(stations.map(s => s.id)).toEqual(['nws-KZPH']);
    expect(fetchNwsStationById).not.toHaveBeenCalled();
  });

  it('sorts merged results by distance', async () => {
    nwsFetchMock().mockResolvedValue([
      station('nws-KFAR', 50000),
      station('nws-KNEAR', 1000)
    ]);
    (fetchNwsStationById as ReturnType<typeof vi.fn>).mockResolvedValue(station('nws-KM08', 2000));

    const stations = await fetchObservedStations(BOLIVAR);

    expect(stations.map(s => s.id)).toEqual(['nws-KNEAR', 'nws-KM08', 'nws-KFAR']);
  });

  it('survives individual source failures', async () => {
    nwsFetchMock().mockRejectedValue(new Error('NWS down'));
    (fetchNwsStationById as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('also down'));

    const stations = await fetchObservedStations(ZHILLS);

    expect(stations).toEqual([]);
  });
});

describe('nearestGroundWindStation', () => {
  it('returns the nearest station within 2 miles', () => {
    const s1 = station('a', 1000);
    const s2 = station('b', 5000);

    expect(nearestGroundWindStation([s1, s2])).toBe(s1);
  });

  it('returns null when no station is close enough', () => {
    expect(nearestGroundWindStation([station('a', 3 * 5280)])).toBeNull();
    expect(nearestGroundWindStation([])).toBeNull();
  });
});
