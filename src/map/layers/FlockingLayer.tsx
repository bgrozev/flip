/**
 * Flocking layer: wind-corrected descent line (with the no-wind ghost),
 * POM altitude markers with hover tooltips, the jumprun line ending at the
 * exit spot with distance markers, and the FWC-style spot label.
 */
import React, { useMemo, useState } from 'react';

import { pathToLatLngs } from '../../core/coords';
import {
  DISTANCE_UNIT_LABELS,
  DistanceUnit,
  JumprunLine,
  SpotDescription,
  milesToDisplay,
  pointAlongJumprun,
  projectOntoJumprunMi
} from '../../core/flocking';
import { destinationPoint } from '../../core/geometry';
import { WindProfile, getWindAt, prepWind } from '../../core/wind';
import { useUnits } from '../../hooks';
import { FlightPath, LatLng } from '../../types';
import { MapCircle, MapOverlay, MapPolyline } from '..';

import { DirectionArrow, TOOLTIP_STYLE } from './tooltip';

// Flocking path color — distinct from pattern green and manoeuvre red
// Magenta: pops on satellite imagery where the previous cyan washed out,
// and collides with nothing else on the map (pattern green, manoeuvre red,
// pre-wind white, reference amber).
export const FLOCKING_COLOR = '#ff40ff';
const GHOST_COLOR = '#ffffff';
// Green jumprun (owner's pick — it read well as the reachable overlay)
const JUMPRUN_COLOR = '#00e676';
const MISS_COLOR = '#ff5252';

const JUMPRUN_LENGTH_M = 3 * 1852; // 3 nm
const METERS_PER_MILE = 1609.344;
const MILES_PER_UNIT: Record<DistanceUnit, number> = {
  mi: 1,
  nm: 1.15078,
  km: 1 / 1.60934
};

/** Round a direction for display without showing 360 (359.7 -> 0). */
function roundDeg(deg: number): number {
  return Math.round(deg) % 360;
}

const ALTITUDE_LABEL_STYLE: React.CSSProperties = {
  background: 'black',
  border: '1px solid black',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '14px',
  color: 'white',
  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  display: 'inline-block',
  whiteSpace: 'nowrap'
};

/** Small distance-marker label on the jumprun line. */
const MARKER_LABEL_STYLE: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.75)',
  padding: '1px 5px',
  borderRadius: '3px',
  fontSize: '11px',
  color: '#e0e0e0',
  display: 'inline-block',
  whiteSpace: 'nowrap',
  transform: 'translate(-50%, 8px)'
};

// Pinned reference point C
const REFERENCE_COLOR = '#ffc107';

const REFERENCE_LABEL_STYLE: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.75)',
  padding: '1px 5px',
  borderRadius: '3px',
  fontSize: '11px',
  color: REFERENCE_COLOR,
  fontWeight: 'bold',
  display: 'inline-block',
  whiteSpace: 'nowrap',
  transform: 'translate(-50%, 12px)'
};

/** The spot one-liner near the exit. */
const SPOT_LABEL_STYLE: React.CSSProperties = {
  background: 'rgba(10, 10, 10, 0.85)',
  border: `1px solid ${FLOCKING_COLOR}`,
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '13px',
  color: 'white',
  display: 'inline-block',
  whiteSpace: 'nowrap',
  transform: 'translate(-50%, 16px)'
};

export interface FlockingLayerProps {
  /** No-wind descent path (ghost). */
  ideal: FlightPath;
  /** Wind-corrected descent path; last point = exit. */
  corrected: FlightPath;
  exit: LatLng | null;
  jumprunDeg: number;
  spot: SpotDescription | null;
  distanceUnit: DistanceUnit;
  /** Wind profile for the per-POM tooltip wind line. */
  winds: WindProfile;
  /** Pinned reference point C, if any (null = spot is relative to target). */
  reference: LatLng | null;
  /** End-of-jump target B (center of the target area). */
  target: LatLng;
  /** Radius of the target area around B, miles. */
  targetRadiusMi: number;
  /** The jumprun line. */
  jumprunLine: JumprunLine | null;
  /** Where the flight ends. */
  end: LatLng | null;
  /** Distance from the end to the target, miles. */
  missMi: number | null;
  /** Whether the end lands inside the target area. */
  onTarget: boolean;
  /** Render the jumprun-aligned distance grid around the Spot Reference. */
  showGrid: boolean;
  showPreWind: boolean;
  showPoms: boolean;
  showPomAltitudes: boolean;
}

