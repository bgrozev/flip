/**
 * Google-Maps-specific configuration and style fragments.
 */
import { DEFAULT_ZOOM } from '../MapAdapter';

export const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places'];

/**
 * Script identity for the Maps JS API. The map container and the place
 * search each load the API independently (the picker is reachable on mobile
 * without the map ever mounting), so both must pass exactly the same id,
 * key and libraries — the loader dedupes on the id, but only keeps the
 * existing script if the URL matches too.
 */
export const GOOGLE_MAPS_SCRIPT_ID = 'google-map-script';

export const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'INSERT_GOOGLE_API_KEY';

export const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '100%'
} as const;

export const DEFAULT_MAP_OPTIONS = {
  mapTypeControl: false,
  streetViewControl: false,
  tilt: 0,
  rotateControl: false,
  mapTypeId: 'satellite' as const,
  zoom: DEFAULT_ZOOM
} as const;

/**
 * Icon sequence rendering a polyline as a dotted line (used with
 * strokeOpacity 0 so only the dots are visible). The dots inherit the
 * polyline's strokeColor.
 */
export const DOTTED_LINE_ICONS = [
  {
    icon: {
      path: 'M 0,-1 0,1',
      strokeOpacity: 1.0,
      scale: 2
    },
    offset: '0',
    repeat: '12px'
  }
];
