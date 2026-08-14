import { SOURCE_MANUAL, WindProfile } from './wind';

/**
 * Single "is this wind safe to plan a real jump on?" verdict, aggregating
 * the signals that were previously scattered (the flocking no-wind banner
 * and the top-bar "verify conditions" badge). Pure so it can be unit-tested
 * and reused by whatever surfaces it.
 *
 * Severity, most severe first:
 * - `none`  — no real forecast (pristine empty default / all calm manual).
 * - `manual`— hand-entered, inverted, or unlocked winds; not a live forecast.
 * - `stale` — a fetched forecast that is for a time well away from now, or
 *             was fetched a while ago; conditions may have moved on.
 * - `fresh` — a recent live forecast valid around now; nothing to warn about.
 */
export type WindTrustLevel = 'none' | 'manual' | 'stale' | 'fresh';

export interface WindTrust {
  level: WindTrustLevel;
  /** Why, for the display layer to turn into copy. */
  reason: 'empty' | 'manual' | 'future' | 'stale' | 'ok';
  /** Whole minutes since the forecast was fetched, when known. */
  fetchedMinsAgo?: number;
}

/** A forecast time this far ahead of now is "not current conditions". */
export const FUTURE_FORECAST_MS = 60 * 60 * 1000;
/** A fetch older than this (for a now-forecast) is considered stale. */
export const STALE_FETCH_MS = 30 * 60 * 1000;

export function windTrust(
  profile: WindProfile,
  forecastTime: Date | null,
  now: Date
): WindTrust {
  const hasRealWind =
    profile.winds.length > 0 && profile.winds.some(w => w.speedKts > 0);

  // No usable forecast: the empty default, a hand-cleared table, or all calm.
  if (!hasRealWind && profile.aloftSource === SOURCE_MANUAL) {
    return { level: 'none', reason: 'empty' };
  }
  if (profile.winds.length === 0) {
    return { level: 'none', reason: 'empty' };
  }

  // Real values, but the user owns them — hand-entered, inverted, unlocked.
  if (profile.aloftSource === SOURCE_MANUAL) {
    return { level: 'manual', reason: 'manual' };
  }

  // A fetched forecast: is it current?
  if (forecastTime && forecastTime.getTime() - now.getTime() > FUTURE_FORECAST_MS) {
    return { level: 'stale', reason: 'future' };
  }

  const fetchedAt = profile.meta?.fetchedAt;
  if (fetchedAt) {
    const ageMs = now.getTime() - fetchedAt.getTime();
    if (ageMs > STALE_FETCH_MS) {
      return {
        level: 'stale',
        reason: 'stale',
        fetchedMinsAgo: Math.round(ageMs / 60000)
      };
    }
  }

  return { level: 'fresh', reason: 'ok' };
}
