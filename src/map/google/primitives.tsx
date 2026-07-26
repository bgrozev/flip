/**
 * Google Maps implementations of the adapter's primitive components
 * (polyline, circle, DOM overlay, drag handle).
 */
import { CircleF, MarkerF, OverlayView, PolylineF } from '@react-google-maps/api';
import React from 'react';

import {
  MapCircleProps,
  MapDragHandleProps,
  MapOverlayProps,
  MapPolylineProps
} from '../MapAdapter';

import { DOTTED_LINE_ICONS } from './mapConfig';

export function MapPolyline({
  path,
  color,
  opacity = 1,
  weight = 2,
  zIndex,
  clickable = false,
  dotted = false
}: MapPolylineProps) {
  const options: google.maps.PolylineOptions = dotted
    ? {
      strokeColor: color,
      strokeOpacity: 0,
      strokeWeight: weight,
      zIndex,
      clickable,
      icons: DOTTED_LINE_ICONS
    }
    : {
      strokeColor: color,
      strokeOpacity: opacity,
      strokeWeight: weight,
      zIndex,
      clickable
    };

  return <PolylineF path={path} options={options} />;
}

export function MapCircle({
  center,
  radius,
  fillColor,
  fillOpacity,
  strokeColor,
  strokeOpacity,
  strokeWeight,
  zIndex,
  clickable = false,
  onClick,
  onMouseOver,
  onMouseOut
}: MapCircleProps) {
  const options: google.maps.CircleOptions = {
    radius,
    fillColor,
    fillOpacity,
    strokeColor,
    strokeOpacity,
    strokeWeight,
    zIndex,
    clickable
  };

  return (
    <CircleF
      center={center}
      options={options}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
    />
  );
}

export function MapOverlay({ position, children }: MapOverlayProps) {
  return (
    <OverlayView position={position} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
      {children}
    </OverlayView>
  );
}

export function MapDragHandle({
  position,
  color,
  scale,
  cursor,
  zIndex,
  onDrag,
  onDragEnd,
  onClick,
  onMouseOver,
  onMouseOut
}: MapDragHandleProps) {
  const icon: google.maps.Symbol = {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 0.85,
    strokeColor: '#fff',
    strokeWeight: 2
  };

  const markerRef = React.useRef<google.maps.Marker | null>(null);
  const freeze = React.useRef<google.maps.MapsEventListener | null>(null);
  const dragging = React.useRef(false);

  // Google auto-pans the map when a dragged marker nears the viewport edge,
  // with no option to turn it off. Freeze the map centre for the duration of
  // a handle drag: snap it back on any change (guarded against the
  // synchronous re-entry that setCenter would otherwise cause).
  const startFreeze = () => {
    const map = markerRef.current?.getMap() as google.maps.Map | null | undefined;
    const locked = map?.getCenter();
    if (!map || !locked) {
      return;
    }
    freeze.current = map.addListener('center_changed', () => {
      const c = map.getCenter();
      if (c && !c.equals(locked)) {
        map.setCenter(locked);
      }
    });
  };
  const endFreeze = () => {
    freeze.current?.remove();
    freeze.current = null;
  };

  React.useEffect(() => endFreeze, []);

  // Keep the marker a controlled component: after a native drag the marker
  // is left wherever the pointer released it, so re-assert the prop position
  // once the drag is over (rotation handles move the handle to a derived
  // spot, not the raw drop point). Skipped mid-drag so it doesn't fight the
  // live drag.
  React.useEffect(() => {
    if (!dragging.current) {
      markerRef.current?.setPosition(position);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.lat, position.lng]);

  return (
    <MarkerF
      position={position}
      draggable
      cursor={cursor}
      zIndex={zIndex}
      icon={icon}
      onLoad={m => {
        markerRef.current = m;
      }}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      onDragStart={() => {
        dragging.current = true;
        startFreeze();
      }}
      onDrag={onDrag && (e => {
        if (e.latLng) {
          onDrag({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
      })}
      onDragEnd={e => {
        dragging.current = false;
        endFreeze();
        if (e.latLng) {
          onDragEnd({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
        // Re-assert the controlled position (the derived spot may differ
        // from where the pointer released).
        markerRef.current?.setPosition(position);
      }}
    />
  );
}
