import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DEFAULT_CURSOR,
  DEFAULT_ZOOM,
  MapContainerProps,
  MapControlHostContext,
  MapInteractions,
  MapInteractionsContext,
  MapViewContext,
  MapViewState
} from '../MapAdapter';
import { LatLng } from '../../types';

import { DEFAULT_MAP_OPTIONS, GOOGLE_MAPS_LIBRARIES, MAP_CONTAINER_STYLE } from './mapConfig';

interface ClickEntry {
  handler: (pos: LatLng) => void;
  priority: number;
  seq: number;
}

/**
 * Google Maps implementation of the MapContainer contract: loads the Maps
 * JS API, renders the map, provides the adapter contexts (interactions,
 * view state, control host) and manages camera centering.
 */
export default function GoogleMapContainer({ center, initialZoom = DEFAULT_ZOOM, children }: MapContainerProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [controlHost, setControlHost] = useState<HTMLElement | null>(null);

  // Interaction registry (clicks + cursor overrides), mutated imperatively
  // so registering doesn't re-render the map.
  const clickHandlersRef = useRef<ClickEntry[]>([]);
  const cursorsRef = useRef<string[]>([]);
  const seqRef = useRef(0);

  const applyCursor = useCallback(() => {
    const cursors = cursorsRef.current;

    mapRef.current?.setOptions({
      draggableCursor: cursors.length > 0 ? cursors[cursors.length - 1] : DEFAULT_CURSOR
    });
  }, []);

  const interactions = useMemo<MapInteractions>(() => ({
    registerClickHandler: (handler, priority) => {
      const entry: ClickEntry = { handler, priority, seq: seqRef.current++ };

      clickHandlersRef.current.push(entry);

      return () => {
        clickHandlersRef.current = clickHandlersRef.current.filter(e => e !== entry);
      };
    },
    registerCursor: cursor => {
      cursorsRef.current.push(cursor);
      applyCursor();

      return () => {
        const i = cursorsRef.current.lastIndexOf(cursor);

        if (i !== -1) {
          cursorsRef.current.splice(i, 1);
        }
        applyCursor();
      };
    }
  }), [applyCursor]);

  // Latest center for use in the load callback without re-creating it.
  const centerRef = useRef(center);

  centerRef.current = center;

  // Latest initial zoom for the load callback (a remount between renders
  // must not resurrect a stale value).
  const initialZoomRef = useRef(initialZoom);

  initialZoomRef.current = initialZoom;

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    map.setCenter(centerRef.current);
    map.setZoom(initialZoomRef.current);
    applyCursor();
    console.log('Map loaded.');
  }, [applyCursor]);

  // Pan when the center prop changes (but not on every render).
  const prevCenterRef = useRef(center);

  useEffect(() => {
    if (mapRef.current && (prevCenterRef.current.lat !== center.lat || prevCenterRef.current.lng !== center.lng)) {
      mapRef.current.panTo(center);
      prevCenterRef.current = center;
    }
  }, [center]);

  // Re-apply when the requested initial zoom changes (e.g. a mode switch);
  // user zooming in between stays untouched.
  const prevInitialZoomRef = useRef(initialZoom);

  useEffect(() => {
    if (mapRef.current && prevInitialZoomRef.current !== initialZoom) {
      mapRef.current.setZoom(initialZoom);
      prevInitialZoomRef.current = initialZoom;
    }
  }, [initialZoom]);

  const onClick = useCallback((ev: google.maps.MapMouseEvent) => {
    if (!ev.latLng) {
      return;
    }
    const pos = { lat: ev.latLng.lat(), lng: ev.latLng.lng() };
    const handlers = clickHandlersRef.current;

    if (handlers.length === 0) {
      return;
    }

    // Dispatch to the highest-priority handler (latest registration wins ties).
    const top = handlers.reduce((a, b) =>
      (b.priority > a.priority || (b.priority === a.priority && b.seq > a.seq) ? b : a));

    top.handler(pos);
  }, []);

  const onZoomChanged = useCallback(() => {
    if (mapRef.current) {
      setZoom(mapRef.current.getZoom() ?? DEFAULT_ZOOM);
    }
  }, []);

  const viewState = useMemo<MapViewState>(() => ({ zoom }), [zoom]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'INSERT_GOOGLE_API_KEY',
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  // Move the fullscreen control to the bottom-right so it doesn't collide
  // with the winds indicator in the top-right corner. ControlPosition is
  // only available once the API has loaded.
  const mapOptions = useMemo(
    () =>
      isLoaded
        ? {
          ...DEFAULT_MAP_OPTIONS,
          fullscreenControlOptions: {
            position: google.maps.ControlPosition.BOTTOM_RIGHT
          }
        }
        : DEFAULT_MAP_OPTIONS,
    [isLoaded]
  );

  return isLoaded ? (
    <div ref={setControlHost} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapInteractionsContext.Provider value={interactions}>
        <MapViewContext.Provider value={viewState}>
          <MapControlHostContext.Provider value={controlHost}>
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              options={mapOptions}
              onLoad={onMapLoad}
              onClick={onClick}
              onZoomChanged={onZoomChanged}
            >
              {children}
            </GoogleMap>
          </MapControlHostContext.Provider>
        </MapViewContext.Provider>
      </MapInteractionsContext.Provider>
    </div>
  ) : (
    <>Loading</>
  );
}
