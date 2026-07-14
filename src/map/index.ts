/**
 * Map abstraction entry point.
 *
 * Re-exports the provider-neutral adapter surface and binds it to the
 * active provider implementation (Google Maps). Layers and app code import
 * from here — never from `./google/` directly.
 */
export {
  DEFAULT_CURSOR,
  DEFAULT_ZOOM,
  MapControl,
  useMapClick,
  useMapCursor,
  useMapZoom
} from './MapAdapter';
export type {
  MapCircleProps,
  MapCircleStyle,
  MapContainerProps,
  MapDragHandleProps,
  MapOverlayProps,
  MapPolylineProps
} from './MapAdapter';

// Provider binding: the Google Maps implementation of the primitives.
export { MapCircle, MapContainer, MapDragHandle, MapOverlay, MapPolyline } from './google';
