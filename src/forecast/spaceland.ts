import io from 'socket.io-client';
import { WindRow } from '../util/wind';

const mphToKts = 1 / 1.151;

interface WeatherData {
  windDirection: number;
  windSpeed: number;
}

interface WeatherAnnouncement {
  [location: string]: WeatherData;
}

function getGroundWind(data: WeatherData): WindRow {
  const { windDirection, windSpeed } = data;

  return new WindRow(0, windDirection, windSpeed * mphToKts);
}

export function fetchSpacelandGroundWind(location: string): Promise<WindRow> {
  // See e.g. https://sanmarcosclock.skydivespaceland.com/
  const url = 'wss://houstonclock.skydivespaceland.com/';
  const socket = io(url, { transports: ['websocket'], path: '/socket.io/' });

  console.log(`Fetching ground wind for spaceland ${location}`);

  return new Promise((resolve, reject) => {
    socket.on('weather-announcement', (w: WeatherAnnouncement) => {
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

    socket.on('connect_error', (e: Error) => {
      console.log(`connect_error: ${e}`);
      socket.close();
      reject(new Error(`connect_error: ${e}`));
    });
  });
}
