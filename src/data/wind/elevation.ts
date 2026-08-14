import { LatLng } from '../../types';
import { metersToFeet } from '../../core/units';
import { createVersionedCodec } from '../../util/storage';

/**
 * Ground elevation lookup with a permanent localStorage cache: elevation
 * never changes for a location, so once fetched it is never refetched.
 * Locations are rounded to ~110 m (3 decimal places) so small target
 * nudges keep hitting the cache.
 */

const STORAGE_KEY = 'flip.elevationCache';
const SCHEMA_VERSION = 1;
const MAX_ENTRIES = 500;

type ElevationCacheDoc = Record<string, number>;

/** Cache key for a location: lat/lng rounded to 3 decimals (~110 m). */
export function elevationCacheKey(point: LatLng): string {
  return `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
}

const KEY_PATTERN = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

/** Validating migrate for the persisted cache: drops garbage entries. */
export function migrateElevationCache(raw: unknown): ElevationCacheDoc {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }

  const doc: ElevationCacheDoc = {};

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value) && KEY_PATTERN.test(key)) {
      doc[key] = value;
    }
  }

  return doc;
}

const codec = createVersionedCodec(SCHEMA_VERSION, migrateElevationCache);

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

function load(): ElevationCacheDoc {
  if (!storageAvailable()) {
    return {};
  }

  try {
    const value = localStorage.getItem(STORAGE_KEY);

    return value === null ? {} : codec.parse(value);
  } catch {
    return {};
  }
}

function store(doc: ElevationCacheDoc): void {
  if (!storageAvailable()) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, codec.stringify(doc));
  } catch {
    // Quota exceeded or storage unavailable — the cache is best-effort
  }
}

interface ElevationResponse {
  elevation: number[];
}

function fetchElevationRaw(point: LatLng, signal?: AbortSignal): Promise<number> {
  return fetch(
    `https://api.open-meteo.com/v1/elevation?latitude=${point.lat}&longitude=${point.lng}`,
    { signal }
  )
    .then(d => d.json())
    .then((json: ElevationResponse) => json.elevation[0] * metersToFeet);
}

/**
 * Get the ground elevation (in feet) for a location, from cache when
 * available, fetching and caching on a miss.
 */
export async function fetchElevationFt(point: LatLng, signal?: AbortSignal): Promise<number> {
  const key = elevationCacheKey(point);
  const cache = load();

  if (key in cache) {
    return cache[key];
  }

  const elevationFt = await fetchElevationRaw(point, signal);

  // Re-load in case another fetch landed meanwhile, then bound the size by
  // dropping the oldest entries (object insertion order)
  const doc = load();

  doc[key] = elevationFt;
  const keys = Object.keys(doc);

  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) {
    delete doc[keys[i]];
  }
  store(doc);

  return elevationFt;
}