export default function FlockingLayer({
  ideal,
  corrected,
  exit,
  jumprunDeg,
  spot,
  distanceUnit,
  winds,
  reference,
  target,
  targetRadiusMi,
  jumprunLine,
  end,
  missMi,
  onTarget,
  showGrid,
  showPreWind,
  showPoms,
  showPomAltitudes
}: FlockingLayerProps) {
  const { formatAltitude, altitudeLabel, formatWindSpeed, windSpeedLabel } = useUnits();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const idealLatLngs = useMemo(() => pathToLatLngs(ideal), [ideal]);
  const correctedLatLngs = useMemo(() => pathToLatLngs(corrected), [corrected]);
  const preppedWinds = useMemo(() => prepWind(winds), [winds]);

  // Time of exit (the most negative time on the path) for "time since exit"
  const exitTime = correctedLatLngs.length > 0
    ? correctedLatLngs[correctedLatLngs.length - 1].time ?? 0
    : 0;

  // Jumprun line: fixed 3 nm, ENDING at the exit (the plane flies toward it)
  const jumprun = useMemo(() => {
    if (!exit) {
      return null;
    }

    const start = destinationPoint(exit, (jumprunDeg + 180) % 360, JUMPRUN_LENGTH_M);
    // Arrowhead at the exit end: two 250 m barbs
    const barbA = destinationPoint(exit, (jumprunDeg + 150) % 360, 250);
    const barbB = destinationPoint(exit, (jumprunDeg + 210) % 360, 250);

    return { start, barbA, barbB };
  }, [exit, jumprunDeg]);

  // The full jumprun line, drawn 3 nm beyond the exit and the target's
  // projection on both sides.
  const runLine = useMemo(() => {
    if (!jumprunLine) {
      return null;
    }

    const tTarget = projectOntoJumprunMi(jumprunLine, target);
    const tExit = exit ? projectOntoJumprunMi(jumprunLine, exit) : tTarget;
    const extraMi = JUMPRUN_LENGTH_M / METERS_PER_MILE; // 3 nm of context

    return {
      a: pointAlongJumprun(jumprunLine, Math.min(tTarget, tExit) - extraMi),
      b: pointAlongJumprun(jumprunLine, Math.max(tTarget, tExit) + extraMi)
    };
  }, [jumprunLine, target, exit]);

  // Jumprun-aligned distance grid around the Spot Reference (or the target
  // when no reference is pinned): thin lines every distance unit, ±3 units
  // along the run × ±2 across, with signed along-distances labeled.
  const grid = useMemo(() => {
    if (!showGrid) {
      return null;
    }

    const center = reference ?? target;
    const unitM = MILES_PER_UNIT[distanceUnit] * METERS_PER_MILE;
    const dir = jumprunDeg;
    const across = (jumprunDeg + 90) % 360;
    const at = (alongUnits: number, acrossUnits: number): LatLng =>
      destinationPoint(
        destinationPoint(center, dir, alongUnits * unitM),
        across,
        acrossUnits * unitM
      );

    const lines: { path: LatLng[]; key: string }[] = [];
    const labels: { position: LatLng; text: string; key: string }[] = [];

    for (let k = -2; k <= 2; k++) {
      lines.push({ key: `par-${k}`, path: [at(-3, k), at(3, k)] });
    }
    for (let j = -3; j <= 3; j++) {
      lines.push({ key: `perp-${j}`, path: [at(j, -2), at(j, 2)] });
      if (j !== 0) {
        labels.push({ key: `lbl-${j}`, position: at(j, 2), text: `${j > 0 ? '+' : ''}${j}` });
      }
    }

    return { lines, labels };
  }, [showGrid, reference, target, jumprunDeg, distanceUnit]);

  // Distance markers on the jumprun line, at round "prior" distances
  // relative to the reference projected onto the jumprun (so a marker
  // labeled 2 sits where the spot text would read "2.00 mi prior").
  const distanceMarkers = useMemo(() => {
    if (!exit || !spot) {
      return [];
    }

    const unitMi = MILES_PER_UNIT[distanceUnit];
    const alongSignedMi = spot.prior ? spot.alongMi : -spot.alongMi;
    const jumprunLengthMi = JUMPRUN_LENGTH_M / METERS_PER_MILE;

    // Marker for prior-distance d sits at offset (alongSigned - d*unit)
    // from the exit along the jumprun; keep it on the [-3 nm, 0] segment.
    const dMin = Math.ceil(alongSignedMi / unitMi - 1e-9);
    const dMax = Math.floor((alongSignedMi + jumprunLengthMi) / unitMi + 1e-9);
    const markers: { d: number; position: LatLng }[] = [];

    for (let d = dMin; d <= dMax; d++) {
      const offsetMi = alongSignedMi - d * unitMi;
      const position = destinationPoint(
        exit,
        (jumprunDeg + 180) % 360,
        -offsetMi * METERS_PER_MILE
      );

      markers.push({ d, position });
    }

    return markers;
  }, [exit, spot, jumprunDeg, distanceUnit]);

  const unitLabel = DISTANCE_UNIT_LABELS[distanceUnit];
  const missed = !onTarget;
  let spotText = spot
    ? `Jumprun ${roundDeg(spot.jumprunDeg)}˚ · ${
      milesToDisplay(spot.alongMi, distanceUnit).toFixed(2)} ${unitLabel} ${
      spot.prior ? 'prior' : 'PAST'}`
    : null;

  if (spotText && missed && missMi !== null) {
    spotText += ` · MISSES by ${
      milesToDisplay(missMi, distanceUnit).toFixed(2)} ${unitLabel}`;
  }

  const lineProps = { color: JUMPRUN_COLOR, opacity: 0.9, weight: 3, zIndex: 0 };

  return (
    <>
      {/* The jumprun line (green), with an arrowhead at the exit marking
          the run direction. */}
      {runLine && (
        <MapPolyline
          path={[runLine.a, runLine.b]}
          color={JUMPRUN_COLOR}
          opacity={0.8}
          weight={3}
          zIndex={0}
        />
      )}
      {jumprun && exit && (
        <>
          <MapPolyline path={[jumprun.barbA, exit]} {...lineProps} />
          <MapPolyline path={[jumprun.barbB, exit]} {...lineProps} />
        </>
      )}

      {/* Target area: the jump works when it ends anywhere inside */}
      {targetRadiusMi > 0 && (
        <MapCircle
          center={target}
          radius={targetRadiusMi * METERS_PER_MILE}
          fillColor="#ffffff"
          fillOpacity={0.08}
          strokeColor={missed ? MISS_COLOR : '#ffffff'}
          strokeOpacity={missed ? 0.9 : 0.5}
          strokeWeight={missed ? 2 : 1}
          zIndex={0}
          clickable={false}
        />
      )}

      {/* The end of the flight; when it misses the target area, a red
          connector shows the gap. */}
      {end && missed && (
        <>
          <MapPolyline
            path={[end, target]}
            color={MISS_COLOR}
            opacity={0.9}
            weight={2}
            zIndex={2}
            dotted
          />
          <MapCircle
            center={end}
            radius={4}
            fillColor={MISS_COLOR}
            fillOpacity={1}
            strokeColor="#ffffff"
            strokeOpacity={1}
            strokeWeight={1.5}
            zIndex={4}
            clickable={false}
          />
          {missMi !== null && (
            <MapOverlay position={end}>
              <div style={{ ...MARKER_LABEL_STYLE, color: MISS_COLOR }}>
                {milesToDisplay(missMi, distanceUnit).toFixed(2)} {unitLabel} off
              </div>
            </MapOverlay>
          )}
        </>
      )}

      {/* Distance grid */}
      {grid && grid.lines.map(line => (
        <MapPolyline
          key={line.key}
          path={line.path}
          color="#ffffff"
          opacity={0.18}
          weight={1}
          zIndex={0}
        />
      ))}
      {grid && grid.labels.map(label => (
        <MapOverlay key={label.key} position={label.position}>
          <div style={MARKER_LABEL_STYLE}>{label.text}</div>
        </MapOverlay>
      ))}

      {/* Distance markers on the jumprun */}
      {distanceMarkers.map(({ d, position }) => (
        <React.Fragment key={`marker-${d}`}>
          <MapCircle
            center={position}
            radius={2}
            fillColor={JUMPRUN_COLOR}
            fillOpacity={1}
            strokeColor="#000000"
            strokeOpacity={1}
            strokeWeight={1}
            zIndex={2}
            clickable={false}
          />
          <MapOverlay position={position}>
            <div style={MARKER_LABEL_STYLE}>{d}</div>
          </MapOverlay>
        </React.Fragment>
      ))}

      {/* No-wind ghost line */}
      {showPreWind && (
        <MapPolyline
          path={idealLatLngs}
          color={GHOST_COLOR}
          opacity={0.6}
          weight={2}
          zIndex={1}
          dotted
        />
      )}

      {/* Wind-corrected descent line */}
      <MapPolyline
        path={correctedLatLngs}
        color={FLOCKING_COLOR}
        opacity={0.9}
        weight={2}
        zIndex={1}
      />

      {/* POM markers with altitude labels and hover tooltips */}
      {correctedLatLngs.map((point, i) => {
        if (!point.pom) {
          return null;
        }

        const isExit = i === correctedLatLngs.length - 1;

        return (
          <React.Fragment key={i}>
            {showPoms && (
              <MapCircle
                center={point}
                radius={isExit ? 5 : 3}
                fillColor={FLOCKING_COLOR}
                fillOpacity={1}
                strokeColor={isExit ? '#ffffff' : '#000000'}
                strokeOpacity={1}
                strokeWeight={isExit ? 2 : 1}
                zIndex={3}
                clickable={false}
              />
            )}
            {/* Hover area */}
            <MapCircle
              center={point}
              radius={30}
              fillOpacity={0}
              strokeOpacity={0}
              clickable
              zIndex={100}
              onMouseOver={() => setHoveredIndex(i)}
              onMouseOut={() => setHoveredIndex(null)}
            />
            {hoveredIndex === i && (() => {
              const alt = formatAltitude(point.alt ?? 0);
              const sinceExitS = ((point.time ?? 0) - exitTime) / 1000;
              const wind = getWindAt(preppedWinds, point.alt ?? 0, true);
              const windSpeed = formatWindSpeed(wind.speedKts);

              return (
                <MapOverlay position={point}>
                  <div style={TOOLTIP_STYLE}>
                    <div><strong>{isExit ? 'Exit' : 'Descent'}</strong></div>
                    <div>Altitude: {Math.round(alt.value)} {altitudeLabel}</div>
                    <div>Time since exit: {sinceExitS.toFixed(0)} s</div>
                    <div>
                      Wind: {roundDeg(wind.direction)}˚ {windSpeed.value.toFixed(0)} {windSpeedLabel}
                      <DirectionArrow degrees={wind.direction} />
                    </div>
                  </div>
                </MapOverlay>
              );
            })()}
            {showPomAltitudes && (
              <MapOverlay position={point}>
                <div style={ALTITUDE_LABEL_STYLE}>
                  {`${Math.round(formatAltitude(point.alt ?? 0).value)} ${altitudeLabel}`}
                </div>
              </MapOverlay>
            )}
          </React.Fragment>
        );
      })}

      {/* Pinned reference point C: an anchor-ish ring + dot + label */}
      {reference && (
        <>
          <MapCircle
            center={reference}
            radius={12}
            fillOpacity={0}
            strokeColor={REFERENCE_COLOR}
            strokeOpacity={1}
            strokeWeight={2}
            zIndex={4}
            clickable={false}
          />
          <MapCircle
            center={reference}
            radius={2}
            fillColor={REFERENCE_COLOR}
            fillOpacity={1}
            strokeOpacity={0}
            zIndex={4}
            clickable={false}
          />
          <MapOverlay position={reference}>
            <div style={REFERENCE_LABEL_STYLE}>Spot Reference</div>
          </MapOverlay>
        </>
      )}

      {/* Spot label near the exit */}
      {exit && spotText && (
        <MapOverlay position={exit}>
          <div
            style={{
              ...SPOT_LABEL_STYLE,
              ...missed ? { border: `1px solid ${MISS_COLOR}`, color: '#ff8a80' } : {}
            }}
          >
            {spotText}
          </div>
        </MapOverlay>
      )}
    </>
  );
}
