/**
 * Flight paths layer: pre-wind (dashed) and wind-corrected (solid) paths,
 * POM markers, altitude labels, hover tooltips with leg/manoeuvre stats,
 * cross-path point highlighting and drift-angle arrows.
 */
import React, { useMemo, useState } from 'react';

import { pathToLatLngs } from '../../core/coords';
import { destinationPoint } from '../../core/geometry';
import { formatDegrees } from '../../core/units';
import { useUnits } from '../../hooks';
import { FlightPath, LatLng } from '../../types';
import {
  calculatePathStats,
  driftAngle,
  getPointSegmentStats,
  LegStats,
  ManoeuvreStats,
  PathStats,
  PointData
} from '../../core/pathStats';
import { MapCircle, MapCircleStyle, MapOverlay, MapPolyline } from '..';

import { DirectionArrow, formatDistance, SECTION_STYLE, TOOLTIP_SECONDARY_STYLE, TOOLTIP_STYLE } from './tooltip';

// Colors for flight path visualization
export const PATH_COLORS = {
  /** Manoeuvre path color (red) */
  manoeuvre: '#ff4444',
  /** Pattern path color (green) */
  pattern: '#00e676',
  /** Pre-wind (ghost) path color — white for visibility on satellite */
  preWind: '#ffffff',
  /** Marker stroke color */
  markerStroke: '#000000'
} as const;

// Text overlay style for altitude labels
const ALTITUDE_LABEL_STYLE: React.CSSProperties = {
  background: 'black',
  border: '1px solid black',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '14px',
  color: 'white',
  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  display: 'inline-block',
  whiteSpace: 'nowrap',
  wordBreak: 'break-word'
};

interface CustomTextOverlayProps {
  position: LatLng;
  text: string;
}

const CustomTextOverlay = ({ position, text }: CustomTextOverlayProps) => (
  <MapOverlay position={position}>
    <div style={ALTITUDE_LABEL_STYLE}>
      {text}
    </div>
  </MapOverlay>
);

interface PointTooltipProps {
  point: PointData;
  pointIndex: number;
  manoeuvreInitTime: number;
  pathStats: PathStats;
  formatAltitude: (feet: number) => { value: number; label: string };
  altitudeLabel: string;
  isPom: boolean;
  showPointInfo: boolean;  // Whether to show point-specific info (the setting)
  showDrift: boolean;      // Whether to show wind drift (false for pre-wind path)
}

const LEG_NAMES = ['Final Leg', 'Base Leg', 'Downwind Leg'];

function LegStatsDisplay({ stats, formatAltitude, altitudeLabel, showDrift = true, showBearing = true }: {
  stats: LegStats;
  formatAltitude: (feet: number) => { value: number; label: string };
  altitudeLabel: string;
  showDrift?: boolean;
  showBearing?: boolean;
}) {
  const altTop = formatAltitude(stats.altTop);
  const altBottom = formatAltitude(stats.altBottom);
  const legName = LEG_NAMES[stats.legIndex] ?? `Leg ${stats.legIndex + 1}`;

  return (
    <div>
      <div><strong>{legName}</strong></div>
      <div>Alt: {Math.round(altTop.value)}→{Math.round(altBottom.value)} {altitudeLabel}</div>
      <div>Time: {stats.timeSec.toFixed(1)}s</div>
      <div>Heading: {formatDegrees(stats.heading)}</div>
      {showBearing && <div>Bearing: {formatDegrees(stats.bearing)}</div>}
      {showBearing && (() => {
        const drift = driftAngle(stats.heading, stats.bearing);
        return drift >= 1 ? <div>Drift angle: {Math.round(drift)}°</div> : null;
      })()}
      <div>Distance: {formatDistance(stats.distance, altitudeLabel)}</div>
      <div>Glide: {stats.glideRatio.toFixed(1)}</div>
      {showDrift && stats.windDriftDist > 1 && (
        <div>
          Wind drift: {formatDistance(stats.windDriftDist, altitudeLabel)} {formatDegrees((stats.windDriftDir + 180) % 360)}
          <DirectionArrow degrees={stats.windDriftDir} />
        </div>
      )}
    </div>
  );
}

