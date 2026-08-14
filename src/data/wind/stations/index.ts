import { LatLng, ObservedWindStation } from '../../../types';
import { DROPZONES } from '../../../util/dropzones';
import { ObservedStationSource } from '../source';
import { GROUND_WIND_RANGE_FT, STATION_RANGE_FT, distanceFt } from './common';
import { cscSource } from './csc';
import { nwsSource, fetchNwsStationById } from './nws';
import { spacelandSource } from './spaceland';

/**
 * All observed-station sources. NWS discovers stations from the location;
 * CSC and Spaceland are site-specific feeds that gate themselves by range.
 */
export const OBSERVED_STATION_SOURCES: readonly ObservedStationSource[] = [
  cscSource,
  spacelandSource,
  nwsSource
];

/**
 * Fetch all observed wind stations within range of a location (not a
 * dropzone — any location works via NWS discovery). Dropzone entries only
 * contribute supplemental METAR station ids for AWOS airports that NWS
 * gridpoint discovery misses (e.g. KZPH at ZHills).
 */
export async function fetchObservedStations(target: LatLng): Promise<ObservedWindStation[]> {
  const { lat, lng } = target;

  const sourceResults = OBSERVED_STATION_SOURCES.map(
    source => source.fetch(target).catch((): ObservedWindStation[] => [])
  );

  // Supplemental METAR stations from the nearest dropzone (AWOS airports missed by NWS gridpoints)
  const nearestDz = DROPZONES
    .filter(dz => dz.nearbyStations && dz.nearbyStations.length > 0)
    .map(dz => ({ dz, dist: distanceFt(lat, lng, dz.lat, dz.lng) }))
    .filter(({ dist }) => dist <= STATION_RANGE_FT)
    .sort((a, b) => a.dist - b.dist)[0]?.dz;

  const supplemental = (nearestDz?.nearbyStations ?? []).map(
    stationId => fetchNwsStationById(stationId, lat, lng).catch(() => null)
  );

  const [perSource, supplementalResults] = await Promise.all([
    Promise.all(sourceResults),
    Promise.all(supplemental)
  ]);

  const supplementalStations = supplementalResults
    .filter((s): s is ObservedWindStation => s !== null);

  // Merge in priority order (site feeds + supplements first), dedupe by id
  const merged: ObservedWindStation[] = [];
  const seen = new Set<string>();

  for (const station of [...supplementalStations, ...perSource.flat()]) {
    if (!seen.has(station.id)) {
      seen.add(station.id);
      merged.push(station);
    }
  }

  return merged.sort((a, b) => a.distanceFt - b.distanceFt);
}

/**
 * Return the nearest station within ground-wind range, or null.
 */
export function nearestGroundWindStation(
  stations: ObservedWindStation[]
): ObservedWindStation | null {
  const within = stations.filter(s => s.distanceFt <= GROUND_WIND_RANGE_FT);

  return within.length > 0 ? within[0] : null;
}
