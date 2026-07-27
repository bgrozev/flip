/**
 * Key-free place search for the MapLibre provider.
 *
 * The Google adapter backs the place picker with Google Places, which needs
 * the Maps JS API. Under MapLibre there is no Google API loaded, so this
 * provides the same promise contract (`searchPlaceSuggestions` +
 * `resolvePlaceSuggestion`) using Photon (https://photon.komoot.io), a free,
 * CORS-enabled, key-less geocoder.
 *
 * Photon returns coordinates with the suggestions, so a suggestion id here
 * simply carries them and resolving is local — no second request.
 *
 * Confined to `src/map/maplibre/`.
 */
import { LatLng, PlaceSuggestion } from '../../types';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const MAX_RESULTS = 5;

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

/** Photon has no place ids, so the coordinates travel in the id itself. */
function suggestionId(lat: number, lng: number): string {
  return `photon:${lat},${lng}`;
}

/** Suggestions for a query. Never rejects — a failure degrades to no hits. */
export async function searchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
  if (query.trim() === '') {
    return [];
  }

  const url = `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=${MAX_RESULTS}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Photon ${response.status}`);
    }

    const data = (await response.json()) as { features?: PhotonFeature[] };

    return (data.features ?? [])
      .filter(feature => feature.geometry?.coordinates)
      .map(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        const p = feature.properties;
        const detail = [p.city, p.state, p.country].filter(Boolean).join(', ');

        return {
          id: suggestionId(lat, lng),
          label: p.name ?? p.street ?? detail,
          detail: detail === '' ? undefined : detail
        };
      })
      .filter(suggestion => suggestion.label !== '');
  } catch (error) {
    console.log('Photon geocode failed:', error);

    return [];
  }
}

/** Coordinates for a suggestion id produced above. */
export function resolvePlaceSuggestion(id: string): Promise<LatLng | null> {
  const match = /^photon:(-?[\d.]+),(-?[\d.]+)$/.exec(id);

  if (!match) {
    return Promise.resolve(null);
  }

  return Promise.resolve({ lat: Number(match[1]), lng: Number(match[2]) });
}
