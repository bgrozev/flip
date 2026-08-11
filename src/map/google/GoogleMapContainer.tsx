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
import { ClickEntry, dispatchMapClick } from '../clickDispatch';

import {
  DEFAULT_MAP_OPTIONS,
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LIBRARIES,
  GOOGLE_MAPS_SCRIPT_ID,
  MAP_CONTAINER_STYLE
} from './mapConfig';

/**
 * Google Maps implementation of the MapContainer contract: loads the Maps
 * JS API, renders the map, provides the adapter contexts (interactions,
 * view state, control host) and manages camera centering.
 */
export default function GoogleMapContainer({
  center,
  initialZoom = DEFAULT_ZOOM,
  onZoomChange,
  showLabels = false,
  children
}: MapContainerProps) {
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

  // Suppress camera panning while a drag handle is active (see the center
  // effect below).
  const handleDraggingRef = useRef(false);

  const interactions = useMemo<MapInteractions>(() => ({
    registerClickHandler: (handler, priority, options) => {
      const entry: ClickEntry = {
        handler, priority, seq: seqRef.current++, observe: options?.observe ?? false
      };

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
    },
    setHandleDragging: dragging => {
      handleDraggingRef.current = dragging;
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
      // Keep the tracked center current so no deferred pan fires after the
      // drag, but don't move the camera while a handle is being dragged.
      prevCenterRef.current = center;
      if (!handleDraggingRef.current) {
        mapRef.current.panTo(center);
      }
    }
  }, [center]);

  // Re-apply when the requested initial zoom changes (e.g. a mode switch);
  // user zooming in between stays untouched.
  //
  // The caller may also be REMEMBERING the zoom, which feeds the user's own
  // zooming straight back in as a new `initialZoom` — so a value the map is
  // already at is not re-applied, and the loop stops at one render instead of
  // bouncing setZoom against zoom_changed.
  const prevInitialZoomRef = useRef(initialZoom);

  useEffect(() => {
    if (mapRef.current && prevInitialZoomRef.current !== initialZoom) {
      prevInitialZoomRef.current = initialZoom;

      if (mapRef.current.getZoom() !== initialZoom) {
        mapRef.current.setZoom(initialZoom);
      }
    }
  }, [initialZoom]);

  const onClick = useCallback((ev: google.maps.MapMouseEvent) => {
    if (!ev.latLng) {
      return;
    }
    const pos = { lat: ev.latLng.lat(), lng: ev.latLng.lng() };
    const shift = Boolean((ev.domEvent as MouseEvent | undefined)?.shiftKey);

    dispatchMapClick(clickHandlersRef.current, pos, { shift });
  }, []);

  // Read through a ref so the handler stays stable across renders — it is a
  // prop on the map element, and a fresh identity rebinds the listener.
  const onZoomChangeRef = useRef(onZoomChange);

  onZoomChangeRef.current = onZoomChange;

  const onZoomChanged = useCallback(() => {
    if (mapRef.current) {
      const next = mapRef.current.getZoom() ?? DEFAULT_ZOOM;

      setZoom(next);
      onZoomChangeRef.current?.(next);
    }
  }, []);

  const viewState = useMemo<MapViewState>(() => ({ zoom }), [zoom]);

  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_SCRIPT_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  // Move the fullscreen control to the bottom-right so it doesn't collide
  // with the winds indicator in the top-right corner. ControlPosition is
  // only available once the API has loaded. `hybrid` is `satellite` plus
  // Google's labels layer, so the labels setting is just the map type.
  const mapOptions = useMemo(
    () => {
      const mapTypeId = showLabels ? 'hybrid' : 'satellite';

      return isLoaded
        ? {
          ...DEFAULT_MAP_OPTIONS,
          mapTypeId,
          fullscreenControlOptions: {
            position: google.maps.ControlPosition.BOTTOM_RIGHT
          }
        }
        : { ...DEFAULT_MAP_OPTIONS, mapTypeId };
    },
    [isLoaded, showLabels]
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
