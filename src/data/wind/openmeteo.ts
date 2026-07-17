import { LatLng } from '../../types';
import { hasTargetMovedTooFar } from '../../core/geometry';
import { metersToFeet } from '../../core/units';
import {
  DEFAULT_WIND_MODEL,
  OPEN_METEO_MODELS,
  SOURCE_OPEN_METEO,
  WindProfile,
  WindRow,
  createWindRow
} from '../../core/wind';
import { fetchElevationFt } from './elevation';
import { AloftWindSource, WindFetchOpts } from './source';

const hPas = [
  1000, 975, 950, 925, 900, 875, 850, 825, 800, 775, 750, 725, 700, 675, 650, 625, 600
];

const HOUR_MS = 3600 * 1000;

/**
 * One OpenMeteo request returns hourly arrays, so we prefetch a window of
 * hours and switch between them locally: at least a day, whole days beyond
 * that, capped at the 7 days the forecast-time picker offers.
 */
const MIN_PREFETCH_HOURS = 24;
const MAX_PREFETCH_HOURS = 168;

/** How long a prefetched window stays fresh (models update every few hours). */
const PREFETCH_TTL_MS = 30 * 60 * 1000;

/**
 * Hourly arrays from /v1/forecast. Values are null where the selected
 * model doesn't provide a variable (e.g. ECMWF has no 80 m wind and only
 * a subset of the pressure levels).
 */
interface OpenMeteoHourlyData {
  time: string[];
  wind_direction_10m: (number | null)[];
  wind_speed_10m: (number | null)[];
  wind_direction_80m: (number | null)[];
  wind_speed_80m: (number | null)[];
  [key: string]: (number | null)[] | string[];
}

interface OpenMeteoResponse {
  hourly: OpenMeteoHourlyData;
}

interface PrefetchedWindow {
  location: LatLng;
  model: string;
  fetchedAt: number;
  elevationFt: number;
  hourly: OpenMeteoHourlyData;
}

let prefetched: PrefetchedWindow | null = null;

/** Drop the prefetched window (tests). */
export function resetOpenMeteoPrefetch(): void {
  prefetched = null;
}

/**
 * How many hours from "now" the prefetched window still covers for this
 * location and model — scrubbing within them is served locally, without a
 * network request. Null when the cache is empty, expired, or was fetched
 * for a different location/model. Drives the wind time scrubber's range.
 */
export function prefetchedWindowHours(point: LatLng, model: string): number | null {
  if (
    !prefetched ||
    prefetched.model !== model ||
    Date.now() - prefetched.fetchedAt >= PREFETCH_TTL_MS ||
    hasTargetMovedTooFar(prefetched.location, point)
  ) {
    return null;
  }

  const nowIndex = prefetchedIndexFor(prefetched, 0);

  return nowIndex === null ? null : prefetched.hourly.time.length - nowIndex;
}

/**
 * Index of the requested hour in a prefetched window, or null when the
 * window doesn't cover it. Computed from timestamps, not the raw offset:
 * a window fetched an hour ago is still valid, just shifted.
 */
function prefetchedIndexFor(window: PrefetchedWindow, hourOffset: number): number | null {
  const base = new Date(`${window.hourly.time[0]}Z`).getTime();
  const wanted = Math.floor(Date.now() / HOUR_MS) * HOUR_MS + hourOffset * HOUR_MS;
  const index = Math.round((wanted - base) / HOUR_MS);

  return index >= 0 && index < window.hourly.time.length ? index : null;
}