function ManoeuvreStatsDisplay({ stats, altitudeLabel, showDrift = true }: {
  stats: ManoeuvreStats;
  altitudeLabel: string;
  showDrift?: boolean;
}) {
  return (
    <div>
      <div><strong>Manoeuvre</strong></div>
      <div>Time: {stats.timeSec.toFixed(1)}s</div>
      {/* <div>Bearing: {formatDegrees(stats.initialBearing)}→{formatDegrees(stats.finalBearing)}</div> */}
      <div>Offset: {formatDistance(stats.distanceX, altitudeLabel)}</div>
      <div>Back: {formatDistance(stats.distanceY, altitudeLabel)}</div>
      {showDrift && stats.windDriftDist > 1 && (
        <div>
          Wind drift: {formatDistance(stats.windDriftDist, altitudeLabel)} {formatDegrees((stats.windDriftDir + 180) % 360)}
          <DirectionArrow degrees={stats.windDriftDir} />
        </div>
      )}
    </div>
  );
}

function PointTooltip({ point, pointIndex, manoeuvreInitTime, pathStats, formatAltitude, altitudeLabel, isPom, showPointInfo, showDrift }: PointTooltipProps) {
  const alt = formatAltitude(point.alt ?? 0);

  // Time relative to manoeuvre initiation (convert from ms to seconds)
  // Pattern points are before initiation (negative), manoeuvre points are after (positive)
  const timeSinceInitMs = (point.time ?? 0) - manoeuvreInitTime;
  const timeSinceInitSec = timeSinceInitMs / 1000;
  const timeSign = timeSinceInitSec >= 0 ? '+' : '';

  // Get segment stats for this point
  const segmentStats = getPointSegmentStats(pointIndex, pathStats);

  // Determine what to show:
  // - POMs without showPointInfo: only section stats
  // - POMs with showPointInfo: section stats + separator + point info
  // - Non-POMs (only shown when showPointInfo): only point info
  const showSectionStats = isPom;
  const showPointDetails = showPointInfo;

  return (
    <MapOverlay position={point}>
      <div style={TOOLTIP_STYLE}>
        {/* Section stats (for POMs) */}
        {showSectionStats && segmentStats?.type === 'leg' && (
          <LegStatsDisplay
            stats={segmentStats.stats}
            formatAltitude={formatAltitude}
            altitudeLabel={altitudeLabel}
            showDrift={showDrift}
            showBearing={showDrift}
          />
        )}

        {showSectionStats && segmentStats?.type === 'manoeuvre' && (
          <ManoeuvreStatsDisplay
            stats={segmentStats.stats}
            altitudeLabel={altitudeLabel}
            showDrift={showDrift}
          />
        )}

        {/* Separator between section stats and point info */}
        {showSectionStats && showPointDetails && (
          <div style={SECTION_STYLE} />
        )}

        {/* Point-specific info */}
        {showPointDetails && (
          <>
            <div>Altitude: {Math.round(alt.value)} {altitudeLabel}</div>
            <div>Time: {timeSign}{timeSinceInitSec.toFixed(1)}s</div>
            <div style={TOOLTIP_SECONDARY_STYLE}>
              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            </div>
          </>
        )}
      </div>
    </MapOverlay>
  );
}

interface InteractivePointProps {
  point: PointData;
  pointIndex: number;
  manoeuvreInitTime: number;
  pathStats: PathStats;
  style: MapCircleStyle;
  showTooltip: boolean;
  showDrift: boolean;
  showCrabArrow: boolean;
  isHovered: boolean;
  onHover: () => void;
  onHoverEnd: () => void;
  formatAltitude: (feet: number) => { value: number; label: string };
  altitudeLabel: string;
}

const HIGHLIGHT_STYLE: MapCircleStyle = {
  fillColor: '#FFFFFF',
  fillOpacity: 0.9,
  strokeColor: '#FFFFFF',
  strokeOpacity: 1,
  strokeWeight: 2,
  radius: 3,
  zIndex: 50,
  clickable: false
};

// Base circle style for POM markers (radius in meters)
const POM_STYLE: Record<'manoeuvre' | 'pattern', MapCircleStyle> = {
  manoeuvre: {
    radius: 3,
    strokeOpacity: 1,
    strokeWeight: 1,
    fillOpacity: 1,
    zIndex: 1,
    clickable: false,
    fillColor: PATH_COLORS.manoeuvre,
    strokeColor: PATH_COLORS.markerStroke
  },
  pattern: {
    radius: 3,
    strokeOpacity: 1,
    strokeWeight: 1,
    fillOpacity: 1,
    zIndex: 1,
    clickable: false,
    fillColor: PATH_COLORS.pattern,
    strokeColor: PATH_COLORS.markerStroke
  }
};

