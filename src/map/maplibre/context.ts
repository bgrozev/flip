/**
 * Internal MapLibre map-instance context. Mirrors the role Google's
 * `@react-google-maps/api` context plays for its primitives: it hands the
 * live `maplibregl.Map` to the MapLibre primitive components so they can add
 * their sources/layers/markers. Confined to `src/map/maplibre/`.
 */
import { createContext, useContext } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';

export const MapLibreMapContext = createContext<MapLibreMap | null>(null);

/** The live MapLibre map for the surrounding container, or null before load. */
export function useMapLibreMap(): MapLibreMap | null {
  return useContext(MapLibreMapContext);
}
