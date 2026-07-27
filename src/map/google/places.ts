/**
 * Google Places search, as a promise API.
 *
 * The place picker renders suggestions inside its own list, so it needs to
 * *ask* for them — the old `google.maps.places.Autocomplete` widget owned an
 * input and rendered its own dropdown, which can't be merged with the
 * dropzone list.
 *
 * Coordinates cost an extra call, so they are only fetched for the
 * suggestion the user actually picks (`resolvePlaceSuggestion`).
 *
 * Two Places generations are handled: the current `AutocompleteSuggestion`
 * API and, if that isn't available or the key doesn't have Places API (New)
 * enabled, the legacy `AutocompleteService` / `PlacesService` pair the old
 * widget used. The generation is decided on first use and remembered.
 */
import { LatLng, PlaceSuggestion } from '../../types';

/** Requires the Maps JS API with the places library (loaded by MapContainer). */
function placesLoaded(): boolean {
  return Boolean(
    (window as { google?: typeof google }).google?.maps?.places
  );
}

type Generation = 'new' | 'legacy';

let generation: Generation | null = null;

function hasNewApi(): boolean {
  return typeof (
    google.maps.places as { AutocompleteSuggestion?: unknown }
  ).AutocompleteSuggestion === 'function';
}

/**
 * Suggestions for a query. Never rejects: a geocoder that is down, denied or
 * still loading degrades to "no suggestions", leaving the dropzone list
 * usable.
 */
export async function searchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
  if (!placesLoaded() || query.trim() === '') {
    return [];
  }

  if (generation === null) {
    generation = hasNewApi() ? 'new' : 'legacy';
  }

  if (generation === 'new') {
    try {
      return await fetchNewSuggestions(query);
    } catch (error) {
      // Most likely Places API (New) is not enabled on the key: fall back
      // for the rest of the session rather than per keystroke.
      console.log('Places (New) autocomplete failed, falling back to legacy:', error);
      generation = 'legacy';
    }
  }

  try {
    return await fetchLegacySuggestions(query);
  } catch (error) {
    console.log('Places autocomplete failed:', error);

    return [];
  }
}

/**
 * Coordinates for a suggestion returned by `searchPlaceSuggestions`, or null
 * if they can't be fetched. `id` is a Google place id.
 */
export async function resolvePlaceSuggestion(id: string): Promise<LatLng | null> {
  if (!placesLoaded()) {
    return null;
  }

  try {
    return generation === 'legacy' ? await resolveLegacy(id) : await resolveNew(id);
  } catch (error) {
    console.log('Place details failed:', error);

    return null;
  }
}

// --- Places API (New) ------------------------------------------------------

interface NewPlacePrediction {
  placeId: string;
  mainText?: { text: string };
  secondaryText?: { text: string };
  text?: { text: string };
}

interface NewSuggestion {
  placePrediction?: NewPlacePrediction;
}

interface NewAutocompleteApi {
  fetchAutocompleteSuggestions: (
    request: { input: string }
  ) => Promise<{ suggestions: NewSuggestion[] }>;
}

interface NewPlaceApi {
  new (options: { id: string }): {
    fetchFields: (request: { fields: string[] }) => Promise<unknown>;
    location?: { lat: () => number; lng: () => number } | null;
  };
}

async function fetchNewSuggestions(query: string): Promise<PlaceSuggestion[]> {
  const api = (google.maps.places as unknown as {
    AutocompleteSuggestion: NewAutocompleteApi;
  }).AutocompleteSuggestion;

  const { suggestions } = await api.fetchAutocompleteSuggestions({ input: query });

  return suggestions
    .map(suggestion => suggestion.placePrediction)
    .filter((prediction): prediction is NewPlacePrediction => Boolean(prediction?.placeId))
    .map(prediction => ({
      id: prediction.placeId,
      label: prediction.mainText?.text ?? prediction.text?.text ?? '',
      detail: prediction.secondaryText?.text
    }))
    .filter(suggestion => suggestion.label !== '');
}

async function resolveNew(id: string): Promise<LatLng | null> {
  const PlaceClass = (google.maps.places as unknown as { Place: NewPlaceApi }).Place;
  const place = new PlaceClass({ id });

  await place.fetchFields({ fields: ['location'] });
  const location = place.location;

  return location ? { lat: location.lat(), lng: location.lng() } : null;
}

// --- Legacy Places ---------------------------------------------------------

function fetchLegacySuggestions(query: string): Promise<PlaceSuggestion[]> {
  return new Promise(resolve => {
    const service = new google.maps.places.AutocompleteService();

    service.getPlacePredictions({ input: query }, (predictions, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
        resolve([]);

        return;
      }

      resolve(
        predictions.map(prediction => ({
          id: prediction.place_id,
          label: prediction.structured_formatting?.main_text ?? prediction.description,
          detail: prediction.structured_formatting?.secondary_text
        }))
      );
    });
  });
}

function resolveLegacy(id: string): Promise<LatLng | null> {
  return new Promise(resolve => {
    // PlacesService needs an element (or map) to attribute results to; a
    // detached div is the documented way to use it without a map.
    const service = new google.maps.places.PlacesService(document.createElement('div'));

    service.getDetails({ placeId: id, fields: ['geometry'] }, (place, status) => {
      const location = place?.geometry?.location;

      if (status !== google.maps.places.PlacesServiceStatus.OK || !location) {
        resolve(null);

        return;
      }

      resolve({ lat: location.lat(), lng: location.lng() });
    });
  });
}
