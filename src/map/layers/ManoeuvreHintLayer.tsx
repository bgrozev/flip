/**
 * The turn hint: what the manoeuvre's numbers mean, drawn on the map.
 *
 * The parameters are all measured against the final approach axis, and that
 * axis is invisible — which is exactly what made the old panel unreadable
 * ("left of what?"). So the layer draws the reference frame itself: the
 * final line the turn arrives on, the direction you are flying when you
 * start, and how far round you go.
 *
 * Everything here is measured from the path, so a recorded track or a
 * sample is described the same way a parametric turn is.
 */
import React from 'react';

import { MapOverlay, MapPolyline } from '..';
import { FlightPath, LatLng } from '../../types';
import { describeManoeuvreForDisplay } from '../../core/manoeuvre';
import { destinationPoint } from '../../core/geometry';
import { metersToFeet } from '../../core/units';

import { PATH_COLORS } from './FlightPathsLayer';
import { mapLabel } from './labelStyles';

/** How far past the initiation point the final axis is drawn (ft). */
const AXIS_MARGIN_FT = 250;

/**
 * How far the final axis runs PAST the landing point, in the direction of
 * flight. Long enough to read as the line you are flying down rather than
 * as something that stops at your feet.
 */
const AXIS_FORWARD_FT = 325;

/** Length of the entry-direction arrow, in screen pixels. */
const ARROW_PX = 34;

const AXIS_COLOR = '#ffffff';

const LABEL_STYLE: React.CSSProperties = {
  ...mapLabel({
    color: PATH_COLORS.manoeuvre,
    bold: true,
    // Lifted clear of its anchor: the initiation point's own altitude label
    // hangs just below the same spot.
    transform: 'translate(-50%, -160%)'
  }),
  pointerEvents: 'none'
};

const feetToMeters = (feet: number) => feet / metersToFeet;

interface ManoeuvreHintLayerProps {
  /** Draw the final approach line through the landing point. */
  showFinalApproachLine: boolean;
  /** Draw the entry arrow and the rotation. */
  showTurnHint: boolean;
  /** The path as drawn (wind-corrected); the hint is anchored to it. */
  path: FlightPath;
  /**
   * The same path without wind. Every heading and the rotation are read
   * from here: bearings along a drifted path are ground tracks, not
   * headings (see `describeManoeuvreForDisplay`).
   */
  idealPath: FlightPath;
}

/**
 * An arrow pointing along a compass bearing, anchored at its tail so it
 * reads as "you are flying this way from here".
 */
function EntryArrow({ position, bearingDeg }: { position: LatLng; bearingDeg: number }) {
  return (
    <MapOverlay position={position}>
      <div
        style={{
          // Rotate about the tail, which sits on the anchor point.
          transform: `translate(-50%, -100%) rotate(${bearingDeg}deg)`,
          transformOrigin: '50% 100%',
          pointerEvents: 'none',
          lineHeight: 0
        }}
      >
        <svg width={12} height={ARROW_PX} viewBox="0 0 12 34">
          <path
            d="M6 0 L11 11 L7.5 11 L7.5 34 L4.5 34 L4.5 11 L1 11 Z"
            fill={PATH_COLORS.manoeuvre}
            stroke="rgba(0,0,0,0.6)"
            strokeWidth={0.75}
          />
        </svg>
      </div>
    </MapOverlay>
  );
}

const manoeuvreOf = (path: FlightPath) =>
  path.filter(point => point.properties.phase === 'manoeuvre');

export default function ManoeuvreHintLayer({
  path,
  idealPath,
  showFinalApproachLine,
  showTurnHint
}: ManoeuvreHintLayerProps) {
  const described = describeManoeuvreForDisplay(manoeuvreOf(path), manoeuvreOf(idealPath));

  if (!described) {
    return null;
  }

  const {
    initiation, landing, entryHeadingDeg, finalHeadingDeg, rotationDeg, spanFt, spanBearingDeg
  } = described;

  // The axis runs through the landing point along the final heading, drawn
  // far enough back to pass the initiation point.
  const axis: LatLng[] = [
    destinationPoint(landing, finalHeadingDeg + 180, feetToMeters(spanFt + AXIS_MARGIN_FT)),
    destinationPoint(landing, finalHeadingDeg, feetToMeters(AXIS_FORWARD_FT))
  ];

  // Whole degrees: the measured rotation of a recorded track is never round,
  // and a decimal would imply a precision that is not there.
  const rounded = Math.round(Math.abs(rotationDeg));
  // Sub-degree wobble on a nearly straight track has no meaningful side.
  const side = rounded === 0 ? '' : ` ${rotationDeg > 0 ? 'R' : 'L'}`;
  // Straight out past the initiation point, directly away from the landing
  // point. The turn is only a few hundred feet across, so anything closer
  // in collides with the target's own altitude label.
  const labelAt = destinationPoint(
    initiation,
    spanBearingDeg,
    feetToMeters(Math.max(160, spanFt * 0.45))
  );

  return (
    <>
      {showFinalApproachLine && (
        <MapPolyline path={axis} color={AXIS_COLOR} opacity={0.5} weight={1} zIndex={1} dotted />
      )}
      {showTurnHint && (
        <>
          <EntryArrow position={initiation} bearingDeg={entryHeadingDeg} />
          <MapOverlay position={labelAt}>
            <div style={LABEL_STYLE}>{rounded}°{side}</div>
          </MapOverlay>
        </>
      )}
    </>
  );
}
