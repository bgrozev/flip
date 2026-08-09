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
  localMilesEN,
  milesToDisplay,
  pointAlongJumprun,
  projectOntoJumprunMi,
  vectorCardinalDirection
} from '../../core/flocking';
import { destinationPoint } from '../../core/geometry';
import { formatSpot } from '../../core/spotText';
import { WindProfile, getWindAt, prepWind } from '../../core/wind';
import { useUnits } from '../../hooks';
import { FlightPath, LatLng } from '../../types';
import { MapCircle, MapDragHandle, MapOverlay, MapPolyline, useMapZoom } from '..';

import { SolveTier } from '../../core/flockingSolve';

import { LABEL_FONT_SIZE, mapLabel } from './labelStyles';
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
const YELLOW_COLOR = '#ffc107';
/** Ring/label colour per miss tier. */
const TIER_COLOR: Record<SolveTier, string> = {
  green: JUMPRUN_COLOR,
  yellow: YELLOW_COLOR,
  red: MISS_COLOR
};
// Grid mesh — light blue, visible over satellite and plain backgrounds
const GRID_COLOR = '#40c4ff';

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

/**
 * How densely to show the per-POM altitude labels at a given zoom, as a
 * step in thousands of feet: 1 = one label every 1000 ft (max density),
 * 2 = every 2000 ft, etc.; null = none. The labels overlap when the whole
 * flocking picture is small, so they thin out as you zoom out.
 */
function altitudeLabelStepThousands(zoom: number): number | null {
  if (zoom >= 14) return 1;
  if (zoom >= 13) return 2;
  if (zoom >= 12) return 4;
  return null;
}

const ALTITUDE_LABEL_STYLE = mapLabel();

/** Small distance-marker label on the jumprun line. */
const MARKER_LABEL_STYLE = mapLabel({
  size: 'sm',
  color: '#e0e0e0',
  transform: 'translate(-50%, 8px)'
});

// Pinned reference point C
const REFERENCE_COLOR = '#ffc107';

const REFERENCE_LABEL_STYLE = mapLabel({
  size: 'sm',
  color: REFERENCE_COLOR,
  bold: true,
  transform: 'translate(-50%, 12px)'
});

/** Corridor name, centered on its exit rectangle. */
const CORRIDOR_LABEL_STYLE = mapLabel({
  size: 'sm',
  color: JUMPRUN_COLOR,
  bold: true,
  transform: 'translate(-50%, -50%)'
});

/**
 * The spot one-liner near the exit — the map's copy of flocking's output,
 * so it is set larger than the other labels and reads as the answer rather
 * than as an annotation.
 *
 * Deliberately NOT clickable, unlike the panel and the top bar. Map
 * overlays live in Google's `overlayLayer` pane, which receives no mouse
 * events; the only interactive panes sit ABOVE every marker, so a
 * clickable label would shadow whatever drag handle happened to be under
 * it — and in free mode the exit handle is a few pixels away by
 * construction. Reading beats copying here: copy is one glance up, in the
 * top bar.
 */
const SPOT_LABEL_STYLE = mapLabel({
  size: 'lg',
  bold: true,
  border: FLOCKING_COLOR,
  pill: true,
  transform: 'translate(-50%, 16px)'
});

