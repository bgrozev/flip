import { useCallback, useEffect, useMemo, useState } from 'react';

import { composeWithObservedGround } from '../data/wind';
import { LatLng, ObservedWindStation, Settings, WindSummaryData } from '../types';
import { SOURCE_DZ, SOURCE_MANUAL, WindProfile, WindRow } from '../core/wind';
import { useFetchForecast } from './useFetchForecast';
import { useNotifications } from './useNotifications';
import { useObservedWind } from './useObservedWind';

interface UseWindsOptions {
  /** Current target location */
  target: LatLng | undefined;
  /** Effective (mode-resolved) settings */
  settings: Pick<
    Settings,
    'limitWind' | 'windModel' | 'windAloftSource' | 'useDzGroundWind' | 'displayWindSummary'
  >;
}

interface UseWindsResult {
  /** Winds with the nearest observed station injected as ground wind (when enabled) */
  effectiveWinds: WindProfile;
  /** Whether a forecast fetch is in progress */
  fetching: boolean;
  /** Manually set winds (manual entry) */
  setWinds: (winds: WindProfile) => void;
  /** Reset forecast and observed state (e.g. target moved too far) */
  invalidateWinds: () => void;
  /** Selected forecast time; null = now */
  forecastTime: Date | null;
  /** Change the forecast time; a non-now time clears observed stations */
  onForecastTimeChange: (newTime: Date | null) => void;
  /**
   * Fetch forecast (and observed stations when applicable).
   * overrideForecastTime: undefined = use the current forecastTime state.
   */
  handleFetchWinds: (
    maxPathAltitude?: number,
    overrideForecastTime?: Date | null,
    opts?: { force?: boolean }
  ) => void;
  /** Observed wind stations near the target */
  stations: ObservedWindStation[];
  /** Nearest station with a usable ground wind, if any */
  nearestStation: ObservedWindStation | null;
  /** Whether station discovery has completed */
  stationsFetched: boolean;
  /** Whether station discovery is in progress */
  fetchingObserved: boolean;
  /** Build the toolbar wind summary from the flight paths' average wind */
  makeWindSummary: (
    averageWind: { speedKts?: number; direction?: number }
  ) => WindSummaryData | undefined;
}

/**
 * Facade over the wind subsystem: forecast fetching, observed ground-wind
 * stations, their composition into the effective profile, forecast-time /
 * observed-reset coupling, error notification, and the wind summary.
 * Extracted from App.tsx as a pure refactor.
 */
export function useWinds({ target, settings }: UseWindsOptions): UseWindsResult {
  const [forecastTime, setForecastTime] = useState<Date | null>(null);

  const { winds, fetching, error, fetchWinds, setWinds, resetWinds } = useFetchForecast({
    target,
    settings
  });

  const {
    stations,
    nearestStation,
    stationsFetched,
    fetchingObserved,
    fetchObserved,
    resetObserved
  } = useObservedWind();

  // Surface wind-fetch failures; the table keeps the previous profile.
  const { notify } = useNotifications();

  useEffect(() => {
    if (error) {
      notify(`Failed to fetch winds: ${error.message}`);
    }
  }, [error, notify]);

  // Inject nearest observed station as ground wind (when enabled and forecast has been fetched)
  const effectiveWinds = useMemo(() => {
    if (!settings.useDzGroundWind || !nearestStation || winds.aloftSource === SOURCE_MANUAL) {
      return winds;
    }
    return composeWithObservedGround(winds, nearestStation);
  }, [winds, nearestStation, settings.useDzGroundWind]);

  const invalidateWinds = useCallback(() => {
    resetWinds();
    resetObserved();
  }, [resetWinds, resetObserved]);

  const handleFetchWinds = useCallback(
    (maxPathAltitude?: number, overrideForecastTime?: Date | null, opts?: { force?: boolean }) => {
      const ft = overrideForecastTime !== undefined ? overrideForecastTime : forecastTime;

      fetchWinds(maxPathAltitude, ft, opts);
      if (settings.useDzGroundWind && target && ft === null) {
        fetchObserved(target);
      } else if (ft !== null) {
        resetObserved();
      }
    },
    [forecastTime, fetchWinds, settings.useDzGroundWind, target, fetchObserved, resetObserved]
  );

  const onForecastTimeChange = useCallback((newTime: Date | null) => {
    setForecastTime(newTime);
    if (newTime !== null) resetObserved();
  }, [resetObserved]);

  const makeWindSummary = useCallback(
    (averageWind: { speedKts?: number; direction?: number }): WindSummaryData | undefined => {
      if (
        !settings.displayWindSummary ||
        (effectiveWinds.groundSource === SOURCE_MANUAL && effectiveWinds.aloftSource === SOURCE_MANUAL) ||
        typeof averageWind.speedKts !== 'number'
      ) {
        return undefined;
      }

      const summary: WindSummaryData = { average: averageWind };

      if (effectiveWinds.groundSource !== SOURCE_MANUAL && effectiveWinds.winds && effectiveWinds.winds.length > 0) {
        const groundWind: WindRow & { observed?: boolean } = { ...effectiveWinds.winds[0] };

        if (effectiveWinds.groundSource === SOURCE_DZ) {
          groundWind.observed = true;
        }
        summary.ground = groundWind;
      }
      if (effectiveWinds.validTime) {
        summary.forecastTime = effectiveWinds.validTime;
      }
      return summary;
    },
    [settings.displayWindSummary, effectiveWinds]
  );

  return {
    effectiveWinds,
    fetching,
    setWinds,
    invalidateWinds,
    forecastTime,
    onForecastTimeChange,
    handleFetchWinds,
    stations,
    nearestStation,
    stationsFetched,
    fetchingObserved,
    makeWindSummary
  };
}
