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

  return (
    <MarkerF
      position={position}
      draggable
      cursor={cursor}
      zIndex={zIndex}
      icon={icon}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      onDrag={onDrag && (e => {
        if (e.latLng) {
          onDrag({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
      })}
      onDragEnd={e => {
        if (e.latLng) {
          onDragEnd({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }
      }}
    />
  );
}
