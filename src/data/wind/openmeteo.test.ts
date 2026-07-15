/* eslint-disable camelcase -- mock objects mirror the OpenMeteo API shape */
import { afterEach, beforeEach, vi } from 'vitest';

import { SOURCE_OPEN_METEO } from '../../core/wind';
import { fetchOpenMeteo, openMeteoSource, resetOpenMeteoPrefetch } from './openmeteo';

const HPAS = [
  1000, 975, 950, 925, 900, 875, 850, 825, 800, 775, 750, 725, 700, 675, 650, 625, 600
];

const POINT = { lat: 28.2192, lng: -82.1509 };

// All tests run at a fixed wall clock within hour 0, so a window starting
// at 2026-07-14T00:00 puts hour offset h at index h.
const NOW = new Date('2026-07-14T00:50:00Z');

/**
 * Build a recorded-shape GFS hourly response for `hours` hours starting at
 * 2026-07-14T00:00Z. Geopotential heights: 1000hPa at 110m rising 400m per
 * level; winds vary by level index and hour so tests can assert the right
 * hour was used.
 */
function gfsResponse(hours: number) {
  const timeFor = (h: number) => {
    const d = new Date(Date.UTC(2026, 6, 14, h));

    return d.toISOString().slice(0, 16);
  };

  const hourly: Record<string, unknown[]> = {
    time: Array.from({ length: hours }, (_, h) => timeFor(h)),
    wind_speed_10m: Array.from({ length: hours }, (_, h) => 5 + h),
    wind_direction_10m: Array.from({ length: hours }, (_, h) => 100 + h),
    wind_speed_80m: Array.from({ length: hours }, (_, h) => 8 + h),
    wind_direction_80m: Array.from({ length: hours }, (_, h) => 110 + h)
  };

  HPAS.forEach((hPa, i) => {
    hourly[`wind_speed_${hPa}hPa`] = Array.from({ length: hours }, (_, h) => 10 + i + h);
    hourly[`wind_direction_${hPa}hPa`] = Array.from({ length: hours }, (_, h) => 180 + i + h);
    hourly[`geopotential_height_${hPa}hPa`] = Array.from({ length: hours }, () => 110 + i * 400);
  });

  return { hourly };
}

function mockFetch(elevationM: number, gfs: unknown) {
  return vi.fn((url: string) => {
    const body = url.includes('/v1/elevation') ? { elevation: [elevationM] } : gfs;

    return Promise.resolve({ json: () => Promise.resolve(body) });
  });
}

function gfsCalls(fetchSpy: ReturnType<typeof vi.fn>): string[] {
  return fetchSpy.mock.calls.map(c => c[0] as string).filter(u => u.includes('/v1/gfs'));
}

describe('openMeteoSource', () => {
  it('conforms to the WindSource interface', () => {
    expect(openMeteoSource.id).toBe('open-meteo');
    expect(openMeteoSource.kind).toBe('model-forecast');
    expect(openMeteoSource.capabilities.hours).toBe(24);
    expect(typeof openMeteoSource.fetch).toBe('function');
  });
});

