import { IWindRow, LatLng } from '../types';
import { WindRow, Winds } from '../util/wind';
import { fetchOpenMeteo } from './openmeteo';
import {
  ForecastSource,
  SOURCE_DZ,
  SOURCE_MANUAL,
  SOURCE_OPEN_METEO,
  SOURCE_WINDS_ALOFT,
  forecastSourceLabel
} from './sources';
import { fetchWindsAloft } from './windsaloft';

// Re-export from sources for backwards compatibility
export {
  SOURCE_DZ,
  SOURCE_MANUAL,
  SOURCE_OPEN_METEO,
  SOURCE_WINDS_ALOFT,
  forecastSourceLabel
};
export type { ForecastSource };

export function fetchForecast(
  forecastSource: ForecastSource,
  center: LatLng,
  fetchDzGroundWind?: () => Promise<IWindRow>
): Promise<Winds> {
  return Promise.all([
    forecastSource === SOURCE_OPEN_METEO
      ? fetchOpenMeteo(center)
      : forecastSource === SOURCE_WINDS_ALOFT
        ? fetchWindsAloft(center, 0)
        : null,
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
