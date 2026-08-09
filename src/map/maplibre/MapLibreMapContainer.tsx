/**
 * MapLibre GL implementation of the MapContainer contract: creates the map,
 * provides the adapter contexts (interactions, view state, control host) and
 * its own map-instance context, and manages camera centering — matching
 * GoogleMapContainer's behavior so layers are provider-agnostic.
 */
import maplibregl from 'maplibre-gl';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import 'maplibre-gl/dist/maplibre-gl.css';

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

import { DEFAULT_MAPLIBRE_STYLE } from './mapConfig';
import { MapLibreMapContext } from './context';

/**
 * MapLibre max zoom is capped a little below Google's satellite depth; 22 is
 * MapLibre's own maximum and keeps the deep course-marker zooms (>= 20) usable
 * via overzoomed imagery.
 */
const MAX_ZOOM = 22;

export default function MapLibreMapContainer({ center, initialZoom = DEFAULT_ZOOM, children }: MapContainerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [controlHost, setControlHost] = useState<HTMLElement | null>(null);

  // Interaction registry (clicks + cursor overrides), mutated imperatively
  // so registering doesn't re-render the map.
  const clickHandlersRef = useRef<ClickEntry[]>([]);
  const cursorsRef = useRef<string[]>([]);
  const seqRef = useRef(0);

  const applyCursor = () => {
    const canvas = mapRef.current?.getCanvas();

    if (canvas) {
      const cursors = cursorsRef.current;

      canvas.style.cursor = cursors.length > 0 ? cursors[cursors.length - 1] : DEFAULT_CURSOR;
    }
  };

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
  }), []);

  // Latest center for use in one-off effects without re-subscribing.
  const centerRef = useRef(center);

  centerRef.current = center;

  // Latest initial zoom for the (deferred) map creation.
  const initialZoomRef = useRef(initialZoom);

  initialZoomRef.current = initialZoom;

  // Create the map once, on mount.
  useEffect(() => {
    const wrap = wrapperRef.current;

    if (!wrap) {
      return undefined;
    }

    let instance: maplibregl.Map | null = null;
    let reflowObserver: ResizeObserver | null = null;
    let startObserver: ResizeObserver | null = null;

    const createMap = () => {
      const map = new maplibregl.Map({
        container: wrap,
        style: DEFAULT_MAPLIBRE_STYLE,
        center: [centerRef.current.lng, centerRef.current.lat],
        zoom: initialZoomRef.current,
        maxZoom: MAX_ZOOM,
        attributionControl: { compact: true },
        // Keep parity with the Google adapter's flat, north-up satellite view.
        dragRotate: false,
        pitchWithRotate: false,
        touchZoomRotate: true
      });

      map.touchZoomRotate.disableRotation();
      instance = map;
      mapRef.current = map;

      map.on('load', () => {
        applyCursor();
        setMap(map);
      });

      map.on('zoom', () => setZoom(map.getZoom()));

      map.on('click', ev => {
        dispatchMapClick(
          clickHandlersRef.current,
          { lat: ev.lngLat.lat, lng: ev.lngLat.lng },
          { shift: Boolean(ev.originalEvent?.shiftKey) }
        );
      });

      // Reflow on later container size changes (e.g. the side panel opening or
      // closing), matching the Google adapter's automatic reflow.
      reflowObserver = new ResizeObserver(() => map.resize());
      reflowObserver.observe(wrap);
    };

    // A MapLibre map created in a zero-size container never renders — so its
    // 'load' never fires and no tiles are requested — and it does not recover
    // on its own. Inside the flex dashboard layout the container can be unsized
    // for the first frame(s), so defer creation until it has a real size.
    if (wrap.clientWidth > 0 && wrap.clientHeight > 0) {
      createMap();
    } else {
      startObserver = new ResizeObserver(() => {
        if (wrap.clientWidth > 0 && wrap.clientHeight > 0) {
          startObserver?.disconnect();
          startObserver = null;
          createMap();
        }
      });
      startObserver.observe(wrap);
    }

    return () => {
      startObserver?.disconnect();
      reflowObserver?.disconnect();
      instance?.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

  // Pan when the center prop changes (but not on every render).
  const prevCenterRef = useRef(center);

  useEffect(() => {
    if (mapRef.current && (prevCenterRef.current.lat !== center.lat || prevCenterRef.current.lng !== center.lng)) {
      prevCenterRef.current = center;
      if (!handleDraggingRef.current) {
        mapRef.current.panTo([center.lng, center.lat]);
      }
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

  const viewState = useMemo<MapViewState>(() => ({ zoom }), [zoom]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Map canvas host. */}
      <div ref={wrapperRef} style={{ position: 'absolute', inset: 0 }} />
      {/* Overlay/control host, above the canvas, so MapControl portals land here. */}
      <div ref={setControlHost} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {!map && (
          <div style={{ pointerEvents: 'auto' }}>Loading</div>
        )}
      </div>
      {map && (
        <MapLibreMapContext.Provider value={map}>
          <MapInteractionsContext.Provider value={interactions}>
            <MapViewContext.Provider value={viewState}>
              <MapControlHostContext.Provider value={controlHost}>
                {children}
              </MapControlHostContext.Provider>
            </MapViewContext.Provider>
          </MapInteractionsContext.Provider>
        </MapLibreMapContext.Provider>
      )}
    </div>
  );
}
