/**
 * Map abstraction entry point.
 *
 * Re-exports the provider-neutral adapter surface. The primitives are bound
 * to provider-dispatching wrappers (`./dispatch`) that render the Google or
 * MapLibre implementation according to the active provider. Layers and app
 * code import from here — never from `./google/` or `./maplibre/` directly.
 */
export {
  DEFAULT_CURSOR,
  DEFAULT_ZOOM,
  MapControl,
  useMapClick,
  useMapCursor,
  useMapProvider,
  useMapZoom
} from './MapAdapter';
export type {
  MapCircleProps,
  MapCircleStyle,
  MapContainerProps,
  MapDispatchContainerProps,
  MapDragHandleProps,
  MapOverlayProps,
  MapPolylineProps
} from './MapAdapter';

// Provider binding: the runtime dispatchers (Google or MapLibre per provider).
export {
  PlaceSearchLoader,
  searchPlaceSuggestions,
  resolvePlaceSuggestion,
  MapCircle,
  MapContainer,
  MapDragHandle,
  MapOverlay,
  MapPolyline
} from './dispatch';
