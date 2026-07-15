import { LatLng } from '../../types';

/**
 * Attach a Google Places autocomplete to a text input. When the user picks
 * a place with a location, `onPlace` is called with its coordinates.
 *
 * Requires the Maps JS API (with the places library) to be loaded — it is
 * loaded by MapContainer; before that this is a no-op.
 */
export function attachPlaceAutocomplete(
  input: HTMLInputElement,
  onPlace: (pos: LatLng) => void
): void {
  if (!(window as { google?: typeof google }).google) {
    console.log('No window.google');

    return;
  }

  const autocomplete = new google.maps.places.Autocomplete(input);

  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    const location = place.geometry?.location;

    if (location) {
      onPlace({ lat: location.lat(), lng: location.lng() });
    }
  });
}
