import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import { useCallback, useMemo, useRef, useState } from 'react';

import { fetchForecast } from '../data/wind';
import { LatLng, Settings } from '../types';
import { SCHEMA_VERSION, migrateStoredWinds } from '../core/model';
import { WindProfile, createWindProfile } from '../core/wind';
import { createVersionedCodec } from '../util/storage';

/**
 * Persisted wind profile (fetched or manual) — a reload must not lose
 * manual edits or the last forecast. The migrate function revives the
 * profile's Dates from their JSON string form; null = nothing usable stored.
 */
const WINDS_CODEC = createVersionedCodec<WindProfile | null>(
  SCHEMA_VERSION,
  migrateStoredWinds
);

interface UseFetchForecastOptions {
  /** Current target location */
  target: LatLng | undefined;
  /** Settings for wind fetching */
  settings: Pick<Settings, 'limitWind' | 'windModel' | 'windAloftSource'>;
}

/** Error from the most recent failed fetch. A fresh object per failure so
 *  consumers can react to consecutive identical failures. */
export interface FetchWindsError {
  message: string;
}

interface UseFetchForecastResult {
  /** Current wind data */
  winds: WindProfile;
  /** Whether a fetch is in progress */
  fetching: boolean;
  /** Set when the last fetch failed; cleared when a fetch succeeds. */
  error: FetchWindsError | null;
  /**
   * Fetch winds for the current target. Pass maxPathAltitude to extend limit
   * if path goes higher; force bypasses the prefetch cache (explicit refresh).
   */
  fetchWinds: (maxPathAltitude?: number, forecastTime?: Date | null, opts?: { force?: boolean }) => void;
  /** Manually set winds (for manual entry) */
  setWinds: (winds: WindProfile) => void;
  /** Reset winds to empty state */
  resetWinds: () => void;
}

/**
 * Hook to manage wind forecast fetching (aloft winds only).
 * Ground wind injection from observed stations is handled in App.tsx.
 */
export function useFetchForecast({
  target,
  settings
}: UseFetchForecastOptions): UseFetchForecastResult {
  // Winds survive reloads: persisted under a versioned key, restored on load
  const [storedWinds, setStoredWinds] = useLocalStorageState<WindProfile | null>(
    'flip.winds',
    null,
    { codec: WINDS_CODEC }
  );
  const winds = useMemo(() => storedWinds ?? createWindProfile(), [storedWinds]);
  const setWinds = useCallback(
    (profile: WindProfile) => setStoredWinds(profile),
    [setStoredWinds]
  );
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<FetchWindsError | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetWinds = useCallback(() => {
    setStoredWinds(null);
  }, [setStoredWinds]);

  const fetchWinds = useCallback((maxPathAltitude?: number, forecastTime?: Date | null, opts?: { force?: boolean }) => {
    if (!target) {
      console.log('Not fetching winds, no target');
      return;
    }

    const hourOffset = forecastTime
      ? Math.max(0, Math.round((forecastTime.getTime() - Date.now()) / 3600000))
      : 0;

    console.log(`Fetching winds for: ${JSON.stringify(target)}, hourOffset=${hourOffset}`);

    // Abort any in-flight request before starting a new one
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setFetching(true);

    fetchForecast(target, {
      hourOffset,
      model: settings.windModel,
      aloftSource: settings.windAloftSource,
      signal: controller.signal,
      forceRefresh: opts?.force
    })
      .then(fetchedWinds => {
        // Determine altitude limit
        let limit = settings.limitWind;
        if (maxPathAltitude !== undefined && maxPathAltitude > limit) {
          limit = maxPathAltitude;
        }

        // Filter winds to altitude limit
        setWinds({
          ...fetchedWinds,
          winds: fetchedWinds.winds.filter(w => w.altFt <= limit)
        });
        setError(null);
        setFetching(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          // A newer fetch superseded this one — leave fetching=true and winds unchanged
          return;
        }
        console.log(`Failed to fetch winds: ${err}`);
        // Keep the previous profile — do not wipe the table on a failed fetch
        setError({ message: err instanceof Error ? err.message : String(err) });
        setFetching(false);
      });
  }, [target, settings.limitWind, settings.windModel, settings.windAloftSource, setWinds]);

  return {
    winds,
    fetching,
    error,
    fetchWinds,
    setWinds,
    resetWinds
  };
}
