import { useCallback, useRef, useState } from 'react';

import { fetchForecast } from '../forecast/forecast';
import { LatLng, Settings } from '../types';
import { Winds } from '../util/wind';

interface UseFetchForecastOptions {
  /** Current target location */
  target: LatLng | undefined;
  /** Settings for wind fetching */
  settings: Pick<Settings, 'limitWind'>;
}

interface UseFetchForecastResult {
  /** Current wind data */
  winds: Winds;
  /** Whether a fetch is in progress */
  fetching: boolean;
  /** Fetch winds for the current target. Pass maxPathAltitude to extend limit if path goes higher. */
  fetchWinds: (maxPathAltitude?: number, forecastTime?: Date | null) => void;
  /** Manually set winds (for manual entry) */
  setWinds: (winds: Winds) => void;
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
  const [winds, setWinds] = useState<Winds>(new Winds());
  const [fetching, setFetching] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetWinds = useCallback(() => {
    setWinds(new Winds());
  }, []);

  const fetchWinds = useCallback((maxPathAltitude?: number, forecastTime?: Date | null) => {
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

    fetchForecast(target, hourOffset, controller.signal)
      .then(fetchedWinds => {
        // Determine altitude limit
        let limit = settings.limitWind;
        if (maxPathAltitude !== undefined && maxPathAltitude > limit) {
          limit = maxPathAltitude;
        }

        // Filter winds to altitude limit
        fetchedWinds.winds = fetchedWinds.winds.filter(w => w.altFt <= limit);
        setWinds(fetchedWinds);
        setFetching(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          // A newer fetch superseded this one — leave fetching=true and winds unchanged
          return;
        }
        console.log(`Failed to fetch winds: ${err}`);
        setFetching(false);
        setWinds(Winds.createDefault());
      });
  }, [target, settings.limitWind]);

  return {
    winds,
    fetching,
    fetchWinds,
    setWinds,
    resetWinds
  };
}