// Larger radius for easier hovering (in meters)
const HOVER_RADIUS = 15;
const HOVER_RADIUS_POM_ONLY = 30;

function InteractivePoint({ point, pointIndex, manoeuvreInitTime, pathStats, style, showTooltip, showDrift, showCrabArrow, isHovered, onHover, onHoverEnd, formatAltitude, altitudeLabel }: InteractivePointProps) {
  // POMs always have hover/tooltip, non-POMs respect the showTooltip setting
  const isPom = Boolean(point.pom);
  const enableHover = isPom || showTooltip;

  // Drift angle arrow: shown on leg POMs when drift angle > 10°
  const segStats = isPom ? getPointSegmentStats(pointIndex, pathStats) : null;
  const legStats = segStats?.type === 'leg' ? segStats.stats : null;
  const crabAngle = legStats ? driftAngle(legStats.heading, legStats.bearing) : 0;
  const renderCrabArrow = showCrabArrow && crabAngle > 10 && legStats != null;

  return (
    <>
      {/* Visible circle (POM marker) */}
      <MapCircle
        center={point}
        {...style}
      />
      {/* Drift angle heading arrow (40m shaft + arrowhead barbs) */}
      {renderCrabArrow && (() => {
        const h = legStats!.heading;
        const tip = destinationPoint(point, h, 40);
        const lineProps = { color: '#ffffff', opacity: 0.9, weight: 2, zIndex: 40 };
        return (
          <>
            <MapPolyline path={[{ lat: point.lat, lng: point.lng }, tip]} {...lineProps} />
            <MapPolyline path={[tip, destinationPoint(tip, (h + 150 + 360) % 360, 10)]} {...lineProps} />
            <MapPolyline path={[tip, destinationPoint(tip, (h - 150 + 360) % 360, 10)]} {...lineProps} />
          </>
        );
      })()}
      {/* Invisible hover area (larger radius when only POMs are hoverable) */}
      {enableHover && (
        <MapCircle
          center={point}
          radius={showTooltip ? HOVER_RADIUS : HOVER_RADIUS_POM_ONLY}
          fillOpacity={0}
          strokeOpacity={0}
          clickable
          zIndex={100}
          onMouseOver={onHover}
          onMouseOut={onHoverEnd}
        />
      )}
      {isHovered && (
        <MapCircle
          center={point}
          {...HIGHLIGHT_STYLE}
        />
      )}
      {enableHover && isHovered && (
        <PointTooltip
          point={point}
          pointIndex={pointIndex}
          manoeuvreInitTime={manoeuvreInitTime}
          pathStats={pathStats}
          formatAltitude={formatAltitude}
          altitudeLabel={altitudeLabel}
          isPom={isPom}
          showPointInfo={showTooltip}
          showDrift={showDrift}
        />
      )}
    </>
  );
}

export interface FlightPathsLayerProps {
  /** Pre-wind (ideal) path. */
  pathA: FlightPath;
  /** Wind-corrected (display) path. */
  pathB: FlightPath;
  showPreWind: boolean;
  showPoms: boolean;
  showPomAltitudes: boolean;
  showPomTooltips: boolean;
  highlightCorrespondingPoints: boolean;
  showCrabArrow: boolean;
}

