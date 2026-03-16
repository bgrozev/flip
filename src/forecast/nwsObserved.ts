import * as turf from '@turf/turf';

import { ObservedWindStation } from '../types';

const NWS_BASE = 'https://api.weather.gov';

const CLOUD_COVER_ORDER = ['SKC', 'CLR', 'FEW', 'SCT', 'BKN', 'OVC', 'VV'];

const COVER_LABELS: Record<string, string> = {
  SKC: 'Clear', CLR: 'Clear', FEW: 'Few clouds',
  SCT: 'Partly cloudy', BKN: 'Mostly cloudy', OVC: 'Overcast', VV: 'Obscured'
};

interface NwsObsProperties {
  timestamp: string;
  windDirection: { value: number | null };
  windSpeed: { value: number | null };       // km/h
  windGust: { value: number | null };        // km/h
  temperature: { value: number | null };     // °C
  dewpoint: { value: number | null };        // °C
  seaLevelPressure: { value: number | null }; // Pa
  visibility: { value: number | null };      // m
  cloudLayers: Array<{ amount: string; base: { value: number | null } }>;
}

function parseObservation(
  stationId: string,
  name: string,
  sLat: number,
  sLng: number,
  distanceFt: number,
  p: NwsObsProperties
): ObservedWindStation | null {
  if (p.windDirection?.value === null || p.windSpeed?.value === null) return null;

  const speedKts = p.windSpeed.value / 1.852;
  const gustKts = p.windGust?.value != null ? p.windGust.value / 1.852 : undefined;

  const station: ObservedWindStation = {
    id: `nws-${stationId}`,
    name,
    source: 'NWS',
    stationUrl: `https://www.weather.gov/data/obhistory/${stationId}.html`,
    lat: sLat,
    lng: sLng,
    distanceFt,
    observedAt: new Date(p.timestamp),
    wind: {
      direction: p.windDirection.value,
      speedKts,
      gustKts,
    }
  };

  if (p.temperature?.value != null) station.temperatureC = p.temperature.value;
  if (p.dewpoint?.value != null) station.dewpointC = p.dewpoint.value;
  if (p.seaLevelPressure?.value != null) station.seaLevelPressureHpa = p.seaLevelPressure.value / 100;
  if (p.visibility?.value != null) station.visibilityM = p.visibility.value;

  if (p.cloudLayers && p.cloudLayers.length > 0) {
    const layers = p.cloudLayers
      .filter(l => CLOUD_COVER_ORDER.indexOf(l.amount) > 1)
      .map(l => ({ amount: l.amount, baseM: l.base?.value ?? null }));
    if (layers.length > 0) station.cloudLayers = layers;

    const topLayer = [...p.cloudLayers].sort(
      (a, b) => CLOUD_COVER_ORDER.indexOf(b.amount) - CLOUD_COVER_ORDER.indexOf(a.amount)
    )[0];
    if (topLayer && COVER_LABELS[topLayer.amount]) {
      station.textDescription = COVER_LABELS[topLayer.amount];
    }
  }

  return station;
}

async function fetchObservation(
  stationId: string,
  name: string,
  sLat: number,
  sLng: number,
  distanceFt: number
): Promise<ObservedWindStation | null> {
  // /observations/latest sometimes returns a partial record with null wind.
  // Fetch the last few observations and use the most recent one with valid wind data.
  const res = await fetch(`${NWS_BASE}/stations/${stationId}/observations?limit=5`);
  if (!res.ok) return null;
  const data = await res.json();
  for (const feature of data.features ?? []) {
    const station = parseObservation(stationId, name, sLat, sLng, distanceFt, feature.properties);
    if (station) return station;
  }
  return null;
}

/** Fetch all NWS observation stations within rangeFt via gridpoints discovery */
export async function fetchNwsStations(
  lat: number,
  lng: number,
  rangeFt: number
): Promise<ObservedWindStation[]> {
  // Step 1: Get NWS grid point for location
  const ptRes = await fetch(`${NWS_BASE}/points/${lat.toFixed(4)},${lng.toFixed(4)}`);
  if (!ptRes.ok) throw new Error(`NWS points failed: ${ptRes.status}`);
  const ptData = await ptRes.json();

  const stationsUrl = ptData.properties?.observationStations;
  if (!stationsUrl) throw new Error('No observation stations URL in NWS response');

  // Step 2: Get the list of observation stations
  const stRes = await fetch(stationsUrl);
  if (!stRes.ok) throw new Error(`NWS stations list failed: ${stRes.status}`);
  const stData = await stRes.json();

  // Step 3: Fetch observations for all stations within range
  const promises: Promise<ObservedWindStation | null>[] = [];

  for (const feature of stData.features ?? []) {
    const [sLng, sLat] = feature.geometry?.coordinates ?? [];
    if (sLng === undefined || sLat === undefined) continue;

    const stationId: string = feature.properties?.stationIdentifier;
    const name: string = feature.properties?.name ?? stationId;
    const distanceFt = turf.distance([lng, lat], [sLng, sLat], { units: 'feet' });

    if (distanceFt > rangeFt) continue;

    promises.push(fetchObservation(stationId, name, sLat, sLng, distanceFt).catch(() => null));
  }

  const results = (await Promise.all(promises)).filter((s): s is ObservedWindStation => s !== null);
  return results.sort((a, b) => a.distanceFt - b.distanceFt);
}

/** Fetch a specific NWS station by ICAO ID (for stations not in gridpoints discovery) */
export async function fetchNwsStationById(
  stationId: string,
  targetLat: number,
  targetLng: number
): Promise<ObservedWindStation | null> {
  // Fetch station metadata to get name + coordinates
  const metaRes = await fetch(`${NWS_BASE}/stations/${stationId}`);
  if (!metaRes.ok) return null;
  const meta = await metaRes.json();

  const [sLng, sLat] = meta.geometry?.coordinates ?? [];
  if (sLng === undefined || sLat === undefined) return null;

  const name: string = meta.properties?.name ?? stationId;
  const distanceFt = turf.distance([targetLng, targetLat], [sLng, sLat], { units: 'feet' });

  return fetchObservation(stationId, name, sLat, sLng, distanceFt);
}
