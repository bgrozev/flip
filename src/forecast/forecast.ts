import { LatLng } from '../types';
import { Winds } from '../util/wind';
import { fetchOpenMeteo } from './openmeteo';
import {
  ForecastSource,
  SOURCE_DZ,
  SOURCE_MANUAL,
  SOURCE_OPEN_METEO,
  forecastSourceLabel
} from './sources';

// Re-export from sources for backwards compatibility
export {
  SOURCE_DZ,
  SOURCE_MANUAL,
  SOURCE_OPEN_METEO,
  forecastSourceLabel
};
export type { ForecastSource };

export function fetchForecast(
  center: LatLng,
  hourOffset: number = 0,
  signal?: AbortSignal
): Promise<Winds> {
  return fetchOpenMeteo(center, hourOffset, signal);
}