/** The verdict and the canopy deviation, under the spot itself. */
const SPOT_LABEL_NOTE_STYLE: React.CSSProperties = {
  fontSize: LABEL_FONT_SIZE.md,
  fontWeight: 'normal'
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
  /** Effective Spot Reference position (pinned point, or the target). */
  reference: LatLng | null;
  /** Drag the Spot Reference on the map (pins it at the dropped point). */
  onReferenceDrag?: (pos: LatLng) => void;
  /** End-of-jump target B (center of the target area). */
  target: LatLng;
  /** Radius of the target area around B (green ring), miles. */
  targetRadiusMi: number;
  /** Yellow-ring radius around B, miles. */
  yellowRadiusMi?: number;
  /** The jumprun line (free mode; null = classic, run ends at the exit). */
  jumprunLine: JumprunLine | null;
  /** Where the flight ends. */
  end: LatLng | null;
  /** Distance from the end to the target, miles (null in classic). */
  missMi: number | null;
  /** Whether the end lands inside the target area. */
  onTarget: boolean;
  /** Which ring the miss falls in; null in classic (no miss). */
  tier?: SolveTier | null;
  /** Angle between the canopy flight and the jumprun, degrees. */
  canopyDeviationDeg?: number;
  /** Whether that deviation exceeds the warn limit (colours it red). */
  canopyDeviationWarning?: boolean;
  /** Free mode: move the whole jumprun so its exit lands at a dragged point. */
  onJumprunMove?: (exit: LatLng) => void;
  /** Free mode: rotate the jumprun about the exit (new direction, cardinal). */
  onJumprunRotate?: (directionDeg: number) => void;
  /**
   * Rotate the canopy flight about its FINISH (middle-of-CF handle): the
   * finish stays put and the exit swings. Classic and free.
   */
  onCanopyRotate?: (directionDeg: number) => void;
  /**
   * Free mode: rotate the canopy flight about the EXIT (end-of-CF handle):
   * the exit and jumprun stay put and the finish swings.
   */
  onCanopyRotateAboutExit?: (directionDeg: number) => void;
  /** Classic mode: drag the exit to translate the whole picture (the target). */
  onExitTranslate?: (exit: LatLng) => void;
  /** Solve mode: corridor exit-rectangle outlines (closed loops). */
  corridorOutlines?: LatLng[][];
  /** Solve mode: corridor name labels, placed at each rectangle's centroid. */
  corridorLabels?: { position: LatLng; text: string }[];
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
  onReferenceDrag,
  target,
  targetRadiusMi,
  yellowRadiusMi,
  jumprunLine,
  end,
  missMi,
  onTarget,
  tier = null,
  canopyDeviationDeg = 0,
  canopyDeviationWarning = false,
  onJumprunMove,
  onJumprunRotate,
  onCanopyRotate,
  onCanopyRotateAboutExit,
  onExitTranslate,
  corridorOutlines = [],
  corridorLabels = [],
  showGrid,
  showPreWind,
  showPoms,
  showPomAltitudes
}: FlockingLayerProps) {
  const { formatAltitude, altitudeLabel, formatWindSpeed, windSpeedLabel } = useUnits();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const zoom = useMapZoom();
  // The per-POM altitude labels crowd together as the picture shrinks, so
  // thin them out by zoom: at most one label per this many thousands of
  // feet (null = none at all). Applied per-POM in the render below.
  const altitudeLabelStep = showPomAltitudes ? altitudeLabelStepThousands(zoom) : null;

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

  // The free-mode jumprun: like the classic one, a 3 nm ride ENDING at
  // the exit (kept short so the handles stay manageable).
  const runLine = useMemo(() => {
    if (!jumprunLine || !exit) {
      return null;
    }

    const tExit = projectOntoJumprunMi(jumprunLine, exit);
    const lengthMi = JUMPRUN_LENGTH_M / METERS_PER_MILE;

    return {
      a: pointAlongJumprun(jumprunLine, tExit - lengthMi),
      b: exit,
      tExit
    };
  }, [jumprunLine, exit]);

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
  const missColor = TIER_COLOR[tier ?? 'red'];
  // One formatter for every surface: what the label says here is exactly
  // what the panel says, what the top bar says and what gets copied.
  const spotText = spot ? formatSpot(spot, distanceUnit, { missMi, tier }) : null;

  const lineProps = { color: JUMPRUN_COLOR, opacity: 0.9, weight: 3, zIndex: 0 };

  return (
    <>
      {/* The jumprun line (green), with an arrowhead at the exit marking
          the run direction. Classic: the fixed 3 nm ride to the exit;
          free: the full line. */}
      {!jumprunLine && jumprun && exit && (
        <MapPolyline path={[jumprun.start, exit]} {...lineProps} />
      )}
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

      {/* Handles.
          Free: exit (green) translates the run (target fixed); a white
          handle at the jumprun START rotates the run about the exit; a cyan
          handle at the END of CF rotates the canopy about the exit (jumprun
          fixed); a magenta handle at the MIDDLE of CF rotates the canopy
          about the finish (finish fixed, exit swings).
          Classic: the exit (green) translates everything (moves the target);
          the magenta middle-of-CF handle rotates about the target.
          The target has its own always-on drag handle. */}
      {exit && (onJumprunMove || onExitTranslate) && (() => {
        const translate = onJumprunMove ?? onExitTranslate;
        if (!translate) {
          return null;
        }
        return (
          <MapDragHandle
            position={exit}
            color={onTarget ? JUMPRUN_COLOR : MISS_COLOR}
            scale={8}
            cursor="grab"
            zIndex={110}
            onDrag={translate}
            onDragEnd={translate}
          />
        );
      })()}
      {jumprunLine && exit && onJumprunRotate && (() => {
        // Handle at the start of the run; the run points from it toward the
        // fixed exit, so it swings about the exit with no 180° flip.
        const handlePos = destinationPoint(
          exit, (jumprunLine.directionDeg + 180) % 360, JUMPRUN_LENGTH_M
        );
        const rotate = (pos: LatLng) => {
          const en = localMilesEN(pos, exit);

          if (Math.hypot(en.eastMi, en.northMi) > 1e-4) {
            onJumprunRotate(vectorCardinalDirection(en.eastMi, en.northMi));
          }
        };

        return (
          <MapDragHandle
            position={handlePos}
            color="#ffffff"
            scale={6}
            cursor="alias"
            zIndex={105}
            pinned
            onDrag={rotate}
            onDragEnd={rotate}
          />
        );
      })()}
      {exit && end && onCanopyRotateAboutExit && (() => {
        // End-of-CF handle: rotate the canopy about the EXIT. The direction
        // is from the fixed exit toward the dragged handle; the finish swings.
        const rotate = (pos: LatLng) => {
          const en = localMilesEN(exit, pos);

          if (Math.hypot(en.eastMi, en.northMi) > 0.02) {
            onCanopyRotateAboutExit(vectorCardinalDirection(en.eastMi, en.northMi));
          }
        };

        return (
          <MapDragHandle
            position={end}
            color="#00d0ff"
            scale={6}
            cursor="alias"
            zIndex={106}
            pinned
            onDrag={rotate}
            onDragEnd={rotate}
          />
        );
      })()}
      {exit && end && onCanopyRotate && correctedLatLngs.length >= 3 && (() => {
        // Middle-of-CF handle: rotate the canopy about the FINISH. Anchored
        // to the actual (wind-curved) flight path's midpoint rather than the
        // straight exit-end midpoint, so it stays on the purple line even
        // when the wind bends it. Dragging sets the direction from the handle
        // toward the fixed finish, so the finish stays put.
        const mid = correctedLatLngs[Math.floor(correctedLatLngs.length / 2)];
        const handlePos: LatLng = { lat: mid.lat, lng: mid.lng };
        const rotate = (pos: LatLng) => {
          const en = localMilesEN(pos, end);

          if (Math.hypot(en.eastMi, en.northMi) > 0.02) {
            onCanopyRotate(vectorCardinalDirection(en.eastMi, en.northMi));
          }
        };

        return (
          <MapDragHandle
            position={handlePos}
            color={FLOCKING_COLOR}
            scale={6}
            cursor="alias"
            zIndex={105}
            pinned
            onDrag={rotate}
            onDragEnd={rotate}
          />
        );
      })()}

      {/* Yellow ring: beyond the green one, but still workable */}
      {yellowRadiusMi !== undefined && yellowRadiusMi > targetRadiusMi && (
        <MapCircle
          center={target}
          radius={yellowRadiusMi * METERS_PER_MILE}
          fillColor={YELLOW_COLOR}
          fillOpacity={0.05}
          strokeColor={YELLOW_COLOR}
          strokeOpacity={tier === 'yellow' ? 0.9 : 0.45}
          strokeWeight={tier === 'yellow' ? 2 : 1}
          zIndex={0}
          clickable={false}
        />
      )}

      {/* Green ring: the jump works when it ends anywhere inside */}
      {targetRadiusMi > 0 && (
        <MapCircle
          center={target}
          radius={targetRadiusMi * METERS_PER_MILE}
          fillColor={JUMPRUN_COLOR}
          fillOpacity={0.07}
          strokeColor={JUMPRUN_COLOR}
          strokeOpacity={tier === 'green' ? 0.9 : 0.5}
          strokeWeight={tier === 'green' ? 2 : 1}
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
            color={missColor}
            opacity={0.9}
            weight={2}
            zIndex={2}
            dotted
          />
          <MapCircle
            center={end}
            radius={4}
            fillColor={missColor}
            fillOpacity={1}
            strokeColor="#ffffff"
            strokeOpacity={1}
            strokeWeight={1.5}
            zIndex={4}
            clickable={false}
          />
          {missMi !== null && (
            <MapOverlay position={end}>
              <div style={{ ...MARKER_LABEL_STYLE, color: missColor }}>
                {milesToDisplay(missMi, distanceUnit).toFixed(2)} {unitLabel} off
              </div>
            </MapOverlay>
          )}
        </>
      )}

      {/* Solve mode: allowed-exit rectangles per corridor */}
      {corridorOutlines.map((loop, i) => (
        <MapPolyline
          key={`corridor-${i}`}
          path={loop}
          color={JUMPRUN_COLOR}
          opacity={0.35}
          weight={1}
          zIndex={0}
          dotted
        />
      ))}

      {/* Solve mode: corridor name labels */}
      {corridorLabels.map((label, i) => (
        <MapOverlay key={`corridor-label-${i}`} position={label.position}>
          <div style={CORRIDOR_LABEL_STYLE}>{label.text}</div>
        </MapOverlay>
      ))}

      {/* Distance grid: a light-blue mesh that reads over both satellite
          imagery and the plain map background. */}
      {grid && grid.lines.map(line => (
        <MapPolyline
          key={line.key}
          path={line.path}
          color={GRID_COLOR}
          opacity={line.key.startsWith('perp-0') || line.key === 'par-0' ? 0.85 : 0.5}
          weight={line.key.startsWith('perp-0') || line.key === 'par-0' ? 2 : 1.5}
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
            {altitudeLabelStep !== null &&
              Math.round((point.alt ?? 0) / 1000) % altitudeLabelStep === 0 && (
              <MapOverlay position={point}>
                <div style={ALTITUDE_LABEL_STYLE}>
                  {`${Math.round(formatAltitude(point.alt ?? 0).value)} ${altitudeLabel}`}
                </div>
              </MapOverlay>
            )}
          </React.Fragment>
        );
      })}

      {/* Spot Reference: an amber ring + label, draggable on the map
          (dragging pins it at the dropped point). */}
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
          <MapOverlay position={reference}>
            <div style={REFERENCE_LABEL_STYLE}>Spot Reference</div>
          </MapOverlay>
          {onReferenceDrag ? (
            <MapDragHandle
              position={reference}
              color={REFERENCE_COLOR}
              scale={5}
              cursor="grab"
              zIndex={106}
              onDrag={onReferenceDrag}
              onDragEnd={onReferenceDrag}
            />
          ) : (
            <MapCircle
              center={reference}
              radius={2}
              fillColor={REFERENCE_COLOR}
              fillOpacity={1}
              strokeOpacity={0}
              zIndex={4}
              clickable={false}
            />
          )}
        </>
      )}

      {/* Spot label near the exit, with the canopy-vs-jumprun deviation
          when the two differ (green within the limit, red beyond it). */}
      {exit && spotText && (
        <MapOverlay position={exit}>
          <div
            style={{
              ...SPOT_LABEL_STYLE,
              ...missed ? { border: `1px solid ${missColor}`, color: missColor } : {}
            }}
          >
            <div>{spotText.line}</div>
            {missed && spotText.verdict && (
              <div style={{ ...SPOT_LABEL_NOTE_STYLE, color: missColor }}>
                {spotText.verdict}
              </div>
            )}
            {canopyDeviationDeg >= 0.5 && (
              <div
                style={{
                  ...SPOT_LABEL_NOTE_STYLE,
                  color: canopyDeviationWarning ? MISS_COLOR : JUMPRUN_COLOR
                }}
              >
                Canopy {Math.round(canopyDeviationDeg)}˚ off jumprun
              </div>
            )}
          </div>
        </MapOverlay>
      )}
    </>
  );
}
