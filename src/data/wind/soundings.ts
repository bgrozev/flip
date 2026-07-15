import * as turf from '@turf/turf';

import { LatLng } from '../../types';
import { metersToFeet } from '../../core/units';
import {
  SOURCE_SOUNDING,
  WindProfile,
  WindRow,
  createWindRow
} from '../../core/wind';
import { AloftWindSource, WindFetchOpts } from './source';

/**
 * Real radiosonde soundings from the Iowa Environmental Mesonet (IEM) RAOB
 * JSON service. IEM serves both a station network GeoJSON and per-station
 * sounding JSON with open CORS (Access-Control-Allow-Origin: *), so the
 * source is callable directly from the browser — no proxy.
 *
 *   network:  https://mesonet.agron.iastate.edu/geojson/network/RAOB.geojson
 *   sounding: https://mesonet.agron.iastate.edu/json/raob.py?ts=<UTC>&station=<id>
 *
 * Soundings are launched at the 00Z and 12Z synoptic hours; we try the most
 * recent one and fall back if it hasn't been uploaded yet.
 */

const NETWORK_URL = 'https://mesonet.agron.iastate.edu/geojson/network/RAOB.geojson';
const SOUNDING_URL = 'https://mesonet.agron.iastate.edu/json/raob.py';

const HOUR_MS = 3600 * 1000;

interface RaobStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface RaobLevel {
  pres: number;
  hght: number | null;      // geopotential height, metres MSL
  tmpc: number | null;      // °C
  dwpc: number | null;
  drct: number | null;      // wind direction, degrees
  sknt: number | null;      // wind speed, knots
}

interface RaobProfileResponse {
  profiles: Array<{
    station: string;
    valid: string;
    profile: RaobLevel[];
  }>;
}

let networkCache: RaobStation[] | null = null;
let networkPromise: Promise<RaobStation[]> | null = null;

/** Reset the cached station network (tests). */
export function resetSoundingNetwork(): void {
  networkCache = null;
  networkPromise = null;
}

/** Parse the RAOB network GeoJSON into the online stations. */
export function parseNetwork(geojson: unknown): RaobStation[] {
  const features = (geojson as { features?: unknown[] })?.features ?? [];
  const stations: RaobStation[] = [];

  for (const f of features) {
    const feature = f as {
      properties?: { sid?: string; sname?: string; online?: boolean };
      geometry?: { coordinates?: [number, number] };
    };
    const props = feature.properties ?? {};
    const coords = feature.geometry?.coordinates;

    if (!props.online || !props.sid || !coords) {
      continue;
    }

    const [lng, lat] = coords;

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      stations.push({ id: props.sid, name: props.sname ?? props.sid, lat, lng });
    }
  }

  return stations;
}

function fetchNetwork(signal?: AbortSignal): Promise<RaobStation[]> {
  if (networkCache) {
    return Promise.resolve(networkCache);
  }
  if (networkPromise) {
    return networkPromise;
  }

  networkPromise = fetch(NETWORK_URL, { signal })
    .then(r => r.json())
    .then(json => {
      networkCache = parseNetwork(json);
      networkPromise = null;

      return networkCache;
    })
    .catch(err => {
      networkPromise = null;
      throw err;
    });

  return networkPromise;
}

/** Nearest online RAOB station to a location, or null when none is known. */
export function nearestStation(stations: RaobStation[], location: LatLng): RaobStation | null {
  let best: RaobStation | null = null;
  let bestDist = Infinity;

  for (const s of stations) {
    const dist = turf.distance([location.lng, location.lat], [s.lng, s.lat], { units: 'feet' });

    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }

  return best;
}

/**
 * The synoptic launch times (00Z, 12Z) to try, most recent first, for a
 * given wall-clock time.
 */
export function synopticCandidates(now: number, count: number = 3): Date[] {
  const twelveHours = 12 * HOUR_MS;
  const latest = Math.floor(now / twelveHours) * twelveHours;

  return Array.from({ length: count }, (_, i) => new Date(latest - i * twelveHours));
}

function toTimestamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');

  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `${p(date.getUTCHours())}${p(date.getUTCMinutes())}00`
  );
}

function fetchSounding(
  stationId: string,
  when: Date,
  signal?: AbortSignal
): Promise<RaobProfileResponse> {
  const url = `${SOUNDING_URL}?ts=${toTimestamp(when)}&station=${stationId}`;

  return fetch(url, { signal }).then(r => r.json());
}

/** Build a wind profile (rows AGL) from a RAOB sounding. */
export function soundingToProfile(
  response: RaobProfileResponse,
  station: RaobStation,
  location: LatLng
): WindProfile | null {
  const sounding = response.profiles?.[0];

  if (!sounding || !sounding.profile?.length) {
    return null;
  }

  const validTime = new Date(sounding.valid);
  const extra = { source: SOURCE_SOUNDING, validTime };
  const levels = sounding.profile.filter(
    l => l.hght !== null && l.drct !== null && l.sknt !== null
  );

  if (!levels.length) {
    return null;
  }

  // Surface geopotential height is the ground reference; rows are AGL
  const surfaceHght = levels[0].hght as number;
  const rows: WindRow[] = levels.map(l => {
    const altFt = ((l.hght as number) - surfaceHght) * metersToFeet;

    return createWindRow(altFt, l.drct as number, l.sknt as number, {
      ...extra,
      ...(l.tmpc !== null ? { tempC: l.tmpc } : {})
    });
  });

  const distanceFt = turf.distance(
    [location.lng, location.lat],
    [station.lng, station.lat],
    { units: 'feet' }
  );

  return {
    winds: rows,
    aloftSource: SOURCE_SOUNDING,
    groundSource: SOURCE_SOUNDING,
    validTime,
    meta: {
      fetchedAt: new Date(),
      location,
      elevationFt: surfaceHght * metersToFeet,
      station: station.id,
      stationName: station.name,
      stationDistanceFt: distanceFt
    }
  };
}

export async function fetchSoundingProfile(
  location: LatLng,
  opts: WindFetchOpts = {}
): Promise<WindProfile> {
  const { signal } = opts;
  const stations = await fetchNetwork(signal);
  const station = nearestStation(stations, location);

  if (!station) {
    throw new Error('No radiosonde station found');
  }

  // Try the most recent synoptic launches until one has been uploaded
  for (const when of synopticCandidates(Date.now())) {
    const response = await fetchSounding(station.id, when, signal).catch(() => null);
    const profile = response && soundingToProfile(response, station, location);

    if (profile) {
      return profile;
    }
  }

  throw new Error(`No recent sounding for station ${station.id}`);
}

/** IEM radiosonde sounding source. */
export const soundingSource: AloftWindSource = {
  id: 'sounding',
  label: 'Radiosonde sounding',
  kind: 'sounding',
  capabilities: { discovery: true },
  fetch: fetchSoundingProfile
};
