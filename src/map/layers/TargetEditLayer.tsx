/**
 * Target edit layer: drag handle for the landing target position and a
 * second handle rotating the final heading. Mounted only while target
 * editing is active; map background clicks also move the target.
 */
import React, { useState } from 'react';

import { bearingBetween, destinationPoint, metersPerPixel } from '../../core/geometry';
import { LatLng } from '../../types';
import { MapDragHandle, MapPolyline, useMapClick, useMapCursor, useMapZoom } from '..';

/**
 * On-screen gap between the target handle and the heading handle. Kept in
 * pixels (converted to meters for the current zoom) so the two never collide:
 * a fixed distance in meters shrinks as you zoom out, which used to put the
 * heading handle on top of the target and steal its drags.
 */
const HEADING_HANDLE_OFFSET_PX = 40;

export interface TargetEditTarget {
  target: LatLng;
  heading: number;
  onMove: (pos: LatLng) => void;
  onHeadingChange: (heading: number) => void;
}

export interface TargetEditLayerProps {
  edit: TargetEditTarget;
}

export default function TargetEditLayer({ edit }: TargetEditLayerProps) {
  // Live position of the heading handle while dragging (for smooth line preview)
  const [liveHeadingPos, setLiveHeadingPos] = useState<LatLng | null>(null);

  // Crosshair cursor while editing; background clicks move the target
  // (priority 0 — the measure tool takes precedence when active).
  useMapCursor('crosshair');
  useMapClick(pos => edit.onMove(pos));

  const zoom = useMapZoom();
  const offsetM = HEADING_HANDLE_OFFSET_PX * metersPerPixel(edit.target.lat, zoom);
  const headingHandlePos = destinationPoint(edit.target, edit.heading, offsetM);
  const headingLineEnd = liveHeadingPos ?? headingHandlePos;

  return (
    <>
      <MapPolyline
        path={[edit.target, headingLineEnd]}
        color="#ffaa00"
        weight={2}
        opacity={0.9}
        zIndex={25}
      />
      <MapDragHandle
        position={edit.target}
        cursor="move"
        zIndex={26}
        color="#00ccff"
        scale={9}
        onDragEnd={pos => edit.onMove(pos)}
      />
      <MapDragHandle
        position={headingHandlePos}
        cursor="pointer"
        zIndex={27}
        color="#ffaa00"
        scale={7}
        onDrag={pos => setLiveHeadingPos(pos)}
        onDragEnd={pos => {
          setLiveHeadingPos(null);
          edit.onHeadingChange(bearingBetween(edit.target, pos));
        }}
      />
    </>
  );
}
