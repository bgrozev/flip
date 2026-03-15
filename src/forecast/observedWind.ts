import * as turf from '@turf/turf';

import { LatLng, ObservedWindStation } from '../types';
import { DROPZONES } from '../util/dropzones';
import { CSC_LAT, CSC_LNG, fetchCscStation } from './cscProvider';
import { SPACELAND_STATIONS, fetchSpacelandStation } from './spacelandProvider';
import { fetchNwsStationById, fetchNwsStations } from './nwsObserved';

const RANGE_FT = 10 * 5280; // 10 miles in feet
const GROUND_WIND_RANGE_FT = 2 * 5280; // 2 miles

function distanceFt(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return turf.distance([lng1, lat1], [lng2, lat2], { units: 'feet' });
}

/**
 * Fetch all observed wind stations within 10 miles of the target.
 * Includes NWS stations plus CSC/Spaceland if they're within range.
 * Also fetches supplemental METAR stations listed on the nearest dropzone
 * (for AWOS airports not discovered by NWS gridpoints, e.g. KZPH at ZHills).
 */
export async function fetchObservedStations(target: LatLng): Promise<ObservedWindStation[]> {
  const { lat, lng } = target;

  const providers: Promise<ObservedWindStation | null>[] = [];

  // CSC — only include if within range
  if (distanceFt(lat, lng, CSC_LAT, CSC_LNG) <= RANGE_FT) {
    providers.push(fetchCscStation(lat, lng).catch(() => null));
  }

  // Spaceland Houston
  const houStation = SPACELAND_STATIONS['HOU'];
  if (distanceFt(lat, lng, houStation.lat, houStation.lng) <= RANGE_FT) {
    providers.push(fetchSpacelandStation('HOU', lat, lng).catch(() => null));
  }

  // Spaceland San Marcos
  const ssmStation = SPACELAND_STATIONS['SSM'];
  if (distanceFt(lat, lng, ssmStation.lat, ssmStation.lng) <= RANGE_FT) {
    providers.push(fetchSpacelandStation('SSM', lat, lng).catch(() => null));
  }

  // Supplemental METAR stations from the nearest dropzone (AWOS airports missed by NWS gridpoints)
  const nearestDz = DROPZONES
    .filter(dz => dz.nearbyStations && dz.nearbyStations.length > 0)
    .map(dz => ({ dz, dist: distanceFt(lat, lng, dz.lat, dz.lng) }))
    .filter(({ dist }) => dist <= RANGE_FT)
    .sort((a, b) => a.dist - b.dist)[0]?.dz;

  if (nearestDz?.nearbyStations) {
    for (const stationId of nearestDz.nearbyStations) {
      providers.push(fetchNwsStationById(stationId, lat, lng).catch(() => null));
    }
  }

  // NWS gridpoints discovery (always attempted)
  const nwsPromise = fetchNwsStations(lat, lng, RANGE_FT).catch(() => [] as ObservedWindStation[]);

  const [dzResults, nwsStations] = await Promise.all([
    Promise.all(providers),
    nwsPromise
  ]);

  const dzStations = dzResults.filter((s): s is ObservedWindStation => s !== null);

  // Merge: DZ stations take priority (deduplicate by id)
  const dzIds = new Set(dzStations.map(s => s.id));
  const allStations = [...dzStations, ...nwsStations.filter(s => !dzIds.has(s.id))];

  return allStations.sort((a, b) => a.distanceFt - b.distanceFt);
}

/**
 * Return the nearest station within 3000ft, or null.
 */
export function nearestGroundWindStation(
  stations: ObservedWindStation[]
): ObservedWindStation | null {
  const within = stations.filter(s => s.distanceFt <= GROUND_WIND_RANGE_FT);
  return within.length > 0 ? within[0] : null;
}
