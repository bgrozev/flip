/**
 * The initiation handle: drag where the turn starts.
 *
 * This is meant to be the primary way to set a turn up. Depth and offset
 * are a position expressed as two numbers, and a position is a thing you
 * point at — the fields stay for when a number is what you actually have.
 *
 * Always draggable, with no edit mode: the handle sits a few hundred feet
 * from the target, so unlike the course handles it never contends with the
 * target's own. Only offered for a parametric turn, since a recorded track
 * has no depth and offset to write back to.
 */
import React, { useState } from 'react';

import { LatLng } from '../../types';
import { metersToFeet } from '../../core/units';
import { distanceFeet, metersPerPixel } from '../../core/geometry';
import { MapDragHandle, useMapZoom } from '..';

import { PATH_COLORS } from './FlightPathsLayer';

/**
 * Closest the initiation handle may come to the target's before it is
 * withdrawn, in screen pixels.
 *
 * A shallow setup puts the two within a few feet of each other, and zooming
 * out shrinks any gap to nothing. Overlapping handles are what forced the
 * Courses panel into an explicit positioning mode — the wrong one silently
 * eats the drag. Measured in pixels because that is the units the problem
 * actually has.
 */
const MIN_TARGET_GAP_PX = 26;

export interface ManoeuvreEditTarget {
  /** The landing target, so the handle can keep clear of its handle. */
  target: LatLng;
  /**
   * Where the handle sits: the initiation point of the STILL-AIR path — the
   * dashed pre-wind line, not the solid one.
   *
   * The turn is described through the air (that is what depth and offset
   * are), and the wind-corrected path is the app's OUTPUT. Putting the
   * handle on the output meant dragging one line to set another, and the
   * drag then had to have the drift subtracted back out of it before the
   * numbers could be read off — an input dressed as a result.
   */
  initiation: LatLng;
  /**
   * Called once, on release, with the position the handle was dropped at —
   * still air, since that is the line it lives on. Deliberately not fired
   * mid-drag: settling the turn means re-solving its geometry and then
   * bisecting for its feasible bounds, which is far too much to repeat per
   * pointer move. The handle follows the pointer on its own until then —
   * the same bargain the target handle makes.
   */
  onMove: (point: LatLng) => void;
}

export interface ManoeuvreEditLayerProps {
  edit: ManoeuvreEditTarget;
}

export default function ManoeuvreEditLayer({ edit }: ManoeuvreEditLayerProps) {
  const [dragging, setDragging] = useState(false);
  const zoom = useMapZoom();
  const gapPx =
    distanceFeet(edit.target, edit.initiation) /
    metersToFeet /
    metersPerPixel(edit.target.lat, zoom);

  // Never while dragging: withdrawing the handle mid-drag drops the DOM node
  // and aborts the gesture, which reads as the handle jumping back.
  if (!dragging && gapPx < MIN_TARGET_GAP_PX) {
    return null;
  }

  return (
    <MapDragHandle
      position={edit.initiation}
      cursor="move"
      zIndex={26}
      color={PATH_COLORS.manoeuvre}
      scale={dragging ? 8 : 6}
      onDrag={() => setDragging(true)}
      onDragEnd={position => {
        setDragging(false);
        edit.onMove(position);
      }}
    />
  );
}
