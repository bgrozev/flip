import { LatLng } from '../types';
import { metersToFeet } from '../util/geo';
import { WindRow, Winds } from '../util/wind';
import { SOURCE_OPEN_METEO } from './sources';

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

interface ElevationResponse {
  elevation: number[];
}

export async function fetchOpenMeteo(point: LatLng, hourOffset: number = 0, signal?: AbortSignal): Promise<Winds> {
  const elevationFt = await fetchElevation(point, signal);
  const gfs = await fetchGfs(point, hourOffset, signal);

  console.log(`Elevation is ${elevationFt} ft`);

  const winds = new Winds([]);

  winds.aloftSource = SOURCE_OPEN_METEO;
  winds.groundSource = SOURCE_OPEN_METEO;
  winds.validTime = new Date((gfs.hourly.time[hourOffset] as string) + 'Z');

  winds.addRow(
    new WindRow(10 * metersToFeet, (gfs.hourly.wind_direction_10m as number[])[hourOffset], (gfs.hourly.wind_speed_10m as number[])[hourOffset])
  );
  winds.addRow(
    new WindRow(80 * metersToFeet, (gfs.hourly.wind_direction_80m as number[])[hourOffset], (gfs.hourly.wind_speed_80m as number[])[hourOffset])
  );
  hPas.forEach(hPa => {
    const e = (gfs.hourly[`geopotential_height_${hPa}hPa`] as number[])[hourOffset] * metersToFeet - elevationFt;

    if (e > 80) {
      winds.addRow(
        new WindRow(
          e,
          (gfs.hourly[`wind_direction_${hPa}hPa`] as number[])[hourOffset],
          (gfs.hourly[`wind_speed_${hPa}hPa`] as number[])[hourOffset]
        )
      );
    }
  });

  return winds;
}

function fetchElevation(point: LatLng, signal?: AbortSignal): Promise<number> {
  return window
    .fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${point.lat}&longitude=${point.lng}`,
      { signal }
    )
    .then(d => d.json())
    .then((json: ElevationResponse) => json.elevation[0] * metersToFeet);
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

  return window.fetch(url, { signal }).then(d => d.json());
}
