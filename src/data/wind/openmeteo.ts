import { LatLng } from '../../types';
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

export async function fetchOpenMeteo(
  point: LatLng,
  opts: WindFetchOpts = {}
): Promise<WindProfile> {
  const { hourOffset = 0, signal } = opts;
  const elevationFt = await fetchElevationFt(point, signal);
  const gfs = await fetchGfs(point, hourOffset, signal);

  console.log(`Elevation is ${elevationFt} ft`);

  const validTime = new Date((gfs.hourly.time[hourOffset] as string) + 'Z');
  const extra = { source: SOURCE_OPEN_METEO, validTime };

  const rows: WindRow[] = [
    createWindRow(
      10 * metersToFeet,
      (gfs.hourly.wind_direction_10m as number[])[hourOffset],
      (gfs.hourly.wind_speed_10m as number[])[hourOffset],
      extra
    ),
    createWindRow(
      80 * metersToFeet,
      (gfs.hourly.wind_direction_80m as number[])[hourOffset],
      (gfs.hourly.wind_speed_80m as number[])[hourOffset],
      extra
    )
  ];

  hPas.forEach(hPa => {
    const e = (gfs.hourly[`geopotential_height_${hPa}hPa`] as number[])[hourOffset] * metersToFeet - elevationFt;

    if (e > 80) {
      rows.push(
        createWindRow(
          e,
          (gfs.hourly[`wind_direction_${hPa}hPa`] as number[])[hourOffset],
          (gfs.hourly[`wind_speed_${hPa}hPa`] as number[])[hourOffset],
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
      fetchedAt: new Date(),
      location: point,
      elevationFt
    }
  };
}

function fetchGfs(point: LatLng, hourOffset: number = 0, signal?: AbortSignal): Promise<GfsResponse> {
  let url = `https://api.open-meteo.com/v1/gfs?latitude=${point.lat}&longitude=${point.lng}`;

  hPas.forEach(hPa => {
    url += `&hourly=wind_speed_${hPa}hPa`;
    url += `&hourly=wind_direction_${hPa}hPa`;
    url += `&hourly=geopotential_height_${hPa}hPa`;
  });
  url += '&hourly=wind_speed_10m&hourly=wind_direction_10m';
  url += '&hourly=wind_speed_80m&hourly=wind_direction_80m';
  url += '&wind_speed_unit=kn';
  url += `&forecast_hours=${Math.max(1, hourOffset + 1)}`;

  console.log(`Fetching open-meteo from ${url}`);

  return fetch(url, { signal }).then(d => d.json());
}

/** OpenMeteo model-forecast source. */
export const openMeteoSource: AloftWindSource = {
  id: 'open-meteo',
  label: 'OpenMeteo',
  kind: 'model-forecast',
  capabilities: {},
  fetch: fetchOpenMeteo
};
