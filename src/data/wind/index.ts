/**
 * Wind data layer: source plugins (WindSource) for winds aloft and observed
 * surface stations, plus the composition step that merges them into the
 * effective profile the planner uses.
 */
import { LatLng } from '../../types';
import { SOURCE_SOUNDING, WindProfile } from '../../core/wind';
import { openMeteoSource } from './openmeteo';
import { soundingSource } from './soundings';
import { AloftWindSource, WindFetchOpts, WindSource } from './source';
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
export { soundingSource } from './soundings';
export {
  OBSERVED_STATION_SOURCES,
  fetchObservedStations,
  nearestGroundWindStation
} from './stations';

/** The selectable winds-aloft sources (model forecast + soundings). */
export const ALOFT_WIND_SOURCES: readonly AloftWindSource[] = [
  openMeteoSource,
  soundingSource
];

/** Every wind source the app knows about. */
export const WIND_SOURCES: readonly WindSource[] = [
  ...ALOFT_WIND_SOURCES,
  ...OBSERVED_STATION_SOURCES
];

/** Which winds-aloft source to fetch from. */
export type AloftSourceId = 'forecast' | 'sounding';

/**
 * Fetch the winds aloft for a location from the selected source (model
 * forecast by default, or radiosonde soundings).
 */
export function fetchForecast(
  center: LatLng,
  opts?: WindFetchOpts & { aloftSource?: AloftSourceId }
): Promise<WindProfile> {
  const source = opts?.aloftSource === 'sounding' ? soundingSource : openMeteoSource;

  return source.fetch(center, opts);
}

export { SOURCE_SOUNDING };
