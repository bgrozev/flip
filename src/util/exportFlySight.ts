import { FlightPath } from '../types';

const FEET_TO_METERS = 0.3048;

/**
 * Fetch ground elevation in metres from the Open-Meteo elevation API.
 */
export async function fetchGroundElevation(lat: number, lng: number): Promise<number> {
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Elevation fetch failed: ${res.status}`);
  const json = await res.json();
  return json.elevation[0] as number;
}

/**
 * Generate a FlySight 2 GNSS CSV string from a wind-corrected flight path.
 *
 * The internal path is stored in reverse-time order (index 0 = landing, index n = exit).
 * We iterate it chronologically (n → 0) and map relative times/altitudes to
 * absolute timestamps and MSL altitudes.
 *
 * @param path          Wind-corrected flight path (c2Display)
 * @param groundElevM   Ground elevation at landing point in metres
 * @param startTime     Wall-clock time to assign to the first (exit) point
 */
export function generateFlySight2CSV(
  path: FlightPath,
  groundElevM: number,
  startTime: Date
): string {
  if (path.length < 2) return '';

  // path[n] = exit (smallest .time value), path[0] = landing (largest .time value)
  const exitTimeMs = path[path.length - 1].properties.time;
  const startMs = startTime.getTime();

  const lines: string[] = [
    '$FLYS,1',
    '$VAR,DEVICE_ID,FliP',
    '$COL,GNSS,time,lat,lon,hMSL',
    '$UNIT,GNSS,,deg,deg,m',
    '$DATA'
  ];

  // Iterate chronologically: from exit (last index) to landing (index 0)
  for (let ci = path.length - 1; ci >= 0; ci--) {
    const pt = path[ci];
    const lng = pt.geometry.coordinates[0];
    const lat = pt.geometry.coordinates[1];
    const hMSL = groundElevM + pt.properties.alt * FEET_TO_METERS;

    // Elapsed ms since exit; map to absolute wall-clock time
    const elapsedMs = pt.properties.time - exitTimeMs;
    const absTime = new Date(startMs + elapsedMs);

    lines.push(`$GNSS,${absTime.toISOString()},${lat.toFixed(7)},${lng.toFixed(7)},${hMSL.toFixed(3)}`);
  }

  return lines.join('\n');
}

export function downloadFlySight2CSV(
  path: FlightPath,
  groundElevM: number,
  startTime: Date,
  filename: string
): void {
  const csv = generateFlySight2CSV(path, groundElevM, startTime);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
