/**
 * Provider-neutral primitive dispatchers.
 *
 * Each primitive here is a thin wrapper that renders the Google or MapLibre
 * implementation according to the active provider. `MapContainer` reads its
 * `provider` prop (fed from settings) and both mounts the matching provider
 * container and publishes the provider via `MapProviderContext`; the other
 * primitives read that context and delegate. Layers and app code import these
 * names from `src/map` and never touch a concrete provider directly.
 *
 * The MapLibre implementation (and the heavy `maplibre-gl` library) is loaded
 * lazily via dynamic import, so it is code-split into its own chunk: the
 * default Google build never downloads it.
 */
import React, { lazy, Suspense } from 'react';

import {
  MapCircleProps,
  MapDispatchContainerProps,
  MapDragHandleProps,
  MapOverlayProps,
  MapPolylineProps,
  MapProviderContext,
  useMapProvider
} from './MapAdapter';
import { LatLng, MapProvider, PlaceSuggestion } from '../types';
import * as google from './google';

// All MapLibre pieces resolve from the same dynamic import, so they share one
// async chunk (which also contains maplibre-gl).
const MaplibreContainer = lazy(() =>
  import('./maplibre').then(m => ({ default: m.MapLibreMapContainer })));
const MaplibrePolyline = lazy(() =>
  import('./maplibre').then(m => ({ default: m.MapPolyline })));
const MaplibreCircle = lazy(() =>
  import('./maplibre').then(m => ({ default: m.MapCircle })));
const MaplibreOverlay = lazy(() =>
  import('./maplibre').then(m => ({ default: m.MapOverlay })));
const MaplibreDragHandle = lazy(() =>
  import('./maplibre').then(m => ({ default: m.MapDragHandle })));

/**
 * The map itself. Mounts the provider's container and makes the provider
 * available to descendant primitive dispatchers.
 */
export function MapContainer({ provider = 'google', ...props }: MapDispatchContainerProps) {
  return (
    <MapProviderContext.Provider value={provider}>
      {provider === 'maplibre'
        ? <Suspense fallback={<>Loading</>}><MaplibreContainer {...props} /></Suspense>
        : <google.MapContainer {...props} />}
    </MapProviderContext.Provider>
  );
}

export function MapPolyline(props: MapPolylineProps) {
  return useMapProvider() === 'maplibre'
    ? <Suspense fallback={null}><MaplibrePolyline {...props} /></Suspense>
    : <google.MapPolyline {...props} />;
}

export function MapCircle(props: MapCircleProps) {
  return useMapProvider() === 'maplibre'
    ? <Suspense fallback={null}><MaplibreCircle {...props} /></Suspense>
    : <google.MapCircle {...props} />;
}

export function MapOverlay(props: MapOverlayProps) {
  return useMapProvider() === 'maplibre'
    ? <Suspense fallback={null}><MaplibreOverlay {...props} /></Suspense>
    : <google.MapOverlay {...props} />;
}

export function MapDragHandle(props: MapDragHandleProps) {
  return useMapProvider() === 'maplibre'
    ? <Suspense fallback={null}><MaplibreDragHandle {...props} /></Suspense>
    : <google.MapDragHandle {...props} />;
}

/**
 * Search the given provider's geocoder (Google Places, or key-free Photon
 * under MapLibre). Not a component, so the provider is passed explicitly
 * rather than read from context; the MapLibre geocoder is loaded lazily from
 * the shared MapLibre chunk.
 *
 * Never rejects: a geocoder that is down or unavailable yields no
 * suggestions, which leaves the rest of the place picker working.
 */
export async function searchPlaceSuggestions(
  query: string,
  provider: MapProvider = 'google'
): Promise<PlaceSuggestion[]> {
  if (provider !== 'maplibre') {
    return google.searchPlaceSuggestions(query);
  }

  const m = await import('./maplibre');

  return m.searchPlaceSuggestions(query);
}

/**
 * Coordinates for a suggestion from `searchPlaceSuggestions`. Pass the same
 * provider that produced it — suggestion ids are provider-specific.
 */
export async function resolvePlaceSuggestion(
  id: string,
  provider: MapProvider = 'google'
): Promise<LatLng | null> {
  if (provider !== 'maplibre') {
    return google.resolvePlaceSuggestion(id);
  }

  const m = await import('./maplibre');

  return m.resolvePlaceSuggestion(id);
}
