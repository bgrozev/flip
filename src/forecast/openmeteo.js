import { metersToFeet } from '../geo.js';
import { WindRow, Winds } from '../wind.js';

import { SOURCE_OPEN_METEO } from './forecast.js';

const hPas = [ 1000, 975, 950, 925, 900, 875, 850, 825, 800, 775, 750, 725, 700, 675, 650, 625, 600 ];

export async function fetchOpenMeteo(point) {

    const elevationFt = await fetchElevation(point);
    const gfs = await fetchGfs(point);

    console.log(`Elevation is ${elevationFt} ft`);

    const winds = new Winds();

    winds.aloftSource = SOURCE_OPEN_METEO;
    winds.groundSource = SOURCE_OPEN_METEO;

    winds.addRow(new WindRow(
        10 * metersToFeet,
        gfs.hourly.wind_direction_10m,
        gfs.hourly.wind_speed_10m
    ));
    winds.addRow(new WindRow(
        80 * metersToFeet,
        gfs.hourly.wind_direction_80m,
        gfs.hourly.wind_speed_80m
    ));
    hPas.forEach(hPa => {
        const e = (gfs.hourly[`geopotential_height_${hPa}hPa`] * metersToFeet) - elevationFt;

        if (e > 80) {
            winds.addRow(new WindRow(
                e,
                gfs.hourly[`wind_direction_${hPa}hPa`],
                gfs.hourly[`wind_speed_${hPa}hPa`]
            ));
        }
    });

    return winds;
}

function fetchElevation(point) {
    return window.fetch(`https://api.open-meteo.com/v1/elevation?latitude=${point.lat}&longitude=${point.lng}`)
        .then(d => d.json())
        .then(json => json.elevation[0] * metersToFeet);
}

function fetchGfs(point) {

    let url = `https://api.open-meteo.com/v1/gfs?latitude=${point.lat}&longitude=${point.lng}`;

    hPas.forEach(hPa => {
        url += `&hourly=wind_speed_${hPa}hPa`;
        url += `&hourly=wind_direction_${hPa}hPa`;
        url += `&hourly=geopotential_height_${hPa}hPa`;
    });
    url += '&hourly=wind_speed_10m&hourly=wind_direction_10m';
    url += '&hourly=wind_speed_80m&hourly=wind_direction_80m';
    url += '&wind_speed_unit=kn';
    url += '&forecast_hours=1';

    console.log(`Fetching open-meteo from ${url}`);

    return window.fetch(url).then(d => d.json());
}
