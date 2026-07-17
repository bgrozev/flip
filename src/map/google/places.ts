import { LatLng } from '../../types';

/**
 * Attach a Google Places autocomplete to a text input. When the user picks
 * a place with a location, `onPlace` is called with its coordinates.
 *
 * Requires the Maps JS API (with the places library) to be loaded — it is
 * loaded by MapContainer; before that this is a no-op.
 *
 * Returns a disposer that detaches the autocomplete's listeners. Callers must
 * invoke it when the input goes away (or before re-attaching), otherwise every
 * attach leaves another live `place_changed` listener behind.
 */
export function attachPlaceAutocomplete(
  input: HTMLInputElement,
  onPlace: (pos: LatLng) => void
): () => void {
  if (!(window as { google?: typeof google }).google) {
    console.log('No window.google');

    return () => { /* nothing was attached */ };
  }

  const autocomplete = new google.maps.places.Autocomplete(input);

  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    const location = place.geometry?.location;

    if (location) {
      onPlace({ lat: location.lat(), lng: location.lng() });
    }
  });

  return () => {
    google.maps.event.clearInstanceListeners(autocomplete);
  };
}
