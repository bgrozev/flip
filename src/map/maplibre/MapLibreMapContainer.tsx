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
import { LatLng } from '../../types';

import { DEFAULT_MAPLIBRE_STYLE } from './mapConfig';
import { MapLibreMapContext } from './context';

interface ClickEntry {
  handler: (pos: LatLng) => void;
  priority: number;
  seq: number;
}

/**
 * MapLibre max zoom is capped a little below Google's satellite depth; 22 is
 * MapLibre's own maximum and keeps the deep course-marker zooms (>= 20) usable
 * via overzoomed imagery.
 */
const MAX_ZOOM = 22;

export default function MapLibreMapContainer({ center, children }: MapContainerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
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
  }), []);

  // Latest center for use in one-off effects without re-subscribing.
  const centerRef = useRef(center);

  centerRef.current = center;

  // Create the map once, on mount.
  useEffect(() => {
    if (!wrapperRef.current) {
      return undefined;
    }

    const instance = new maplibregl.Map({
      container: wrapperRef.current,
      style: DEFAULT_MAPLIBRE_STYLE,
      center: [centerRef.current.lng, centerRef.current.lat],
      zoom: DEFAULT_ZOOM,
      maxZoom: MAX_ZOOM,
      attributionControl: { compact: true },
      // Keep parity with the Google adapter's flat, north-up satellite view.
      dragRotate: false,
      pitchWithRotate: false,
      touchZoomRotate: true
    });

    instance.touchZoomRotate.disableRotation();

    mapRef.current = instance;

    instance.on('load', () => {
      applyCursor();
      // Re-measure now that the style has loaded: inside the flex dashboard
      // layout the map can be created before the container reaches its final
      // size, and MapLibre otherwise keeps that stale size until the next
      // resize event.
      instance.resize();
      setMap(instance);
    });

    // Also resize on later container size changes (e.g. the side panel opening
    // or closing), matching the Google adapter's automatic reflow.
    const resizeObserver = new ResizeObserver(() => instance.resize());

    resizeObserver.observe(wrapperRef.current);

    instance.on('zoom', () => setZoom(instance.getZoom()));

    instance.on('click', ev => {
      const handlers = clickHandlersRef.current;

      if (handlers.length === 0) {
        return;
      }
      const pos = { lat: ev.lngLat.lat, lng: ev.lngLat.lng };
      // Highest-priority handler wins; latest registration breaks ties.
      const top = handlers.reduce((a, b) =>
        (b.priority > a.priority || (b.priority === a.priority && b.seq > a.seq) ? b : a));

      top.handler(pos);
    });

    return () => {
      resizeObserver.disconnect();
      instance.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

  // Pan when the center prop changes (but not on every render).
  const prevCenterRef = useRef(center);

  useEffect(() => {
    if (mapRef.current && (prevCenterRef.current.lat !== center.lat || prevCenterRef.current.lng !== center.lng)) {
      mapRef.current.panTo([center.lng, center.lat]);
      prevCenterRef.current = center;
    }
  }, [center]);

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