export default function FlightPathsLayer({
  pathA,
  pathB,
  showPreWind,
  showPoms,
  showPomAltitudes,
  showPomTooltips,
  highlightCorrespondingPoints,
  showCrabArrow
}: FlightPathsLayerProps) {
  const { formatAltitude, altitudeLabel } = useUnits();
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [hoveredPreWindIndex, setHoveredPreWindIndex] = useState<number | null>(null);

  // Convert FlightPath to LatLng[] for the map (memoized to avoid recalculation)
  const pathALatLngs = useMemo(() => pathToLatLngs(pathA), [pathA]);
  const pathBLatLngs = useMemo(() => pathToLatLngs(pathB), [pathB]);

  // Find the manoeuvre initiation time (the point where manoeuvre begins, which has the LOWEST time among manoeuvre points)
  const manoeuvreInitTime = useMemo(() => {
    const manoeuvrePoints = pathBLatLngs.filter(p => p.phase === 'manoeuvre');
    if (manoeuvrePoints.length === 0) return 0;
    return Math.min(...manoeuvrePoints.map(p => p.time ?? 0));
  }, [pathBLatLngs]);

  // Calculate path statistics for tooltips (wind-adjusted)
  const pathStats = useMemo(
    () => calculatePathStats(pathALatLngs, pathBLatLngs),
    [pathALatLngs, pathBLatLngs]
  );

  // Calculate pre-wind path statistics (uses pathB for POM detection, pathA for values)
  const preWindPathStats = useMemo(
    () => calculatePathStats(pathALatLngs, pathALatLngs),
    [pathALatLngs]
  );

  return (
    <>
      {showPreWind && (
        <MapPolyline
          path={pathALatLngs.filter(p => p.phase === 'manoeuvre')}
          color={PATH_COLORS.preWind}
          weight={2}
          zIndex={1}
          dotted
        />
      )}
      {showPreWind && (
        <MapPolyline
          path={pathALatLngs.filter(p => p.phase === 'pattern')}
          color={PATH_COLORS.preWind}
          weight={2}
          zIndex={1}
          dotted
        />
      )}
      <MapPolyline
        path={pathBLatLngs.filter(p => p.phase === 'manoeuvre')}
        color={PATH_COLORS.manoeuvre}
        opacity={0.8}
        weight={2}
        zIndex={1}
      />
      <MapPolyline
        path={pathBLatLngs.filter(p => p.phase === 'pattern')}
        color={PATH_COLORS.pattern}
        opacity={0.8}
        weight={2}
        zIndex={1}
      />

      {/* Pre-wind path - all points are interactive */}
      {showPreWind && pathALatLngs.map((point, i) => (
        <InteractivePoint
          key={`prewind-${i}`}
          point={point}
          pointIndex={i}
          manoeuvreInitTime={manoeuvreInitTime}
          pathStats={preWindPathStats}
          style={{
            ...(point.phase === 'manoeuvre' ? POM_STYLE.manoeuvre : POM_STYLE.pattern),
            fillColor: PATH_COLORS.preWind,
            strokeColor: PATH_COLORS.markerStroke,
            // Only show circle visually for POMs
            fillOpacity: (showPoms && point.pom) ? 0.7 : 0,
            strokeOpacity: (showPoms && point.pom) ? 0.7 : 0
          }}
          showTooltip={showPomTooltips}
          showDrift={false}
          showCrabArrow={false}
          isHovered={hoveredPreWindIndex === i}
          onHover={() => setHoveredPreWindIndex(i)}
          onHoverEnd={() => setHoveredPreWindIndex(null)}
          formatAltitude={formatAltitude}
          altitudeLabel={altitudeLabel}
        />
      ))}
      {/* Highlight for corresponding pre-wind point when hovering on wind-adjusted path */}
      {highlightCorrespondingPoints && hoveredPointIndex !== null && pathALatLngs[hoveredPointIndex] && (
        <MapCircle
          center={pathALatLngs[hoveredPointIndex]}
          {...HIGHLIGHT_STYLE}
        />
      )}
      {/* Highlight for corresponding wind-adjusted point when hovering on pre-wind path */}
      {highlightCorrespondingPoints && hoveredPreWindIndex !== null && pathBLatLngs[hoveredPreWindIndex] && (
        <MapCircle
          center={pathBLatLngs[hoveredPreWindIndex]}
          {...HIGHLIGHT_STYLE}
        />
      )}
      {/* Wind-adjusted path - all points are interactive when tooltips enabled */}
      {pathBLatLngs.map((point, i) => (
        <InteractivePoint
          key={i}
          point={point}
          pointIndex={i}
          manoeuvreInitTime={manoeuvreInitTime}
          pathStats={pathStats}
          style={{
            ...(point.phase === 'manoeuvre' ? POM_STYLE.manoeuvre : POM_STYLE.pattern),
            // Only show circle visually for POMs, but all points are hoverable
            fillOpacity: (showPoms && point.pom) ? 1 : 0,
            strokeOpacity: (showPoms && point.pom) ? 1 : 0
          }}
          showTooltip={showPomTooltips}
          showDrift={true}
          showCrabArrow={showCrabArrow}
          isHovered={hoveredPointIndex === i}
          onHover={() => setHoveredPointIndex(i)}
          onHoverEnd={() => setHoveredPointIndex(null)}
          formatAltitude={formatAltitude}
          altitudeLabel={altitudeLabel}
        />
      ))}
      {pathBLatLngs
        .filter(p => showPomAltitudes && p.pom)
        .map((pom, i) => (
          <CustomTextOverlay
            position={pom}
            text={`${Math.round(formatAltitude(pom.alt ?? 0).value)} ${altitudeLabel}`}
            key={i}
          />
        ))}
    </>
  );
}