describe('fetchOpenMeteo', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    resetOpenMeteoPrefetch();
    fetchSpy = mockFetch(30, gfsResponse(24));
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('builds a profile with 10m, 80m and pressure-level rows above ground', async () => {
    const profile = await fetchOpenMeteo(POINT);

    // 10m and 80m rows first
    expect(profile.winds[0].altFt).toBeCloseTo(32.8, 0);
    expect(profile.winds[0].speedKts).toBe(5);
    expect(profile.winds[1].altFt).toBeCloseTo(262.5, 0);
    expect(profile.winds[1].speedKts).toBe(8);

    // Elevation is 30m = ~98ft; the 1000hPa level at 110m clears the >80ft
    // AGL cut, so all 17 levels are included
    expect(profile.winds).toHaveLength(2 + 17);
    expect(profile.winds[2].altFt).toBeCloseTo((110 - 30) * 3.28084, 0);
    expect(profile.winds[2].speedKts).toBe(10);
    expect(profile.winds[2].direction).toBe(180);
  });

  it('drops pressure levels at or below ground level', async () => {
    // Elevation 600m: the 1000hPa level (110m) and 975hPa (510m) fall below
    // the 80ft AGL cut; 950hPa at 910m stays
    fetchSpy = mockFetch(600, gfsResponse(24));
    vi.stubGlobal('fetch', fetchSpy);

    const profile = await fetchOpenMeteo(POINT);

    expect(profile.winds).toHaveLength(2 + 15);
    expect(profile.winds[2].speedKts).toBe(12); // 950hPa row (level index 2)
  });

  it('tags every row with source and validTime', async () => {
    const profile = await fetchOpenMeteo(POINT);

    for (const row of profile.winds) {
      expect(row.source).toBe(SOURCE_OPEN_METEO);
      expect(row.validTime).toEqual(new Date('2026-07-14T00:00Z'));
    }
  });

  it('sets profile sources, validTime and meta', async () => {
    const profile = await fetchOpenMeteo(POINT);

    expect(profile.aloftSource).toBe(SOURCE_OPEN_METEO);
    expect(profile.groundSource).toBe(SOURCE_OPEN_METEO);
    expect(profile.validTime).toEqual(new Date('2026-07-14T00:00Z'));
    expect(profile.meta?.location).toEqual(POINT);
    expect(profile.meta?.elevationFt).toBeCloseTo(30 * 3.28084, 3);
    expect(profile.meta?.fetchedAt).toBeInstanceOf(Date);
  });

  it('uses the requested hour offset', async () => {
    const profile = await fetchOpenMeteo(POINT, { hourOffset: 3 });

    expect(profile.winds[0].speedKts).toBe(8); // 10m speed at hour 3
    expect(profile.validTime).toEqual(new Date('2026-07-14T03:00Z'));
  });

  describe('multi-hour prefetch', () => {
    it('prefetches a full day in one request', async () => {
      await fetchOpenMeteo(POINT);

      expect(gfsCalls(fetchSpy)).toHaveLength(1);
      expect(gfsCalls(fetchSpy)[0]).toContain('forecast_hours=24');
    });

    it('rounds the window up to whole days for far hours, capped at 7 days', async () => {
      await fetchOpenMeteo(POINT, { hourOffset: 30 });
      expect(gfsCalls(fetchSpy)[0]).toContain('forecast_hours=48');

      resetOpenMeteoPrefetch();
      await fetchOpenMeteo(POINT, { hourOffset: 500 });
      expect(gfsCalls(fetchSpy)[1]).toContain('forecast_hours=168');
    });

    it('switches hours locally within the prefetched window', async () => {
      await fetchOpenMeteo(POINT);
      const profile = await fetchOpenMeteo(POINT, { hourOffset: 5 });

      expect(gfsCalls(fetchSpy)).toHaveLength(1); // no second request
      expect(profile.winds[0].speedKts).toBe(10); // 10m speed at hour 5
      expect(profile.validTime).toEqual(new Date('2026-07-14T05:00Z'));
    });

    it('re-aligns indices when the clock crosses an hour boundary', async () => {
      await fetchOpenMeteo(POINT);

      // 15 minutes later (within the TTL) it is 01:05Z; "now" (offset 0)
      // is window index 1
      vi.setSystemTime(new Date('2026-07-14T01:05:00Z'));
      const profile = await fetchOpenMeteo(POINT);

      expect(gfsCalls(fetchSpy)).toHaveLength(1);
      expect(profile.validTime).toEqual(new Date('2026-07-14T01:00Z'));
      expect(profile.winds[0].speedKts).toBe(6);
    });

    it('refetches for hours beyond the window', async () => {
      await fetchOpenMeteo(POINT);
      await fetchOpenMeteo(POINT, { hourOffset: 30 });

      expect(gfsCalls(fetchSpy)).toHaveLength(2);
      expect(gfsCalls(fetchSpy)[1]).toContain('forecast_hours=48');
    });

    it('refetches when the target moves too far', async () => {
      await fetchOpenMeteo(POINT);
      await fetchOpenMeteo({ lat: POINT.lat + 0.1, lng: POINT.lng });

      expect(gfsCalls(fetchSpy)).toHaveLength(2);
    });

    it('keeps serving the window for small target nudges', async () => {
      await fetchOpenMeteo(POINT);
      await fetchOpenMeteo({ lat: POINT.lat + 0.0005, lng: POINT.lng });

      expect(gfsCalls(fetchSpy)).toHaveLength(1);
    });

    it('expires the window after the TTL', async () => {
      await fetchOpenMeteo(POINT);

      vi.setSystemTime(new Date(NOW.getTime() + 31 * 60 * 1000));
      await fetchOpenMeteo(POINT);

      expect(gfsCalls(fetchSpy)).toHaveLength(2);
    });

    it('bypasses the window when forceRefresh is set', async () => {
      await fetchOpenMeteo(POINT);
      await fetchOpenMeteo(POINT, { forceRefresh: true });

      expect(gfsCalls(fetchSpy)).toHaveLength(2);
    });
  });
});
