import { LatLng } from '../../types';
import { hasTargetMovedTooFar } from '../../core/geometry';
import { metersToFeet } from '../../core/units';
import {
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

interface GfsHourlyData {
  time: string[];
  wind_direction_10m: number[];
  wind_speed_10m: number[];
  wind_direction_80m: number[];
  wind_speed_80m: number[];
  [key: string]: number[] | string[];
}

interface GfsResponse {
  hourly: GfsHourlyData;
}

interface PrefetchedWindow {
  location: LatLng;
  fetchedAt: number;
  elevationFt: number;
  hourly: GfsHourlyData;
}

let prefetched: PrefetchedWindow | null = null;

/** Drop the prefetched window (tests). */
export function resetOpenMeteoPrefetch(): void {
  prefetched = null;
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

function buildProfile(window: PrefetchedWindow, index: number): WindProfile {
  const { hourly, elevationFt } = window;
  const validTime = new Date(`${hourly.time[index]}Z`);
  const extra = { source: SOURCE_OPEN_METEO, validTime };

  const rows: WindRow[] = [
    createWindRow(
      10 * metersToFeet,
      (hourly.wind_direction_10m as number[])[index],
      (hourly.wind_speed_10m as number[])[index],
      extra
    ),
    createWindRow(
      80 * metersToFeet,
      (hourly.wind_direction_80m as number[])[index],
      (hourly.wind_speed_80m as number[])[index],
      extra
    )
  ];

  hPas.forEach(hPa => {
    const e = (hourly[`geopotential_height_${hPa}hPa`] as number[])[index] * metersToFeet - elevationFt;

    if (e > 80) {
      rows.push(
        createWindRow(
          e,
          (hourly[`wind_direction_${hPa}hPa`] as number[])[index],
          (hourly[`wind_speed_${hPa}hPa`] as number[])[index],
          extra
        )
      );
    }
  });

  return {
    winds: rows,
    aloftSource: SOURCE_OPEN_METEO,
    groundSource: SOURCE_OPEN_METEO,
    validTime,
    meta: {
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
  const { hourOffset = 0, forceRefresh = false, signal } = opts;

  // Serve locally from the prefetched window when it is fresh, for the
  // same location, and covers the requested hour
  if (
    !forceRefresh &&
    prefetched &&
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
  const gfs = await fetchGfs(point, prefetchHours, signal);

  console.log(`Elevation is ${elevationFt} ft`);

  prefetched = {
    location: point,
    fetchedAt: Date.now(),
    elevationFt,
    hourly: gfs.hourly
  };

  const index = prefetchedIndexFor(prefetched, hourOffset) ??
    Math.min(hourOffset, gfs.hourly.time.length - 1);

  return buildProfile(prefetched, index);
}

function fetchGfs(point: LatLng, forecastHours: number, signal?: AbortSignal): Promise<GfsResponse> {
  let url = `https://api.open-meteo.com/v1/gfs?latitude=${point.lat}&longitude=${point.lng}`;

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
  capabilities: { hours: MIN_PREFETCH_HOURS },
  fetch: fetchOpenMeteo
};
