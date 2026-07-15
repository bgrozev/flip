import { useCallback, useRef, useState } from 'react';

import { fetchForecast } from '../data/wind';
import { LatLng, Settings } from '../types';
import { WindProfile, createWindProfile } from '../core/wind';

interface UseFetchForecastOptions {
  /** Current target location */
  target: LatLng | undefined;
  /** Settings for wind fetching */
  settings: Pick<Settings, 'limitWind' | 'windModel'>;
}

interface UseFetchForecastResult {
  /** Current wind data */
  winds: WindProfile;
  /** Whether a fetch is in progress */
  fetching: boolean;
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
  const [winds, setWinds] = useState<WindProfile>(createWindProfile);
  const [fetching, setFetching] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetWinds = useCallback(() => {
    setWinds(createWindProfile());
  }, []);

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
        setFetching(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          // A newer fetch superseded this one — leave fetching=true and winds unchanged
          return;
        }
        console.log(`Failed to fetch winds: ${err}`);
        setFetching(false);
        setWinds(createWindProfile());
      });
  }, [target, settings.limitWind, settings.windModel]);

  return {
    winds,
    fetching,
    fetchWinds,
    setWinds,
    resetWinds
  };
}
