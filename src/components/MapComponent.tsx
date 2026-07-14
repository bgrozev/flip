import React, { useMemo, useState, useRef, useCallback } from 'react';

import { ALTITUDE_LABEL_STYLE, PATH_COLORS } from '../constants';
import { useUnits } from '../hooks';
import { Course, CourseElement, CourseMarker, LatLng, Settings } from '../types';

export interface CourseEditTarget {
  center: LatLng;
  direction: number;
  onMove: (newCenter: LatLng) => void;
  onRotate: (newDirection: number) => void;
}

export interface TargetEditTarget {
  target: LatLng;
  heading: number;
  onMove: (pos: LatLng) => void;
  onHeadingChange: (heading: number) => void;
}
import { pathToLatLngs } from '../core/coords';
import { bearingBetween, destinationPoint, distanceFeet } from '../core/geometry';
import { formatDegrees, formatDistanceFeet, speedGustLabel } from '../core/units';
import { beaufortColor } from '../core/wind';
import {
  MapCircle,
  MapCircleStyle,
  MapContainer,
  MapControl,
  MapDragHandle,
  MapOverlay,
  MapPolyline,
  useMapClick,
  useMapCursor,
  useMapZoom
} from '../map';
import { FlightPath, ObservedWindStation } from '../types';
import {
  calculatePathStats,
  getPointSegmentStats,
  LegStats,
  ManoeuvreStats,
  PathStats
} from '../util/pathStats';

import WindDirectionArrow from './WindDirectionArrow';

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

interface PointData {
  lat: number;
  lng: number;
  alt?: number;
  time?: number;
  phase?: string;
  pom?: number | boolean;
}

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

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  color: 'white',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '11px',
  lineHeight: '1.5',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  transform: 'translate(-50%, -100%)',
  marginTop: '-12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  minWidth: 'max-content'
};

const SECTION_STYLE: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.2)',
  marginTop: '6px',
  paddingTop: '6px'
};

function DirectionArrow({ degrees }: { degrees: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        transform: `rotate(${degrees + 180}deg)`,
        marginLeft: '4px'
      }}
    >
      ↑
    </span>
  );
}

/** Format a distance in feet using the preferred altitude unit ('m' label → meters). */
function formatDistance(feet: number, altitudeLabel: string): string {
  return formatDistanceFeet(feet, altitudeLabel === 'm' ? 'm' : 'ft');
}

const RULER_BUTTON_STYLE: React.CSSProperties = {
  width: 32,
  height: 32,
  border: 'none',
  borderRadius: 4,
  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  fontSize: 16
};

