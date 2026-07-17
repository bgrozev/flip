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
import { LatLng, MapProvider } from '../types';
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
 * Attach a place-search autocomplete to an input, using the given provider's
 * geocoder (Google Places or, for MapLibre, key-free Photon). Not a component,
 * so the provider is passed explicitly rather than read from context; the
 * MapLibre geocoder is loaded lazily from the shared MapLibre chunk.
 *
 * Returns a disposer; call it when the input goes away or before re-attaching.
 * It is safe to dispose before the lazy MapLibre chunk has loaded — the attach
 * is then skipped entirely.
 */
export function attachPlaceAutocomplete(
  input: HTMLInputElement,
  onPlace: (pos: LatLng) => void,
  provider: MapProvider = 'google'
): () => void {
  if (provider !== 'maplibre') {
    return google.attachPlaceAutocomplete(input, onPlace);
  }

  // Lazy chunk: it may resolve after the caller has already disposed.
  let disposed = false;
  let dispose: (() => void) | null = null;

  import('./maplibre').then(m => {
    if (disposed) {
      return;
    }
    dispose = m.attachPlaceAutocomplete(input, onPlace);
  });

  return () => {
    disposed = true;
    dispose?.();
  };
}
