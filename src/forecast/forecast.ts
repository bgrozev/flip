import { IWindRow, LatLng } from '../types';
import { WindRow, Winds } from '../util/wind';
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
  fetchDzGroundWind?: () => Promise<IWindRow>,
  hourOffset: number = 0
): Promise<Winds> {
  return Promise.all([
    fetchOpenMeteo(center, hourOffset),
    fetchDzGroundWind
      ? new Promise<IWindRow | null>(resolve => {
          fetchDzGroundWind()
            .then(resolve)
            .catch(() => {
              console.log('Failed to fetch DZ winds, continue without.');
              resolve(null);
            });
        })
      : null
  ]).then(values => {
    const winds = values[0];
    const groundWind = values[1];

    if (!winds) {
      throw new Error('Failed to fetch winds');
    }

    if (groundWind) {
      winds.setGroundWind(new WindRow(groundWind.altFt, groundWind.direction, groundWind.speedKts));
      winds.groundSource = SOURCE_DZ;
    }

    return winds;
  });
}
