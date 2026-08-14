import { afterEach, beforeEach, vi } from 'vitest';

import { SOURCE_SOUNDING } from '../../core/wind';
import {
  fetchSoundingProfile,
  nearestStation,
  parseNetwork,
  resetSoundingNetwork,
  soundingSource,
  soundingToProfile,
  synopticCandidates
} from './soundings';

const TAMPA = { lat: 27.7, lng: -82.4 };

function networkGeojson() {
  return {
    features: [
      {
        properties: { sid: 'KTBW', sname: 'Tampa Bay Area FL/US', online: true },
        geometry: { coordinates: [-82.4, 27.7] }
      },
      {
        properties: { sid: 'KJAX', sname: 'Jacksonville FL/US', online: true },
        geometry: { coordinates: [-81.7, 30.5] }
      },
      {
        // offline — must be ignored
        properties: { sid: 'KOFF', sname: 'Offline', online: false },
        geometry: { coordinates: [-82.4, 27.7] }
      }
    ]
  };
}

function soundingResponse(valid: string) {
  return {
    profiles: [
      {
        station: 'KTBW',
        valid,
        profile: [
          { pres: 1019, hght: 13, tmpc: 28.2, dwpc: 21.2, drct: 355, sknt: 9 },
          { pres: 1000, hght: 180, tmpc: 26.2, dwpc: 19.2, drct: 325, sknt: 15 },
          { pres: 985, hght: 305, tmpc: 25.9, dwpc: 19.9, drct: null, sknt: null }, // no wind
          { pres: 952, hght: 610, tmpc: 24.3, dwpc: 20.1, drct: 320, sknt: 17 }
        ]
      }
    ]
  };
}

describe('soundingSource', () => {
  it('conforms to the WindSource interface as a discovery sounding source', () => {
    expect(soundingSource.id).toBe('sounding');
    expect(soundingSource.kind).toBe('sounding');
    expect(soundingSource.capabilities.discovery).toBe(true);
    expect(typeof soundingSource.fetch).toBe('function');
  });
});

describe('parseNetwork', () => {
  it('keeps online stations with coordinates and drops the rest', () => {
    const stations = parseNetwork(networkGeojson());

    expect(stations.map(s => s.id)).toEqual(['KTBW', 'KJAX']);
    expect(stations[0]).toEqual({ id: 'KTBW', name: 'Tampa Bay Area FL/US', lat: 27.7, lng: -82.4 });
  });

  it('tolerates malformed input', () => {
    expect(parseNetwork(null)).toEqual([]);
    expect(parseNetwork({})).toEqual([]);
    expect(parseNetwork({ features: [{}] })).toEqual([]);
  });
});

describe('nearestStation', () => {
  it('returns the closest station to the location', () => {
    const stations = parseNetwork(networkGeojson());

    expect(nearestStation(stations, TAMPA)?.id).toBe('KTBW');
    expect(nearestStation(stations, { lat: 30.4, lng: -81.8 })?.id).toBe('KJAX');
  });

  it('returns null for an empty network', () => {
    expect(nearestStation([], TAMPA)).toBeNull();
  });
});

describe('synopticCandidates', () => {
  it('yields the recent 00Z/12Z launches, newest first', () => {
    const now = Date.parse('2026-07-14T15:30:00Z');
    const times = synopticCandidates(now).map(d => d.toISOString());

    expect(times).toEqual([
      '2026-07-14T12:00:00.000Z',
      '2026-07-14T00:00:00.000Z',
      '2026-07-13T12:00:00.000Z'
    ]);
  });

  it('handles the pre-12Z window', () => {
    const now = Date.parse('2026-07-14T06:00:00Z');

    expect(synopticCandidates(now, 2).map(d => d.toISOString())).toEqual([
      '2026-07-14T00:00:00.000Z',
      '2026-07-13T12:00:00.000Z'
    ]);
  });
});

