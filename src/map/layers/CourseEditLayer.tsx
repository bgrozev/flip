/**
 * Course edit layer: drag handle for a custom course's center and a second
 * handle rotating its direction. Mounted only while course editing is active.
 */
import React, { useState } from 'react';

import { bearingBetween, destinationPoint } from '../../core/geometry';
import { LatLng } from '../../types';
import { MapDragHandle, MapPolyline } from '..';

export interface CourseEditTarget {
  center: LatLng;
  direction: number;
  onMove: (newCenter: LatLng) => void;
  onRotate: (newDirection: number) => void;
}

export interface CourseEditLayerProps {
  edit: CourseEditTarget;
}

export default function CourseEditLayer({ edit }: CourseEditLayerProps) {
  // Live position of the rotation handle while dragging (for smooth line preview)
  const [liveHandlePos, setLiveHandlePos] = useState<LatLng | null>(null);

  const rotationHandlePos = destinationPoint(edit.center, edit.direction, 15);
  const lineEnd = liveHandlePos ?? rotationHandlePos;

  return (
    <>
      {/* Line from center to rotation handle */}
      <MapPolyline
        path={[edit.center, lineEnd]}
        color="#ffaa00"
        weight={2}
        opacity={0.9}
        zIndex={25}
      />
      {/* Center drag marker (cyan crosshair) */}
      <MapDragHandle
        position={edit.center}
        cursor="move"
        zIndex={26}
        color="#00ccff"
        scale={9}
        onDragEnd={pos => edit.onMove(pos)}
      />
      {/* Rotation handle (orange dot at course-direction end) */}
      <MapDragHandle
        position={rotationHandlePos}
        cursor="pointer"
        zIndex={27}
        color="#ffaa00"
        scale={7}
        onDrag={pos => setLiveHandlePos(pos)}
        onDragEnd={pos => {
          setLiveHandlePos(null);
          edit.onRotate(bearingBetween(edit.center, pos));
        }}
      />
    </>
  );
}
