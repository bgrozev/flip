import io from 'socket.io-client';
import * as turf from '@turf/turf';

import { ObservedWindStation } from '../types';

const mphToKts = 1 / 1.151;

interface WeatherData {
  windDirection: number;
  windSpeed: number;
}

interface WeatherAnnouncement {
  [location: string]: WeatherData;
}

const WS_URL = 'wss://houstonclock.skydivespaceland.com/';

const SPACELAND_STATIONS: Record<string, { id: string; name: string; lat: number; lng: number; url: string }> = {
  HOU: {
    id: 'spaceland-hou',
    name: 'Skydive Spaceland Houston',
    lat: 29.357628,
    lng: -95.461775,
    url: 'https://houstonclock.skydivespaceland.com/'
  },
  SSM: {
    id: 'spaceland-ssm',
    name: 'Skydive Spaceland San Marcos',
    lat: 29.76994,
    lng: -97.77173,
    url: 'https://sanmarcosclock.skydivespaceland.com/'
  }
};

function fetchSpacelandRaw(): Promise<WeatherAnnouncement> {
  const socket = io(WS_URL, { transports: ['websocket'], path: '/socket.io/' });

  return new Promise((resolve, reject) => {
    socket.on('weather-announcement', (w: WeatherAnnouncement) => {
      socket.close();
      resolve(w);
    });

    socket.on('connect', () => {
      socket.emit('join', 'announcements');
    });

    socket.on('connect_error', (e: Error) => {
      socket.close();
      reject(new Error(`Spaceland connect_error: ${e}`));
    });
  });
}

let spacelandCache: { data: WeatherAnnouncement; fetchedAt: number } | null = null;
let spacelandFetchPromise: Promise<WeatherAnnouncement> | null = null;

// Fetch once and share among all station requests
function fetchSpacelandShared(): Promise<WeatherAnnouncement> {
  // Reuse a cached result for 60s to avoid duplicate WebSocket connections
  if (spacelandCache && Date.now() - spacelandCache.fetchedAt < 60000) {
    return Promise.resolve(spacelandCache.data);
  }
  if (spacelandFetchPromise) {
    return spacelandFetchPromise;
  }
  spacelandFetchPromise = fetchSpacelandRaw().then(data => {
    spacelandCache = { data, fetchedAt: Date.now() };
    spacelandFetchPromise = null;
    return data;
  }).catch(err => {
    spacelandFetchPromise = null;
    throw err;
  });
  return spacelandFetchPromise;
}

export async function fetchSpacelandStation(
  locationCode: 'HOU' | 'SSM',
  targetLat: number,
  targetLng: number
): Promise<ObservedWindStation> {
  const station = SPACELAND_STATIONS[locationCode];
  const distanceFt = turf.distance(
    [targetLng, targetLat],
    [station.lng, station.lat],
    { units: 'feet' }
  );

  const data = await fetchSpacelandShared();
  const locationData = data[locationCode];

  if (!locationData) {
    throw new Error(`Spaceland data missing for location ${locationCode}`);
  }

  return {
    id: station.id,
    name: station.name,
    source: 'Spaceland',
    stationUrl: station.url,
    lat: station.lat,
    lng: station.lng,
    distanceFt,
    observedAt: new Date(),
    wind: {
      direction: locationData.windDirection,
      speedKts: locationData.windSpeed * mphToKts
    }
  };
}

export { SPACELAND_STATIONS };
