/**
 * MapLibre GL implementations of the adapter's primitive components
 * (polyline, circle, DOM overlay, drag handle). Each manages its own
 * MapLibre sources/layers/markers imperatively against the map instance from
 * the internal MapLibre context, mirroring `../google/primitives.tsx`.
 */
import maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LineLayerSpecification } from 'maplibre-gl';
import type { Feature, LineString } from 'geojson';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  MapCircleProps,
  MapDragHandleProps,
  MapOverlayProps,
  MapPolylineProps
} from '../MapAdapter';
import { LatLng } from '../../types';

import { meterCirclePolygon } from './circle';
import { useMapLibreMap } from './context';
import { addOrderedLayer, isMapRemoved, removeOrderedLayer } from './layerOrder';

function lineFeature(path: LatLng[]): Feature<LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: path.map(p => [p.lng, p.lat]) }
  };
}

export function MapPolyline({
  path,
  color,
  opacity = 1,
  weight = 2,
  zIndex = 0,
  dotted = false
}: MapPolylineProps) {
  const map = useMapLibreMap();
  const rawId = useId().replace(/:/g, '');
  const sourceId = `line-src-${rawId}`;
  const layerId = `line-lyr-${rawId}`;

  // Create the source + layer once (children mount only after the map loads,
  // so `map` is stable and non-null for the component's lifetime).
  useEffect(() => {
    if (!map) {
      return undefined;
    }
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: lineFeature(path) });
    }

    const layer: LineLayerSpecification = {
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': color,
        'line-width': weight,
        'line-opacity': dotted ? 1 : opacity,
        // Round-capped [0, gap] dashes render as dots (gap is in line-widths).
        ...(dotted ? { 'line-dasharray': [0, 2] as [number, number] } : {})
      }
    };

    addOrderedLayer(map, layer, zIndex);

    return () => {
      removeOrderedLayer(map, layerId);
      if (!isMapRemoved(map) && map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update geometry when the path changes.
  useEffect(() => {
    const src = map?.getSource(sourceId) as GeoJSONSource | undefined;

    src?.setData(lineFeature(path));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, path]);

  // Update dynamic paint props when they change.
  useEffect(() => {
    if (!map || !map.getLayer(layerId)) {
      return;
    }
    map.setPaintProperty(layerId, 'line-color', color);
    map.setPaintProperty(layerId, 'line-width', weight);
    map.setPaintProperty(layerId, 'line-opacity', dotted ? 1 : opacity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, color, weight, opacity, dotted]);

  return null;
}

export function MapCircle({
  center,
  radius,
  fillColor,
  fillOpacity,
  strokeColor,
  strokeOpacity,
  strokeWeight,
  zIndex = 0,
  clickable = false,
  onClick,
  onMouseOver,
  onMouseOut
}: MapCircleProps) {
  const map = useMapLibreMap();
  const rawId = useId().replace(/:/g, '');
  const sourceId = `circle-src-${rawId}`;
  const fillId = `circle-fill-${rawId}`;
  const lineId = `circle-line-${rawId}`;

  const hasStroke = strokeColor !== undefined && (strokeWeight ?? 0) > 0;

  // Keep the latest event handlers reachable from the (once-registered)
  // MapLibre listeners without re-subscribing.
  const handlers = useRef({ onClick, onMouseOver, onMouseOut });

  handlers.current = { onClick, onMouseOver, onMouseOut };

  useEffect(() => {
    if (!map) {
      return undefined;
    }
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: meterCirclePolygon(center, radius) });
    }

    addOrderedLayer(map, {
      id: fillId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': fillColor ?? '#000000',
        'fill-opacity': fillOpacity ?? 0
      }
    }, zIndex);

    if (hasStroke) {
      addOrderedLayer(map, {
        id: lineId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': strokeColor as string,
          'line-width': strokeWeight as number,
          'line-opacity': strokeOpacity ?? 1
        }
      }, zIndex);
    }

    let onClickL: ((e: unknown) => void) | undefined;
    let onEnterL: (() => void) | undefined;
    let onLeaveL: (() => void) | undefined;

    if (clickable) {
      onClickL = () => handlers.current.onClick?.();
      onEnterL = () => {
        map.getCanvas().style.cursor = 'pointer';
        handlers.current.onMouseOver?.();
      };
      onLeaveL = () => {
        map.getCanvas().style.cursor = '';
        handlers.current.onMouseOut?.();
      };
      map.on('click', fillId, onClickL as () => void);
      map.on('mouseenter', fillId, onEnterL);
      map.on('mouseleave', fillId, onLeaveL);
    }

    return () => {
      if (clickable && !isMapRemoved(map)) {
        map.off('click', fillId, onClickL as () => void);
        map.off('mouseenter', fillId, onEnterL as () => void);
        map.off('mouseleave', fillId, onLeaveL as () => void);
      }
      removeOrderedLayer(map, fillId);
      removeOrderedLayer(map, lineId);
      if (!isMapRemoved(map) && map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, clickable, hasStroke]);

  // Update geometry when center/radius change.
  useEffect(() => {
    const src = map?.getSource(sourceId) as GeoJSONSource | undefined;

    src?.setData(meterCirclePolygon(center, radius));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, center.lat, center.lng, radius]);

  // Update dynamic paint props.
  useEffect(() => {
    if (!map || !map.getLayer(fillId)) {
      return;
    }
    map.setPaintProperty(fillId, 'fill-color', fillColor ?? '#000000');
    map.setPaintProperty(fillId, 'fill-opacity', fillOpacity ?? 0);
    if (hasStroke && map.getLayer(lineId)) {
      map.setPaintProperty(lineId, 'line-color', strokeColor as string);
      map.setPaintProperty(lineId, 'line-width', strokeWeight as number);
      map.setPaintProperty(lineId, 'line-opacity', strokeOpacity ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fillColor, fillOpacity, strokeColor, strokeWeight, strokeOpacity, hasStroke]);

  return null;
}

export function MapOverlay({ position, children }: MapOverlayProps) {
  const map = useMapLibreMap();
  const [el] = useState(() => {
    // Anchor the element's top-left at the geo point; children self-center via
    // CSS transforms, matching the Google OverlayView contract.
    const div = document.createElement('div');

    div.style.width = '0';
    div.style.height = '0';

    return div;
  });
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!map) {
      return undefined;
    }
    const marker = new maplibregl.Marker({ element: el, anchor: 'top-left' })
      .setLngLat([position.lng, position.lat])
      .addTo(map);

    markerRef.current = marker;

    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, el]);

  // Reposition without re-creating the marker.
  useEffect(() => {
    markerRef.current?.setLngLat([position.lng, position.lat]);
  }, [position.lat, position.lng]);

  return createPortal(children, el);
}

