import { describe, expect, it } from 'vitest';

import {
  createWindProfile,
  createWindRow,
  SOURCE_DZ,
  SOURCE_OPEN_METEO,
  WindProfile
} from './wind';
import { FUTURE_FORECAST_MS, STALE_FETCH_MS, windTrust } from './windTrust';

const NOW = new Date('2026-07-22T12:00:00Z');

function fetched(rows: [number, number, number][], fetchedAt: Date): WindProfile {
  return {
    winds: rows.map(([a, d, s]) => createWindRow(a, d, s)),
    groundSource: SOURCE_OPEN_METEO,
    aloftSource: SOURCE_OPEN_METEO,
    validTime: NOW,
    meta: { fetchedAt }
  };
}

describe('windTrust', () => {
  it('flags the pristine empty default as none/empty', () => {
    expect(windTrust(createWindProfile(), null, NOW)).toEqual({
      level: 'none',
      reason: 'empty'
    });
  });

  it('flags an all-calm manual table as none', () => {
    const calm = createWindProfile([createWindRow(0, 0, 0), createWindRow(1000, 0, 0)]);
    expect(windTrust(calm, null, NOW).level).toBe('none');
  });

  it('flags hand-entered / unlocked winds (manual source, real values) as manual', () => {
    const manual = createWindProfile([createWindRow(0, 200, 8)]);
    expect(windTrust(manual, null, NOW)).toEqual({ level: 'manual', reason: 'manual' });
  });

  it('treats a fresh fetched forecast as fresh', () => {
    const p = fetched([[0, 200, 8]], new Date(NOW.getTime() - 5 * 60000));
    expect(windTrust(p, null, NOW)).toEqual({ level: 'fresh', reason: 'ok' });
  });

  it('is fresh even for a fetched but calm forecast (not "none")', () => {
    const p = fetched([[0, 0, 0], [3000, 0, 0]], new Date(NOW.getTime() - 60000));
    expect(windTrust(p, null, NOW).level).toBe('fresh');
  });

  it('flags a forecast time well in the future as stale/future', () => {
    const p = fetched([[0, 200, 8]], NOW);
    const future = new Date(NOW.getTime() + FUTURE_FORECAST_MS + 60000);
    expect(windTrust(p, future, NOW)).toEqual({ level: 'stale', reason: 'future' });
  });

  it('flags an old fetch (for now) as stale with the age in minutes', () => {
    const old = new Date(NOW.getTime() - STALE_FETCH_MS - 10 * 60000);
    const p = fetched([[0, 200, 8]], old);
    const t = windTrust(p, null, NOW);
    expect(t.level).toBe('stale');
    expect(t.reason).toBe('stale');
    expect(t.fetchedMinsAgo).toBe(40);
  });

  it('keeps an observed (DZ) ground forecast fresh', () => {
    const p: WindProfile = {
      ...fetched([[0, 200, 8]], new Date(NOW.getTime() - 60000)),
      groundSource: SOURCE_DZ
    };
    expect(windTrust(p, null, NOW).level).toBe('fresh');
  });
});
