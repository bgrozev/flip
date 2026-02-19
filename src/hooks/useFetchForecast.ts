import * as turf from '@turf/turf';
import { useCallback, useState } from 'react';

import { fetchForecast } from '../forecast/forecast';
import { Dropzone, LatLng, Settings } from '../types';
import { findClosestDropzone } from '../util/dropzones';
import { Winds } from '../util/wind';

interface UseFetchForecastOptions {
  /** Current target location */
  target: LatLng | undefined;
  /** Settings for wind fetching */
  settings: Pick<Settings, 'useDzGroundWind' | 'limitWind'>;
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
 * Hook to manage wind forecast fetching.
 *
 * Handles:
 * - Finding closest dropzone for ground wind
 * - Fetching from OpenMeteo
 * - Error handling with fallback
 * - Wind altitude filtering
 */
export function useFetchForecast({
  target,
  settings
}: UseFetchForecastOptions): UseFetchForecastResult {
  const [winds, setWinds] = useState<Winds>(new Winds());
  const [fetching, setFetching] = useState(false);

  const resetWinds = useCallback(() => {
    setWinds(new Winds());
  }, []);

  const fetchWinds = useCallback((maxPathAltitude?: number, forecastTime?: Date | null) => {
    if (!target) {
      console.log('Not fetching winds, no target');
      return;
    }

    const targetPoint: [number, number] = [target.lng, target.lat];
    const closestDz = findClosestDropzone(targetPoint);
    const distanceToDz = turf.distance(targetPoint, [closestDz.lng, closestDz.lat], { units: 'feet' });

    // Only use dropzone ground wind if within 5000 feet
    const dz: Dropzone | undefined = distanceToDz <= 5000 ? closestDz : undefined;

    const hourOffset = forecastTime
      ? Math.max(0, Math.round((forecastTime.getTime() - Date.now()) / 3600000))
      : 0;

    console.log(
      `Fetching winds for: ${JSON.stringify(target)},` +
        ` useDzGroundWind=${settings.useDzGroundWind} (dz=${dz?.name}), hourOffset=${hourOffset}`
    );

    setFetching(true);

    fetchForecast(
      target,
      settings.useDzGroundWind ? dz?.fetchGroundWind : undefined,
      hourOffset
    )
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
        console.log(`Failed to fetch winds: ${err}`);
        setFetching(false);
        // Set empty winds on error
        setWinds(Winds.createDefault());
      });
  }, [target, settings.useDzGroundWind, settings.limitWind]);

  return {
    winds,
    fetching,
    fetchWinds,
    setWinds,
    resetWinds
  };
}
