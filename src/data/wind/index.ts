/**
 * Wind data layer: source plugins (WindSource) for winds aloft and observed
 * surface stations, plus the composition step that merges them into the
 * effective profile the planner uses.
 */
import { LatLng } from '../../types';
import { WindProfile } from '../../core/wind';
import { openMeteoSource } from './openmeteo';
import { WindFetchOpts, WindSource } from './source';
import { OBSERVED_STATION_SOURCES } from './stations';

export type {
  AloftWindSource,
  ObservedStationSource,
  WindFetchOpts,
  WindModelOption,
  WindSource,
  WindSourceCapabilities,
  WindSourceKind
} from './source';
export { composeWithObservedGround } from './compose';
export { openMeteoSource } from './openmeteo';
export {
  OBSERVED_STATION_SOURCES,
  fetchObservedStations,
  nearestGroundWindStation
} from './stations';

/** Every wind source the app knows about. */
export const WIND_SOURCES: readonly WindSource[] = [
  openMeteoSource,
  ...OBSERVED_STATION_SOURCES
];

/** Fetch the winds-aloft forecast for a location. */
export function fetchForecast(center: LatLng, opts?: WindFetchOpts): Promise<WindProfile> {
  return openMeteoSource.fetch(center, opts);
}