function hourlyValue(
  hourly: OpenMeteoHourlyData,
  key: string,
  index: number
): number | null {
  const arr = hourly[key] as (number | null)[] | undefined;
  const value = arr?.[index];

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function buildProfile(window: PrefetchedWindow, index: number): WindProfile {
  const { hourly, elevationFt } = window;
  const validTime = new Date(`${hourly.time[index]}Z`);
  const extra = { source: SOURCE_OPEN_METEO, validTime };
  const rows: WindRow[] = [];

  // 10 m and 80 m surface winds (some models don't provide 80 m)
  for (const meters of [10, 80]) {
    const direction = hourlyValue(hourly, `wind_direction_${meters}m`, index);
    const speed = hourlyValue(hourly, `wind_speed_${meters}m`, index);

    if (direction !== null && speed !== null) {
      rows.push(createWindRow(meters * metersToFeet, direction, speed, extra));
    }
  }

  // Pressure levels above ground (skipping levels the model doesn't provide)
  hPas.forEach(hPa => {
    const height = hourlyValue(hourly, `geopotential_height_${hPa}hPa`, index);
    const direction = hourlyValue(hourly, `wind_direction_${hPa}hPa`, index);
    const speed = hourlyValue(hourly, `wind_speed_${hPa}hPa`, index);

    if (height === null || direction === null || speed === null) {
      return;
    }

    const e = height * metersToFeet - elevationFt;

    if (e > 80) {
      rows.push(createWindRow(e, direction, speed, extra));
    }
  });

  return {
    winds: rows,
    aloftSource: SOURCE_OPEN_METEO,
    groundSource: SOURCE_OPEN_METEO,
    validTime,
    meta: {
      model: window.model,
      fetchedAt: new Date(window.fetchedAt),
      location: window.location,
      elevationFt
    }
  };
}

export async function fetchOpenMeteo(
  point: LatLng,
  opts: WindFetchOpts = {}
): Promise<WindProfile> {
  const { hourOffset = 0, model = DEFAULT_WIND_MODEL, forceRefresh = false, signal } = opts;

  // Serve locally from the prefetched window when it is fresh, for the
  // same location and model, and covers the requested hour
  if (
    !forceRefresh &&
    prefetched &&
    prefetched.model === model &&
    Date.now() - prefetched.fetchedAt < PREFETCH_TTL_MS &&
    !hasTargetMovedTooFar(prefetched.location, point)
  ) {
    const index = prefetchedIndexFor(prefetched, hourOffset);

    if (index !== null) {
      console.log(`OpenMeteo prefetch hit: hour offset ${hourOffset} → index ${index}`);

      return buildProfile(prefetched, index);
    }
  }

  const elevationFt = await fetchElevationFt(point, signal);
  const prefetchHours = Math.min(
    MAX_PREFETCH_HOURS,
    Math.max(MIN_PREFETCH_HOURS, Math.ceil((hourOffset + 1) / 24) * 24)
  );
  const response = await fetchWindow(point, prefetchHours, model, signal);

  console.log(`Elevation is ${elevationFt} ft`);

  prefetched = {
    location: point,
    model,
    fetchedAt: Date.now(),
    elevationFt,
    hourly: response.hourly
  };

  const index = prefetchedIndexFor(prefetched, hourOffset) ??
    Math.min(hourOffset, response.hourly.time.length - 1);

  return buildProfile(prefetched, index);
}

function fetchWindow(
  point: LatLng,
  forecastHours: number,
  model: string,
  signal?: AbortSignal
): Promise<OpenMeteoResponse> {
  let url = `https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lng}`;

  url += `&models=${model}`;

  hPas.forEach(hPa => {
    url += `&hourly=wind_speed_${hPa}hPa`;
    url += `&hourly=wind_direction_${hPa}hPa`;
    url += `&hourly=geopotential_height_${hPa}hPa`;
  });
  url += '&hourly=wind_speed_10m&hourly=wind_direction_10m';
  url += '&hourly=wind_speed_80m&hourly=wind_direction_80m';
  url += '&wind_speed_unit=kn';
  url += `&forecast_hours=${forecastHours}`;

  console.log(`Fetching open-meteo from ${url}`);

  return fetch(url, { signal }).then(d => d.json());
}

/** OpenMeteo model-forecast source. */
export const openMeteoSource: AloftWindSource = {
  id: 'open-meteo',
  label: 'OpenMeteo',
  kind: 'model-forecast',
  capabilities: { hours: MIN_PREFETCH_HOURS, models: OPEN_METEO_MODELS },
  fetch: fetchOpenMeteo
};