describe('soundingToProfile', () => {
  const station = { id: 'KTBW', name: 'Tampa Bay Area FL/US', lat: 27.7, lng: -82.4 };

  it('builds AGL rows from valid-wind levels only', () => {
    const profile = soundingToProfile(soundingResponse('2026-07-14T00:00:00Z'), station, TAMPA);

    expect(profile).not.toBeNull();
    // 3 of 4 levels have wind (305m level has null drct/sknt)
    expect(profile!.winds).toHaveLength(3);

    // Surface row is 0 AGL (hght 13m is the ground reference)
    expect(profile!.winds[0].altFt).toBe(0);
    expect(profile!.winds[0].direction).toBe(355);
    expect(profile!.winds[0].speedKts).toBe(9);
    expect(profile!.winds[0].source).toBe(SOURCE_SOUNDING);
    expect(profile!.winds[0].tempC).toBe(28.2);

    // 180m - 13m = 167m AGL
    expect(profile!.winds[1].altFt).toBeCloseTo(167 * 3.28084, 1);
    // 610m - 13m = 597m AGL (the 305m null-wind level was skipped)
    expect(profile!.winds[2].altFt).toBeCloseTo(597 * 3.28084, 1);
    expect(profile!.winds[2].speedKts).toBe(17);
  });

  it('records station attribution and launch time in meta', () => {
    const profile = soundingToProfile(soundingResponse('2026-07-14T00:00:00Z'), station, TAMPA);

    expect(profile!.aloftSource).toBe(SOURCE_SOUNDING);
    expect(profile!.validTime).toEqual(new Date('2026-07-14T00:00:00Z'));
    expect(profile!.meta?.station).toBe('KTBW');
    expect(profile!.meta?.stationName).toBe('Tampa Bay Area FL/US');
    expect(profile!.meta?.stationDistanceFt).toBeCloseTo(0, 0);
    // The station's own position, so the panel can re-measure the distance
    // against wherever the target is now — the fetched distance is from
    // wherever the profile happened to be fetched for, and a profile
    // outlives a move to another dropzone.
    expect(profile!.meta?.stationLocation).toEqual({ lat: station.lat, lng: station.lng });
  });

  it('returns null for an empty or wind-less sounding', () => {
    expect(soundingToProfile({ profiles: [] }, station, TAMPA)).toBeNull();
    expect(soundingToProfile({
      profiles: [{ station: 'KTBW', valid: '2026-07-14T00:00:00Z', profile: [
        { pres: 1000, hght: 100, tmpc: 20, dwpc: 10, drct: null, sknt: null }
      ] }]
    }, station, TAMPA)).toBeNull();
  });
});

describe('fetchSoundingProfile', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T15:30:00Z'));
    resetSoundingNetwork();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('discovers the nearest station and returns its latest sounding', async () => {
    const fetchSpy = vi.fn((url: string) => {
      const body = url.includes('RAOB.geojson')
        ? networkGeojson()
        : soundingResponse('2026-07-14T12:00:00Z');

      return Promise.resolve({ json: () => Promise.resolve(body) });
    });

    vi.stubGlobal('fetch', fetchSpy);

    const profile = await fetchSoundingProfile(TAMPA);

    expect(profile.aloftSource).toBe(SOURCE_SOUNDING);
    expect(profile.meta?.station).toBe('KTBW');
    // First sounding request targets the most recent synoptic hour (12Z)
    const soundingUrl = fetchSpy.mock.calls.map(c => c[0] as string).find(u => u.includes('raob.py'));

    expect(soundingUrl).toContain('station=KTBW');
    expect(soundingUrl).toContain('ts=20260714120000');
  });

  it('falls back to an earlier launch when the latest is not uploaded', async () => {
    const fetchSpy = vi.fn((url: string) => {
      if (url.includes('RAOB.geojson')) {
        return Promise.resolve({ json: () => Promise.resolve(networkGeojson()) });
      }
      // 12Z not available yet (empty), 00Z has data
      const body = url.includes('ts=20260714120000')
        ? { profiles: [] }
        : soundingResponse('2026-07-14T00:00:00Z');

      return Promise.resolve({ json: () => Promise.resolve(body) });
    });

    vi.stubGlobal('fetch', fetchSpy);

    const profile = await fetchSoundingProfile(TAMPA);

    expect(profile.validTime).toEqual(new Date('2026-07-14T00:00:00Z'));
  });

  it('caches the station network across calls', async () => {
    const fetchSpy = vi.fn((url: string) => {
      const body = url.includes('RAOB.geojson')
        ? networkGeojson()
        : soundingResponse('2026-07-14T12:00:00Z');

      return Promise.resolve({ json: () => Promise.resolve(body) });
    });

    vi.stubGlobal('fetch', fetchSpy);

    await fetchSoundingProfile(TAMPA);
    await fetchSoundingProfile(TAMPA);

    const networkCalls = fetchSpy.mock.calls.filter(c => (c[0] as string).includes('RAOB.geojson'));

    expect(networkCalls).toHaveLength(1);
  });
});
