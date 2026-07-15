import { afterEach, beforeEach, vi } from 'vitest';

import {
  elevationCacheKey,
  fetchElevationFt,
  migrateElevationCache
} from './elevation';

const POINT = { lat: 28.2192, lng: -82.1509 };
const M_TO_FT = 3.280839895;

/** Minimal localStorage stub backed by a Map. */
function fakeLocalStorage() {
  const map = new Map<string, string>();

  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    map
  };
}

function mockElevationFetch(elevationM: number) {
  return vi.fn(() => Promise.resolve({
    json: () => Promise.resolve({ elevation: [elevationM] })
  }));
}

describe('elevationCacheKey', () => {
  it('rounds to 3 decimal places', () => {
    expect(elevationCacheKey({ lat: 28.21923456, lng: -82.15087654 })).toBe('28.219,-82.151');
  });

  it('gives nearby points (~within 110m) the same key', () => {
    expect(elevationCacheKey({ lat: 28.21901, lng: -82.15099 }))
      .toBe(elevationCacheKey({ lat: 28.21939, lng: -82.15141 }));
  });

  it('gives distant points different keys', () => {
    expect(elevationCacheKey({ lat: 28.2192, lng: -82.1509 }))
      .not.toBe(elevationCacheKey({ lat: 28.23, lng: -82.1509 }));
  });
});

describe('migrateElevationCache', () => {
  it('accepts a valid cache document', () => {
    expect(migrateElevationCache({ '28.219,-82.151': 98.4 })).toEqual({ '28.219,-82.151': 98.4 });
  });

  it('drops garbage values and malformed keys', () => {
    expect(migrateElevationCache({
      '28.219,-82.151': 98.4,
      'not-a-key': 5,
      '1.000,2.000': 'high' as unknown as number,
      '3.000,4.000': NaN
    })).toEqual({ '28.219,-82.151': 98.4 });
  });

  it('returns empty for non-objects', () => {
    expect(migrateElevationCache(null)).toEqual({});
    expect(migrateElevationCache([1, 2])).toEqual({});
    expect(migrateElevationCache('junk')).toEqual({});
    expect(migrateElevationCache(undefined)).toEqual({});
  });
});

describe('fetchElevationFt', () => {
  let storage: ReturnType<typeof fakeLocalStorage>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = fakeLocalStorage();
    fetchSpy = mockElevationFetch(30);
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and converts to feet on a cache miss', async () => {
    const ft = await fetchElevationFt(POINT);

    expect(ft).toBeCloseTo(30 * M_TO_FT, 3);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('serves the second call from cache without fetching', async () => {
    const first = await fetchElevationFt(POINT);
    const second = await fetchElevationFt(POINT);

    expect(second).toBe(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('hits the cache for a nearby point (rounding)', async () => {
    await fetchElevationFt(POINT);
    await fetchElevationFt({ lat: POINT.lat + 0.0002, lng: POINT.lng - 0.0003 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('fetches again for a distant point', async () => {
    await fetchElevationFt(POINT);
    await fetchElevationFt({ lat: POINT.lat + 0.1, lng: POINT.lng });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('persists through the versioned envelope', async () => {
    await fetchElevationFt(POINT);

    const raw = JSON.parse(storage.map.get('flip.elevationCache')!);

    expect(raw.schemaVersion).toBe(1);
    expect(raw.doc[elevationCacheKey(POINT)]).toBeCloseTo(30 * M_TO_FT, 3);
  });

  it('recovers from corrupt stored data', async () => {
    storage.map.set('flip.elevationCache', '{not json');

    const ft = await fetchElevationFt(POINT);

    expect(ft).toBeCloseTo(30 * M_TO_FT, 3);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('works without localStorage (always fetches)', async () => {
    vi.stubGlobal('localStorage', undefined);

    await fetchElevationFt(POINT);
    await fetchElevationFt(POINT);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('bounds the cache size by evicting the oldest entries', async () => {
    // Pre-fill 500 entries
    const doc: Record<string, number> = {};

    for (let i = 0; i < 500; i++) {
      doc[`${(10 + i * 0.001).toFixed(3)},20.000`] = i;
    }
    storage.map.set('flip.elevationCache', JSON.stringify({ schemaVersion: 1, doc }));

    await fetchElevationFt(POINT);

    const raw = JSON.parse(storage.map.get('flip.elevationCache')!);
    const keys = Object.keys(raw.doc);

    expect(keys).toHaveLength(500);
    expect(raw.doc['10.000,20.000']).toBeUndefined(); // oldest evicted
    expect(raw.doc[elevationCacheKey(POINT)]).toBeDefined();
  });
});
