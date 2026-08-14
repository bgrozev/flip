/**
 * Loads the Maps JS API (with the places library) for the place search,
 * without a map.
 *
 * The place picker needs Google Places, but on mobile it is reached by
 * opening a panel that replaces the map — so `MapContainer` may never mount
 * and, before this existed, the geocoder silently returned nothing there.
 * Mounting this component loads the same script the map loads: the loader
 * dedupes on script id + URL, so whichever mounts first pays for it and the
 * other reuses it.
 *
 * Renders nothing.
 */
import { useJsApiLoader } from '@react-google-maps/api';
import { useEffect } from 'react';

import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_SCRIPT_ID } from './mapConfig';

interface PlacesLoaderProps {
  /** Called once the API is usable, so a pending search can be retried. */
  onReady: () => void;
}

export default function PlacesLoader({ onReady }: PlacesLoaderProps) {
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  useEffect(() => {
    if (isLoaded) {
      onReady();
    }
  }, [isLoaded, onReady]);

  return null;
}
