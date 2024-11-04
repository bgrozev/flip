import { SOURCE_DZ } from '../wind.js';

import { fetchWindsAloft } from './windsaloft.js';

export function fetchForecast(center, fetchDzGroundWind) {
    return Promise.all(
        [
            fetchWindsAloft(center, 0),
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
