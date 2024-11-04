import io from 'socket.io-client';

import { WindRow } from '../wind.js';

const ktsToMph = 1.151;
const mphToKts = 1 / ktsToMph;

function getGroundWind(data) {
    const { windDirection, windSpeed } = data;

    return new WindRow(0, windDirection, windSpeed * mphToKts);
}

export function fetchSpacelandGroundWind(location) {
    // See e.g. https://sanmarcosclock.skydivespaceland.com/
    const url = 'wss://houstonclock.skydivespaceland.com/';
    const socket = io(url, { transports: [ 'websocket' ], path: '/socket.io/' });

    console.log(`Fetching ground wind for spaceland ${location}`);

    return new Promise((resolve, reject) => {
        socket.on('weather-announcement', w => {
            console.log('got weather-announcement, closing');
            socket.close();

            const groundWind = getGroundWind(w[location]);

            if (groundWind) {
                resolve(groundWind);
            } else {
                reject(new Error('weather-announcement did not contain the expected data'));
            }
        });

        socket.on('connect', () => {
            socket.emit('join', 'announcements');
        });

        socket.on('connect_error', e => {
            console.log(`connect_error: ${e}`);
            socket.close();
            reject(new Error(`connect_error: ${e}`));
        });
    });
}

