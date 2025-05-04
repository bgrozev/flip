import { fetchOpenMeteo } from './openmeteo.js';
import { fetchWindsAloft } from './windsaloft.js';

export const SOURCE_MANUAL = 'manual';
export const SOURCE_WINDS_ALOFT = 'winds-aloft';
export const SOURCE_DZ = 'dropzone-specific';
export const SOURCE_OPEN_METEO = 'open-meteo';

export function forecastSourceLabel(source) {
    if (source === SOURCE_MANUAL) {
        return 'set manually';
    } else if (source === SOURCE_DZ) {
        return 'observed conditions';
    } else if (source === SOURCE_WINDS_ALOFT) {
        return 'WindsAloft';
    } else if (source === SOURCE_OPEN_METEO) {
        return 'OpenMeteo GFS';
    }

    return 'invalid';
}

export function fetchForecast(forecastSource, center, fetchDzGroundWind) {
    return Promise.all(
        [
            forecastSource === SOURCE_OPEN_METEO ? fetchOpenMeteo(center)
                : forecastSource === SOURCE_WINDS_ALOFT ? fetchWindsAloft(center, 0) : null,
            fetchDzGroundWind ? new Promise(resolve => {
                fetchDzGroundWind()
                  .then(resolve)
                  .catch(() => {
                      console.log('Failed to fetch DZ winds, continue without.');
                      resolve(null);
                  });
            }) : null
        ]
    )
    .then(values => {
        const winds = values[0];
        const groundWind = values[1];

        if (groundWind) {
            winds.setGroundWind(groundWind);
            winds.groundSource = SOURCE_DZ;
        }

        return winds;
    });
}