export function MapDragHandle({
  position,
  color,
  scale,
  cursor,
  zIndex,
  onDrag,
  onDragEnd
}: MapDragHandleProps) {
  const map = useMapLibreMap();
  const handlers = useRef({ onDrag, onDragEnd });

  handlers.current = { onDrag, onDragEnd };

  const [el] = useState(() => document.createElement('div'));
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Style the handle element (circular, white-ringed, screen-fixed size).
  useEffect(() => {
    const size = scale * 2;

    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = '50%';
    el.style.background = color;
    el.style.opacity = '0.85';
    el.style.border = '2px solid #fff';
    el.style.boxSizing = 'border-box';
    el.style.cursor = cursor ?? 'pointer';
    if (zIndex !== undefined) {
      el.style.zIndex = String(zIndex);
    }
  }, [el, color, scale, cursor, zIndex]);

  useEffect(() => {
    if (!map) {
      return undefined;
    }
    const marker = new maplibregl.Marker({ element: el, anchor: 'center', draggable: true })
      .setLngLat([position.lng, position.lat])
      .addTo(map);

    marker.on('drag', () => {
      const l = marker.getLngLat();

      handlers.current.onDrag?.({ lat: l.lat, lng: l.lng });
    });
    marker.on('dragend', () => {
      const l = marker.getLngLat();

      handlers.current.onDragEnd({ lat: l.lat, lng: l.lng });
    });

    markerRef.current = marker;

    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, el]);

  // Keep the handle anchored to the controlled position while not dragging.
  useEffect(() => {
    markerRef.current?.setLngLat([position.lng, position.lat]);
  }, [position.lat, position.lng]);

  return null;
}
