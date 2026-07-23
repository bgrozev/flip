/**
 * Target layer: an always-present, always-draggable landing-target handle.
 * Dragging it moves the target; there is no separate "edit" mode. The
 * final-heading rotate handle is revealed on hover/tap of the target and
 * hidden again shortly after, so it stays out of the way until wanted.
 * Shift-clicking the map jumps the target there (fast relocation); a plain
 * background click just dismisses a tapped reveal.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { bearingBetween, destinationPoint, metersPerPixel } from '../../core/geometry';
import { LatLng } from '../../types';
import { MapDragHandle, MapPolyline, useMapClick, useMapZoom } from '..';

/**
 * On-screen gap between the target handle and the heading handle. Kept in
 * pixels (converted to meters for the current zoom) so the two never collide:
 * a fixed distance in meters shrinks as you zoom out, which used to put the
 * heading handle on top of the target and steal its drags.
 */
const HEADING_HANDLE_OFFSET_PX = 44;

/** How long the rotate handle lingers after the pointer leaves (bridges the
 *  gap while moving from the target handle to the rotate handle). */
const REVEAL_HIDE_MS = 250;

export interface TargetEditTarget {
  target: LatLng;
  heading: number;
  onMove: (pos: LatLng) => void;
  onHeadingChange: (heading: number) => void;
  /**
   * Whether the final-heading rotate handle is offered. Modes that ignore
   * the target heading (flocking) pass false: only the move handle renders.
   */
  headingEditable?: boolean;
}

export interface TargetEditLayerProps {
  edit: TargetEditTarget;
}

export default function TargetEditLayer({ edit }: TargetEditLayerProps) {
  const [liveHeadingPos, setLiveHeadingPos] = useState<LatLng | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [movingTarget, setMovingTarget] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    setRevealed(true);
  }, []);

  const hideSoon = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    hideTimer.current = setTimeout(() => setRevealed(false), REVEAL_HIDE_MS);
  }, []);

  useEffect(() => () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
  }, []);

  // Shift-click relocates the target; a plain background click dismisses a
  // tapped reveal (the target moves by dragging its handle otherwise).
  useMapClick(
    (pos, mods) => {
      if (mods.shift) {
        edit.onMove(pos);
      } else {
        setRevealed(false);
      }
    },
    { enabled: true }
  );

  const headingEditable = edit.headingEditable !== false;

  const zoom = useMapZoom();
  const offsetM = HEADING_HANDLE_OFFSET_PX * metersPerPixel(edit.target.lat, zoom);
  const headingHandlePos = destinationPoint(edit.target, edit.heading, offsetM);
  const headingLineEnd = liveHeadingPos ?? headingHandlePos;

  const showRotate = headingEditable && revealed && !movingTarget;

  return (
    <>
      {showRotate && (
        <MapPolyline
          path={[edit.target, headingLineEnd]}
          color="#ffaa00"
          weight={2}
          opacity={0.9}
          zIndex={25}
        />
      )}
      <MapDragHandle
        position={edit.target}
        cursor="move"
        zIndex={26}
        color="#00ccff"
        scale={revealed ? 8 : 6}
        onClick={show}
        onMouseOver={show}
        onMouseOut={hideSoon}
        onDrag={() => {
          show();
          setMovingTarget(true);
        }}
        onDragEnd={pos => {
          setMovingTarget(false);
          edit.onMove(pos);
        }}
      />
      {showRotate && (
        <MapDragHandle
          position={headingHandlePos}
          cursor="pointer"
          zIndex={27}
          color="#ffaa00"
          scale={7}
          onMouseOver={show}
          onMouseOut={hideSoon}
          onDrag={pos => {
            show();
            setLiveHeadingPos(pos);
          }}
          onDragEnd={pos => {
            setLiveHeadingPos(null);
            edit.onHeadingChange(bearingBetween(edit.target, pos));
          }}
        />
      )}
    </>
  );
}
