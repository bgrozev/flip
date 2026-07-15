import * as turf from '@turf/turf';

/** How far away we look for observed wind stations. */
export const STATION_RANGE_FT = 10 * 5280; // 10 miles

/** Within this range a station can be injected as the DZ ground wind. */
export const GROUND_WIND_RANGE_FT = 2 * 5280; // 2 miles

export function distanceFt(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return turf.distance([lng1, lat1], [lng2, lat2], { units: 'feet' });
}
