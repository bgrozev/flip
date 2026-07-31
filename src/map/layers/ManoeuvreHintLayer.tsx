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
import { describeManoeuvrePath } from '../../core/manoeuvre';
import { destinationPoint } from '../../core/geometry';
import { metersToFeet } from '../../core/units';

import { PATH_COLORS } from './FlightPathsLayer';

/** How far past the initiation point the final axis is drawn (ft). */
const AXIS_MARGIN_FT = 250;

/** Length of the entry-direction arrow, in screen pixels. */
const ARROW_PX = 34;

const AXIS_COLOR = '#ffffff';

const LABEL_STYLE: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.72)',
  padding: '1px 6px',
  borderRadius: '3px',
  fontSize: '12px',
  fontWeight: 'bold',
  color: PATH_COLORS.manoeuvre,
  display: 'inline-block',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  // Lifted clear of its anchor: the initiation point's own altitude label
  // hangs just below the same spot.
  transform: 'translate(-50%, -160%)'
};

const feetToMeters = (feet: number) => feet / metersToFeet;

interface ManoeuvreHintLayerProps {
  /** The path as drawn (wind-corrected); the hint is anchored to it. */
  path: FlightPath;
  /**
   * The same path without wind. The rotation is read from here: wind bends
   * the ground track, so a turn entered as 270 measures 271 on the map, and
   * a number the pilot typed must read back as the number they typed.
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

export default function ManoeuvreHintLayer({ path, idealPath }: ManoeuvreHintLayerProps) {
  const described = describeManoeuvrePath(manoeuvreOf(path));
  const ideal = describeManoeuvrePath(manoeuvreOf(idealPath));

  if (!described) {
    return null;
  }

  const { initiation, landing, entryHeadingDeg, finalHeadingDeg, spanFt, spanBearingDeg } = described;
  const rotationDeg = ideal ? ideal.rotationDeg : described.rotationDeg;

  // The axis runs through the landing point along the final heading, drawn
  // far enough back to pass the initiation point.
  const axis: LatLng[] = [
    destinationPoint(landing, finalHeadingDeg + 180, feetToMeters(spanFt + AXIS_MARGIN_FT)),
    destinationPoint(landing, finalHeadingDeg, feetToMeters(AXIS_MARGIN_FT / 2))
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
      <MapPolyline path={axis} color={AXIS_COLOR} opacity={0.5} weight={1} zIndex={1} dotted />
      <EntryArrow position={initiation} bearingDeg={entryHeadingDeg} />
      <MapOverlay position={labelAt}>
        <div style={LABEL_STYLE}>{rounded}°{side}</div>
      </MapOverlay>
    </>
  );
}
