import * as turf from '@turf/turf';
import { CsvRow, FlightPath, FlightPoint } from '../types';
import { metersToFeet } from './geo';

// Note we reverse the path so it's more convenient to work with
// (e.g. rotations and translations are around the first point, not the last)
export function extractPathFromCsv(csv: CsvRow[]): FlightPath {
  if (!csv || !csv.length) {
    return [];
  }

  // Note we assume the final elevation will be 0!
  const points: FlightPath = [];
  const finalElevMeters = Number(csv[csv.length - 1].hMSL);

  csv.slice(1).forEach(row => {
    const point = turf.point([Number(row.lon), Number(row.lat)], {
      time: new Date(row.time).getTime(),
      pom: Boolean(row.pom) ? 1 : 0,
      alt: (Number(row.hMSL) - finalElevMeters) * metersToFeet
    }) as FlightPoint;
    points.push(point);
  });
  points.reverse();

  const poms = points.filter(p => p.properties.pom);
  const time = (points[0].properties.time - points[points.length - 1].properties.time) / 1000;

  console.log(`Extracted path with ${points.length} points, ${poms.length} POMs`);
  console.log(
    `POMs at altitudes: ${poms.map(p => Math.round(p.properties.alt)).join(', ')} ft`
  );
  console.log(
    `Start altitude ${Math.round(points[points.length - 1].properties.alt)} ft, total time ${time} seconds`
  );

  return points;
}

export function trim(csv: CsvRow[], startAltitude: number): void {
  if (!csv || csv.length < 2) {
    return;
  }
  const finalElevMeters = Number(csv[csv.length - 1].hMSL);
  let firstIndex = 2;
  let lastIndex = csv.length - 1;

  // Find the first index with altitude below startAltitude.
  for (let i = 2; i < csv.length - 1; i++) {
    const altFt = (Number(csv[i].hMSL) - finalElevMeters) * metersToFeet;

    if (altFt < startAltitude) {
      firstIndex = i;
      break;
    }
  }

  // Find the last index with altitude above 10 ft.
  for (let i = csv.length - 1; i >= 2; i--) {
    const altFt = (Number(csv[i].hMSL) - finalElevMeters) * metersToFeet;

    if (altFt > 10) {
      break;
    }
    lastIndex = i;
  }

  csv.splice(lastIndex, csv.length - lastIndex);
  csv.splice(1, firstIndex - 1);
}

/**
 * Convert from the GNSS file format that FlySight 2 uses to the format the rest of the code expects.
 */
export function convertFromGnss(data: string): string {
  if (!data.startsWith('$FLYS')) {
    return data;
  }

  const lines = data.split('\n');
  const filtered = lines.filter(
    l => l.startsWith('$COL') || l.startsWith('$UNIT') || l.startsWith('$GNSS')
  );

  for (let i = 0; i < filtered.length; i++) {
    filtered[i] = filtered[i].replace(/^\$COL,/, '').replace(/^\$UNIT,/, '');
  }

  return filtered.join('\n');
}