const MEASURE_LABEL_STYLE: React.CSSProperties = {
  backgroundColor: 'rgba(33, 150, 243, 0.9)',
  color: 'white',
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: '11px',
  whiteSpace: 'nowrap',
  transform: 'translate(-50%, -130%)',
  pointerEvents: 'none',
  boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
};

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
        const crab = Math.abs(((stats.heading - stats.bearing + 180 + 360) % 360) - 180);
        return crab >= 1 ? <div>Crab: {Math.round(crab)}°</div> : null;
      })()}
      <div>Distance: {formatDistance(stats.distance, altitudeLabel)}</div>
      <div>Glide: {stats.glideRatio.toFixed(1)}</div>
      {showDrift && stats.windDriftDist > 1 && (
        <div>
          Drift: {formatDistance(stats.windDriftDist, altitudeLabel)} {formatDegrees((stats.windDriftDir + 180) % 360)}
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
          Drift: {formatDistance(stats.windDriftDist, altitudeLabel)} {formatDegrees((stats.windDriftDir + 180) % 360)}
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
            <div style={{ fontSize: '10px', color: '#aaa' }}>
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

  // Crab angle arrow: shown on leg POMs when crab > 10°
  const segStats = isPom ? getPointSegmentStats(pointIndex, pathStats) : null;
  const legStats = segStats?.type === 'leg' ? segStats.stats : null;
  const crabAngle = legStats
    ? Math.abs(((legStats.heading - legStats.bearing + 180 + 360) % 360) - 180)
    : 0;
  const renderCrabArrow = showCrabArrow && crabAngle > 10 && legStats != null;

  return (
    <>
      {/* Visible circle (POM marker) */}
      <MapCircle
        center={point}
        {...style}
      />
      {/* Crab angle heading arrow (40m shaft + arrowhead barbs) */}
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

function formatObservedTime(date: Date): string {
  const now = new Date();
  const diffMin = Math.round((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const CLOUD_AMOUNT_LABELS: Record<string, string> = {
  SKC: 'Clear', CLR: 'Clear', FEW: 'Few', SCT: 'Scattered',
  BKN: 'Broken', OVC: 'Overcast', VV: 'Obscured'
};

function StationTooltip({ station, onMouseEnter, onMouseLeave }: {
  station: ObservedWindStation;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const { formatWindSpeed, formatTemperature, formatPressure, windSpeedLabel, altitudeLabel } = useUnits();
  const distMiles = (station.distanceFt / 5280).toFixed(1);
  const wind = formatWindSpeed(station.wind.speedKts);
  const gust = station.wind.gustKts !== undefined ? formatWindSpeed(station.wind.gustKts) : null;

  return (
    <div
      style={{
        ...TOOLTIP_STYLE,
        minWidth: 180,
        pointerEvents: 'auto',
        transform: 'translate(-50%, calc(-100% - 18px))'
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{station.name}</div>
      <div style={{ color: '#aaa', fontSize: '10px', marginBottom: 2 }}>
        {station.stationUrl
          ? <a href={station.stationUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#90caf9', textDecoration: 'none' }}>{station.source}</a>
          : station.source
        }
        {' · '}{distMiles} mi · {formatObservedTime(station.observedAt)}
      </div>
      {station.textDescription && (
        <div style={{ color: '#ccc', fontStyle: 'italic', marginBottom: 2 }}>{station.textDescription}</div>
      )}

      <div style={SECTION_STYLE}>
        <div>
          Wind: {wind.value.toFixed(1)} {windSpeedLabel}{' '}
          {formatDegrees(station.wind.direction)}
          <DirectionArrow degrees={station.wind.direction} />
        </div>
        {gust !== null
          ? <div>Gusts: {gust.value.toFixed(1)} {windSpeedLabel}</div>
          : <div style={{ color: '#666' }}>Gusts: —</div>
        }
      </div>

      <div style={SECTION_STYLE}>
        {station.temperatureC !== undefined
          ? <div>Temp: {formatTemperature(station.temperatureC).value} {formatTemperature(station.temperatureC).label}</div>
          : <div style={{ color: '#666' }}>Temp: —</div>
        }
        {station.dewpointC !== undefined && (
          <div>Dewpoint: {formatTemperature(station.dewpointC).value} {formatTemperature(station.dewpointC).label}</div>
        )}
        {station.windChillC !== undefined && (
          <div>Wind chill: {formatTemperature(station.windChillC).value} {formatTemperature(station.windChillC).label}</div>
        )}
        {station.heatIndexC !== undefined && (
          <div>Heat index: {formatTemperature(station.heatIndexC).value} {formatTemperature(station.heatIndexC).label}</div>
        )}
        {station.humidityPct !== undefined
          ? <div>Humidity: {Math.round(station.humidityPct)}%</div>
          : <div style={{ color: '#666' }}>Humidity: —</div>
        }
      </div>

      <div style={SECTION_STYLE}>
        {station.seaLevelPressureHpa !== undefined
          ? <div>SLP: {formatPressure(station.seaLevelPressureHpa).value} {formatPressure(station.seaLevelPressureHpa).label}</div>
          : station.pressureHpa !== undefined
            ? <div>Pressure: {formatPressure(station.pressureHpa).value} {formatPressure(station.pressureHpa).label}</div>
            : <div style={{ color: '#666' }}>Pressure: —</div>
        }
        {station.visibilityM !== undefined && (
          <div>
            Visibility:{' '}
            {altitudeLabel === 'm'
              ? `${(station.visibilityM / 1000).toFixed(1)} km`
              : `${(station.visibilityM / 1609).toFixed(1)} mi`
            }
          </div>
        )}
      </div>

      {station.cloudLayers && station.cloudLayers.length > 0 && (
        <div style={SECTION_STYLE}>
          {station.cloudLayers.map((layer, i) => {
            const label = CLOUD_AMOUNT_LABELS[layer.amount] ?? layer.amount;
            const base = layer.baseM !== null
              ? altitudeLabel === 'm'
                ? `${Math.round(layer.baseM)} m`
                : `${Math.round(layer.baseM * 3.28084)} ft`
              : null;
            return (
              <div key={i}>
                {label}{base !== null ? ` @ ${base}` : ''}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MapComponentProps {
  windSpeed: number;
  windDirection: number;
  center: LatLng;
  pathA: FlightPath;
  pathB: FlightPath;
  settings: Settings;
  courses?: Course[];
  courseEditTarget?: CourseEditTarget;
  targetEditTarget?: TargetEditTarget;
  observedStations?: ObservedWindStation[];
  groundWindStation?: ObservedWindStation;
  forecastGroundWind?: { direction: number; speedKts: number };
  forecastValidTime?: Date;
  finalHeading?: number;
}

function MapComponent(props: MapComponentProps) {
  return (
    <MapContainer center={props.center}>
      <MapContent {...props} />
    </MapContainer>
  );
}

function MapContent({
  windSpeed,
  windDirection,
  center,
  pathA,
  pathB,
  settings,
  courses = [],
  courseEditTarget,
  targetEditTarget,
  observedStations = [],
  groundWindStation,
  forecastGroundWind,
  forecastValidTime,
  finalHeading = 0
}: MapComponentProps) {
  const { showPoms, showPomAltitudes, showPomTooltips, showPreWind, displayWindArrow, highlightCorrespondingPoints, showMeasureTool, showCrabArrow } = settings;
  const { formatAltitude, altitudeLabel, formatWindSpeed, windSpeedLabel } = useUnits();
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [hoveredPreWindIndex, setHoveredPreWindIndex] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<LatLng[]>([]);
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);
  const stationLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onStationEnter = useCallback((id: string) => {
    if (stationLeaveTimer.current) clearTimeout(stationLeaveTimer.current);
    setHoveredStationId(id);
  }, []);

  const onStationLeave = useCallback(() => {
    stationLeaveTimer.current = setTimeout(() => setHoveredStationId(null), 200);
  }, []);
  const zoom = useMapZoom();
  // Live position of drag handles while dragging (for smooth line preview)
  const [liveHandlePos, setLiveHandlePos] = useState<LatLng | null>(null);
  const [liveTargetHeadingPos, setLiveTargetHeadingPos] = useState<LatLng | null>(null);

  const toggleMeasuring = useCallback(() => {
    setMeasuring(m => {
      if (m) setMeasurePoints([]);
      return !m;
    });
  }, []);

  // Cumulative distances from the first measure point (in feet)
  const measureCumulatives = useMemo(() => {
    const result: number[] = [0];
    for (let i = 1; i < measurePoints.length; i++) {
      result.push(result[i - 1] + distanceFeet(measurePoints[i - 1], measurePoints[i]));
    }
    return result;
  }, [measurePoints]);

  // Crosshair cursor during measure or target-edit mode
  useMapCursor((showMeasureTool && measuring) || targetEditTarget ? 'crosshair' : null);

  // Map background clicks: measure points take precedence over target moves
  useMapClick(latlng => {
    if (showMeasureTool && measuring) {
      setMeasurePoints(pts => [...pts, latlng]);
    } else if (targetEditTarget) {
      targetEditTarget.onMove(latlng);
    }
  }, { enabled: (showMeasureTool && measuring) || Boolean(targetEditTarget) });

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

      {/* Measure tool — polyline */}
      {showMeasureTool && measuring && measurePoints.length > 1 && (
        <MapPolyline
          path={measurePoints}
          color="#2196F3"
          opacity={1}
          weight={2}
          zIndex={20}
        />
      )}

      {/* Course elements */}
      {courses.flatMap(course =>
        course.elements.map((element: CourseElement, i) => {
          const key = `${course.id}-${element.type}-${i}`;

          if (element.type === 'buoy') {
            // Two concentric circles.
            // White buoy: white outer + white inner, both with black stroke.
            // Orange buoy: orange outer + white inner; black stroke on both
            //   creates a thin black ring between the two fills.
            const outerFill = element.color === 'white' ? '#ffffff' : '#ff8800';
            const center = { lat: element.lat, lng: element.lng };
            return (
              <React.Fragment key={key}>
                <MapCircle
                  center={center}
                  radius={1.2}
                  fillColor={outerFill}
                  fillOpacity={1}
                  strokeColor="#000"
                  strokeWeight={0.75}
                  strokeOpacity={1}
                  zIndex={15}
                />
                <MapCircle
                  center={center}
                  radius={0.6}
                  fillColor="#ffffff"
                  fillOpacity={1}
                  strokeColor="#000"
                  strokeWeight={0.4}
                  strokeOpacity={1}
                  zIndex={16}
                />
              </React.Fragment>
            );
          }
          if (element.type === 'line') {
            return (
              <MapPolyline
                key={key}
                path={[element.from, element.to]}
                color={element.color}
                opacity={0.9}
                weight={1.5}
                zIndex={10}
              />
            );
          }
          if (element.type === 'marker') {
            if (zoom < 20) return null;
            const marker = element as CourseMarker;
            const pos = { lat: marker.lat, lng: marker.lng };
            if (!marker.label) return null;
            return (
              <MapOverlay key={key} position={pos}>
                <div style={{
                  display: 'inline-block',
                  color: marker.color,
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  fontWeight: 'bold',
                  background: 'rgba(0,0,0,0.65)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: '2px',
                  padding: '1px 3px',
                }}>
                  {marker.label}
                </div>
              </MapOverlay>
            );
          }
          return null;
        })
      )}

      {/* Measure tool — point markers and cumulative distance labels */}
      {showMeasureTool && measuring && measurePoints.map((point, i) => (
        <React.Fragment key={`measure-${i}`}>
          <MapCircle
            center={point}
            radius={i === 0 ? 7 : 5}
            fillColor="#2196F3"
            fillOpacity={1}
            strokeColor="#ffffff"
            strokeWeight={2}
            strokeOpacity={1}
            clickable
            zIndex={21}
            onClick={() => setMeasurePoints(pts => pts.filter((_, idx) => idx !== i))}
          />
          {i > 0 && (
            <MapOverlay position={point}>
              <div style={MEASURE_LABEL_STYLE}>
                {formatDistance(measureCumulatives[i], altitudeLabel)}
              </div>
            </MapOverlay>
          )}
        </React.Fragment>
      ))}
      {/* Observed wind stations — each at its real geographic location */}
      {observedStations.map(station => {
        const isHovered = hoveredStationId === station.id;
        const speedKts = station.wind.speedKts;
        const gustKts = station.wind.gustKts;
        const color = beaufortColor(speedKts);
        // Arrow points where wind is going (direction = where it comes FROM, so rotate by direction+180)
        const arrowRotation = station.wind.direction + 180;
        const speedDisplay = formatWindSpeed(speedKts);
        const gustDisplay = gustKts != null ? formatWindSpeed(gustKts) : null;
        return (
          <React.Fragment key={station.id}>
            <MapOverlay position={{ lat: station.lat, lng: station.lng }}>
              <div
                style={{
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'default',
                  userSelect: 'none',
                  opacity: isHovered ? 1 : 0.85
                }}
                onMouseEnter={() => onStationEnter(station.id)}
                onMouseLeave={onStationLeave}
              >
                <svg
                  width="22"
                  height="26"
                  viewBox="0 0 22 26"
                  style={{ transform: `rotate(${arrowRotation}deg)`, display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}
                >
                  <polygon points="11,1 19,20 11,15 3,20" fill={color} stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
                </svg>
                <div style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'white',
                  textShadow: '0 0 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)',
                  lineHeight: 1,
                  marginTop: 1,
                  whiteSpace: 'nowrap'
                }}>
                  {speedGustLabel(speedDisplay.value, gustDisplay?.value)} {windSpeedLabel}
                </div>
              </div>
            </MapOverlay>
            {isHovered && (
              <MapOverlay position={{ lat: station.lat, lng: station.lng }}>
                <StationTooltip station={station} onMouseEnter={() => onStationEnter(station.id)} onMouseLeave={onStationLeave} />
              </MapOverlay>
            )}
          </React.Fragment>
        );
      })}

      {/* Arrow anchored near the target: observed station (if available) or forecast ground wind */}
      {(() => {
        const rad = (finalHeading * Math.PI) / 180;
        const dx = +(Math.sin(rad) * 50).toFixed(1);
        const dy = +(-Math.cos(rad) * 50).toFixed(1);
        const transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        if (groundWindStation) {
          const station = groundWindStation;
          const hoverId = `${station.id}-target`;
          const isHovered = hoveredStationId === hoverId;
          const speedKts = station.wind.speedKts;
          const gustKts = station.wind.gustKts;
          const color = beaufortColor(speedKts);
          const arrowRotation = station.wind.direction + 180;
          const speedDisplay = formatWindSpeed(speedKts);
          const gustDisplay = gustKts != null ? formatWindSpeed(gustKts) : null;
          return (
            <React.Fragment key={hoverId}>
              <MapOverlay position={center}>
                <div
                  style={{ transform, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default', userSelect: 'none', opacity: isHovered ? 1 : 0.85 }}
                  onMouseEnter={() => onStationEnter(hoverId)}
                  onMouseLeave={onStationLeave}
                >
                  <svg width="22" height="26" viewBox="0 0 22 26" style={{ transform: `rotate(${arrowRotation}deg)`, display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>
                    <polygon points="11,1 19,20 11,15 3,20" fill={color} stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
                  </svg>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'white', textShadow: '0 0 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)', lineHeight: 1, marginTop: 1, whiteSpace: 'nowrap' }}>
                    {speedGustLabel(speedDisplay.value, gustDisplay?.value)} {windSpeedLabel}
                  </div>
                </div>
              </MapOverlay>
              {isHovered && (
                <MapOverlay position={center}>
                  <StationTooltip station={station} onMouseEnter={() => onStationEnter(hoverId)} onMouseLeave={onStationLeave} />
                </MapOverlay>
              )}
            </React.Fragment>
          );
        }

        if (forecastGroundWind) {
          const { direction, speedKts } = forecastGroundWind;
          const color = beaufortColor(speedKts);
          const arrowRotation = direction + 180;
          const speedDisplay = formatWindSpeed(speedKts);
          const isHovered = hoveredStationId === 'forecast-ground';
          const validTimeStr = forecastValidTime
            ? forecastValidTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : null;
          return (
            <React.Fragment key="forecast-ground-target">
              <MapOverlay position={center}>
                <div
                  style={{ transform, position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', cursor: 'default', userSelect: 'none', opacity: isHovered ? 1 : 0.75, pointerEvents: 'auto' }}
                  onMouseEnter={() => onStationEnter('forecast-ground')}
                  onMouseLeave={onStationLeave}
                >
                  <svg width="22" height="26" viewBox="0 0 22 26" style={{ transform: `rotate(${arrowRotation}deg)`, display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>
                    <polygon points="11,1 19,20 11,15 3,20" fill={color} stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
                  </svg>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'white', textShadow: '0 0 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)', lineHeight: 1, marginTop: 1, whiteSpace: 'nowrap' }}>
                    {speedDisplay.value.toFixed(0)} {windSpeedLabel}
                  </div>
                  {isHovered && (
                    <div style={{
                      position: 'absolute',
                      left: '100%',
                      top: 0,
                      marginLeft: 8,
                      background: 'rgba(30,30,30,0.92)',
                      color: 'white',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: '12px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                      pointerEvents: 'auto'
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>Forecast ground wind</div>
                      <div>{direction}° at {speedDisplay.value.toFixed(0)} {windSpeedLabel}</div>
                      {validTimeStr && <div style={{ color: '#aaa', fontSize: '11px', marginTop: 2 }}>Valid {validTimeStr}</div>}
                    </div>
                  )}
                </div>
              </MapOverlay>
            </React.Fragment>
          );
        }

        return null;
      })()}

      {/* Target edit handles — position drag + heading direction handle */}
      {targetEditTarget && (() => {
        const headingHandlePos = destinationPoint(targetEditTarget.target, targetEditTarget.heading, 15);
        const headingLineEnd = liveTargetHeadingPos ?? headingHandlePos;
        return (
          <React.Fragment key="target-edit-handles">
            <MapPolyline
              path={[targetEditTarget.target, headingLineEnd]}
              color="#ffaa00"
              weight={2}
              opacity={0.9}
              zIndex={25}
            />
            <MapDragHandle
              position={targetEditTarget.target}
              cursor="move"
              zIndex={26}
              color="#00ccff"
              scale={9}
              onDragEnd={pos => targetEditTarget.onMove(pos)}
            />
            <MapDragHandle
              position={headingHandlePos}
              cursor="pointer"
              zIndex={27}
              color="#ffaa00"
              scale={7}
              onDrag={pos => setLiveTargetHeadingPos(pos)}
              onDragEnd={pos => {
                setLiveTargetHeadingPos(null);
                targetEditTarget.onHeadingChange(bearingBetween(targetEditTarget.target, pos));
              }}
            />
          </React.Fragment>
        );
      })()}

      {/* Course edit handles — center drag + rotation handle */}
      {courseEditTarget && (() => {
        const rotationHandlePos = destinationPoint(courseEditTarget.center, courseEditTarget.direction, 15);
        const lineEnd = liveHandlePos ?? rotationHandlePos;
        return (
          <React.Fragment key="course-edit-handles">
            {/* Line from center to rotation handle */}
            <MapPolyline
              path={[courseEditTarget.center, lineEnd]}
              color="#ffaa00"
              weight={2}
              opacity={0.9}
              zIndex={25}
            />
            {/* Center drag marker (cyan crosshair) */}
            <MapDragHandle
              position={courseEditTarget.center}
              cursor="move"
              zIndex={26}
              color="#00ccff"
              scale={9}
              onDragEnd={pos => courseEditTarget.onMove(pos)}
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
                courseEditTarget.onRotate(bearingBetween(courseEditTarget.center, pos));
              }}
            />
          </React.Fragment>
        );
      })()}

      {/* Measure tool — ruler toggle button */}
      {showMeasureTool && (
        <MapControl>
          <div style={{ position: 'absolute', top: 130, right: 10, zIndex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              onClick={toggleMeasuring}
              title={measuring ? 'Exit measure mode (click points to remove)' : 'Measure distance'}
              style={{
                ...RULER_BUTTON_STYLE,
                backgroundColor: measuring ? '#2196F3' : 'white',
                color: measuring ? 'white' : '#333'
              }}
            >
              📐
            </button>
            {measuring && measurePoints.length > 0 && (
              <button
                onClick={() => setMeasurePoints([])}
                title="Clear measurements"
                style={{ ...RULER_BUTTON_STYLE, backgroundColor: 'white', color: '#333' }}
              >
                ✕
              </button>
            )}
          </div>
        </MapControl>
      )}

      {displayWindArrow && (
        <MapControl>
          <WindDirectionArrow direction={windDirection} speed={windSpeed} />
        </MapControl>
      )}
    </>
  );
}

export default React.memo(MapComponent);
