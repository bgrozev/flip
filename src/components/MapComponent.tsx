import {
  CircleF,
  GoogleMap,
  OverlayView,
  PolylineF,
  useJsApiLoader
} from '@react-google-maps/api';
import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';

import {
  ALTITUDE_LABEL_STYLE,
  DEFAULT_MAP_OPTIONS,
  GOOGLE_MAPS_LIBRARIES,
  MAP_CONTAINER_STYLE,
  PATH_COLORS,
  PATH_OPTIONS,
  PATH_OPTIONS_DOTTED,
  POM_OPTIONS
} from '../constants';
import { useUnits } from '../hooks';
import { LatLng, Settings } from '../types';
import { pathToLatLngs } from '../util/coords';
import { FlightPath } from '../types';
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
  <OverlayView position={position} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
    <div style={ALTITUDE_LABEL_STYLE}>
      {text}
    </div>
  </OverlayView>
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

function formatDegrees(deg: number): string {
  return `${Math.round(deg)}°`;
}

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

function formatDistance(feet: number, altitudeLabel: string): string {
  if (altitudeLabel === 'm') {
    return `${Math.round(feet / 3.28084)} m`;
  }
  return `${Math.round(feet)} ft`;
}

function haversineDistanceFt(a: LatLng, b: LatLng): number {
  const R = 20902231; // Earth radius in feet
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
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
      <div>Distance: {formatDistance(stats.distance, altitudeLabel)}</div>
      <div>Glide: {stats.glideRatio.toFixed(1)}</div>
      {showDrift && stats.windDriftDist > 1 && (
        <div>
          Drift: {formatDistance(stats.windDriftDist, altitudeLabel)} {formatDegrees(stats.windDriftDir)}
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
          Drift: {formatDistance(stats.windDriftDist, altitudeLabel)} {formatDegrees(stats.windDriftDir)}
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
    <OverlayView position={point} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
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
    </OverlayView>
  );
}

interface InteractivePointProps {
  point: PointData;
  pointIndex: number;
  manoeuvreInitTime: number;
  pathStats: PathStats;
  options: google.maps.CircleOptions;
  showTooltip: boolean;
  showDrift: boolean;
  isHovered: boolean;
  onHover: () => void;
  onHoverEnd: () => void;
  formatAltitude: (feet: number) => { value: number; label: string };
  altitudeLabel: string;
}

const HIGHLIGHT_OPTIONS: google.maps.CircleOptions = {
  fillColor: '#FFFFFF',
  fillOpacity: 0.9,
  strokeColor: '#FFFFFF',
  strokeOpacity: 1,
  strokeWeight: 2,
  radius: 6,
  zIndex: 50,
  clickable: false
};

// Larger radius for easier hovering (in meters)
const HOVER_RADIUS = 15;
const HOVER_RADIUS_POM_ONLY = 30;

function InteractivePoint({ point, pointIndex, manoeuvreInitTime, pathStats, options, showTooltip, showDrift, isHovered, onHover, onHoverEnd, formatAltitude, altitudeLabel }: InteractivePointProps) {
  // POMs always have hover/tooltip, non-POMs respect the showTooltip setting
  const isPom = Boolean(point.pom);
  const enableHover = isPom || showTooltip;

  // Use larger hover radius when only POMs are hoverable (showTooltip off)
  const hoverAreaOptions: google.maps.CircleOptions = {
    fillOpacity: 0,
    strokeOpacity: 0,
    clickable: true,
    radius: showTooltip ? HOVER_RADIUS : HOVER_RADIUS_POM_ONLY,
    zIndex: 100
  };

  return (
    <>
      {/* Visible circle (POM marker) */}
      <CircleF
        center={point}
        options={options}
      />
      {/* Invisible hover area */}
      {enableHover && (
        <CircleF
          center={point}
          options={hoverAreaOptions}
          onMouseOver={onHover}
          onMouseOut={onHoverEnd}
        />
      )}
      {isHovered && (
        <CircleF
          center={point}
          options={HIGHLIGHT_OPTIONS}
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

interface MapComponentProps {
  windSpeed: number;
  windDirection: number;
  center: LatLng;
  onClick: (latLng: LatLng) => void;
  pathA: FlightPath;
  pathB: FlightPath;
  settings: Settings;
  waitingForClick: boolean;
}

function MapComponent({
  windSpeed,
  windDirection,
  center,
  onClick,
  pathA,
  pathB,
  settings,
  waitingForClick
}: MapComponentProps) {
  const { showPoms, showPomAltitudes, showPomTooltips, showPreWind, displayWindArrow, highlightCorrespondingPoints, showMeasureTool } = settings;
  const { formatAltitude, altitudeLabel } = useUnits();
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [hoveredPreWindIndex, setHoveredPreWindIndex] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<LatLng[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);

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
      result.push(result[i - 1] + haversineDistanceFt(measurePoints[i - 1], measurePoints[i]));
    }
    return result;
  }, [measurePoints]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    map.setCenter(center);
    map.setZoom(DEFAULT_MAP_OPTIONS.zoom);
    console.log('Map loaded.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map center when target changes (but not on every render)
  const prevCenterRef = useRef(center);
  useEffect(() => {
    if (mapRef.current && (prevCenterRef.current.lat !== center.lat || prevCenterRef.current.lng !== center.lng)) {
      mapRef.current.panTo(center);
      prevCenterRef.current = center;
    }
  }, [center]);

  // Update cursor without causing map re-render
  if (mapRef.current) {
    const cursor = (showMeasureTool && measuring) || waitingForClick ? 'crosshair' : 'grab';
    mapRef.current.setOptions({ draggableCursor: cursor });
  }

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'INSERT_GOOGLE_API_KEY',
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  // Convert FlightPath to LatLng[] for Google Maps (memoized to avoid recalculation)
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

  return isLoaded ? (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        onClick={ev => {
          if (!ev.latLng) return;
          const latlng = { lat: ev.latLng.lat(), lng: ev.latLng.lng() };
          if (showMeasureTool && measuring) {
            setMeasurePoints(pts => [...pts, latlng]);
          } else {
            onClick(latlng);
          }
        }}
        options={DEFAULT_MAP_OPTIONS}
        onLoad={onMapLoad}
      >
        {showPreWind && (
          <PolylineF
            path={pathALatLngs.filter(p => p.phase === 'manoeuvre')}
            options={{ ...PATH_OPTIONS_DOTTED, strokeColor: PATH_COLORS.preWind }}
          />
        )}
        {showPreWind && (
          <PolylineF
            path={pathALatLngs.filter(p => p.phase === 'pattern')}
            options={{ ...PATH_OPTIONS_DOTTED, strokeColor: PATH_COLORS.preWind }}
          />
        )}
        <PolylineF
          path={pathBLatLngs.filter(p => p.phase === 'manoeuvre')}
          options={{ ...PATH_OPTIONS, strokeColor: PATH_COLORS.manoeuvre }}
        />
        <PolylineF
          path={pathBLatLngs.filter(p => p.phase === 'pattern')}
          options={{ ...PATH_OPTIONS, strokeColor: PATH_COLORS.pattern }}
        />

        {/* Pre-wind path - all points are interactive */}
        {showPreWind && pathALatLngs.map((point, i) => (
          <InteractivePoint
            key={`prewind-${i}`}
            point={point}
            pointIndex={i}
            manoeuvreInitTime={manoeuvreInitTime}
            pathStats={preWindPathStats}
            options={{
              ...(point.phase === 'manoeuvre' ? POM_OPTIONS.manoeuvre : POM_OPTIONS.pattern),
              fillColor: PATH_COLORS.preWind,
              strokeColor: PATH_COLORS.markerStroke,
              // Only show circle visually for POMs
              fillOpacity: (showPoms && point.pom) ? 0.7 : 0,
              strokeOpacity: (showPoms && point.pom) ? 0.7 : 0
            }}
            showTooltip={showPomTooltips}
            showDrift={false}
            isHovered={hoveredPreWindIndex === i}
            onHover={() => setHoveredPreWindIndex(i)}
            onHoverEnd={() => setHoveredPreWindIndex(null)}
            formatAltitude={formatAltitude}
            altitudeLabel={altitudeLabel}
          />
        ))}
        {/* Highlight for corresponding pre-wind point when hovering on wind-adjusted path */}
        {highlightCorrespondingPoints && hoveredPointIndex !== null && pathALatLngs[hoveredPointIndex] && (
          <CircleF
            center={pathALatLngs[hoveredPointIndex]}
            options={HIGHLIGHT_OPTIONS}
          />
        )}
        {/* Highlight for corresponding wind-adjusted point when hovering on pre-wind path */}
        {highlightCorrespondingPoints && hoveredPreWindIndex !== null && pathBLatLngs[hoveredPreWindIndex] && (
          <CircleF
            center={pathBLatLngs[hoveredPreWindIndex]}
            options={HIGHLIGHT_OPTIONS}
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
            options={{
              ...(point.phase === 'manoeuvre' ? POM_OPTIONS.manoeuvre : POM_OPTIONS.pattern),
              // Only show circle visually for POMs, but all points are hoverable
              fillOpacity: (showPoms && point.pom) ? 1 : 0,
              strokeOpacity: (showPoms && point.pom) ? 1 : 0
            }}
            showTooltip={showPomTooltips}
            showDrift={true}
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
          <PolylineF
            path={measurePoints}
            options={{
              strokeColor: '#2196F3',
              strokeOpacity: 1,
              strokeWeight: 2,
              zIndex: 20,
              clickable: false
            }}
          />
        )}

        {/* Measure tool — point markers and cumulative distance labels */}
        {showMeasureTool && measuring && measurePoints.map((point, i) => (
          <React.Fragment key={`measure-${i}`}>
            <CircleF
              center={point}
              options={{
                radius: i === 0 ? 7 : 5,
                fillColor: '#2196F3',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                strokeOpacity: 1,
                clickable: true,
                zIndex: 21
              }}
              onClick={() => setMeasurePoints(pts => pts.filter((_, idx) => idx !== i))}
            />
            {i > 0 && (
              <OverlayView position={point} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                <div style={MEASURE_LABEL_STYLE}>
                  {formatDistance(measureCumulatives[i], altitudeLabel)}
                </div>
              </OverlayView>
            )}
          </React.Fragment>
        ))}
      </GoogleMap>

      {/* Measure tool — ruler toggle button */}
      {showMeasureTool && <div style={{ position: 'absolute', top: 130, right: 10, zIndex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
      </div>}

      {displayWindArrow && (
        <WindDirectionArrow direction={windDirection} speed={windSpeed} />
      )}
    </div>
  ) : (
    <>Loading</>
  );
}

export default React.memo(MapComponent);
