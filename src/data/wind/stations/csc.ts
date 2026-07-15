import { ObservedWindStation } from '../../../types';
import { ObservedStationSource } from '../source';
import { STATION_RANGE_FT, distanceFt } from './common';

// CSC location
export const CSC_LAT = 41.89338;
export const CSC_LNG = -89.07201;

const CSC_NAME = 'Chicagoland Skydiving Center';
const WS_URL = 'wss://api.skydivecsc.com/graphql';
const WS_PROTOCOL = 'graphql-ws';

interface CscWindData {
  speed: number;
  gustSpeed: number;
  direction: number;
}

function fetchCscRaw(): Promise<CscWindData> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, WS_PROTOCOL);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'connection_init', payload: {} }));
      ws.send(
        JSON.stringify({
          type: 'start',
          id: 'wind',
          payload: {
            query:
              '\nsubscription {\n  wind: windReported {\n    receivedAt\n    speed\n    gustSpeed\n    direction\n    variableDirection\n  }\n}\n',
            variables: null
          }
        })
      );
    };

    ws.onmessage = ev => {
      try {
        const json = JSON.parse(ev.data);

        if (json?.id === 'wind' && json.payload) {
          ws.close();
          resolve(json.payload.data.wind as CscWindData);
        }
      } catch (e) {
        reject(new Error(`Failed to parse CSC wind data: ${e}`));
      }
    };

    ws.onerror = ev => {
      reject(new Error(`CSC WebSocket error: ${JSON.stringify(ev)}`));
    };
  });
}

/**
 * CSC is a single site-specific feed: returns the station when the location
 * is within range, otherwise an empty list.
 */
export const cscSource: ObservedStationSource = {
  id: 'csc',
  label: 'Chicagoland Skydiving Center',
  kind: 'observed-station',
  capabilities: {},
  fetch: async location => {
    if (distanceFt(location.lat, location.lng, CSC_LAT, CSC_LNG) > STATION_RANGE_FT) {
      return [];
    }

    return [await fetchCscStation(location.lat, location.lng)];
  }
};

export async function fetchCscStation(targetLat: number, targetLng: number): Promise<ObservedWindStation> {
  const data = await fetchCscRaw();

  return {
    id: 'csc',
    name: CSC_NAME,
    source: 'CSC',
    stationUrl: 'https://wx.skydivecsc.com/',
    lat: CSC_LAT,
    lng: CSC_LNG,
    distanceFt: distanceFt(targetLat, targetLng, CSC_LAT, CSC_LNG),
    observedAt: new Date(),
    wind: {
      direction: data.direction,
      // Original csc.ts uses speed directly (no unit conversion)
      speedKts: data.speed,
      gustKts: data.gustSpeed > 0 ? data.gustSpeed : undefined
    }
  };
}
