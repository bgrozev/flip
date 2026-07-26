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

  // Google auto-pans the map when a dragged marker nears the viewport edge,
  // and there is no option to turn that off. Freeze the map centre for the
  // duration of a handle drag (snap it back on any change) so dragging a
  // handle never scrolls the map.
  const markerRef = React.useRef<google.maps.Marker | null>(null);
  const freeze = React.useRef<google.maps.MapsEventListener | null>(null);

  const startFreeze = () => {
    const map = markerRef.current?.getMap() as google.maps.Map | null | undefined;
    const center = map?.getCenter();
    if (!map || !center) {
      return;
    }
    const locked = center;
    freeze.current = map.addListener('center_changed', () => map.setCenter(locked));
  };
  const endFreeze = () => {
    freeze.current?.remove();
    freeze.current = null;
  };

  React.useEffect(() => endFreeze, []);

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
      onDragStart={startFreeze}
      onDrag={onDrag && (e => {
        if (e.latLng) {
          onDrag({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
      })}
      onDragEnd={e => {
        endFreeze();
        if (e.latLng) {
          onDragEnd({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
      }}
    />
  );
}
