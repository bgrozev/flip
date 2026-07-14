import React, { useMemo, useState, useRef, useCallback } from 'react';

import { useUnits } from '../hooks';
import { Course, LatLng, Settings } from '../types';
import { distanceFeet } from '../core/geometry';
import { formatDegrees, speedGustLabel } from '../core/units';
import { beaufortColor } from '../core/wind';
import {
  MapCircle,
  MapContainer,
  MapControl,
  MapOverlay,
  MapPolyline,
  useMapClick,
  useMapCursor
} from '../map';
import {
  CourseEditLayer,
  CourseEditTarget,
  CourseLayer,
  FlightPathsLayer,
  TargetEditLayer,
  TargetEditTarget
} from '../map/layers';
import { DirectionArrow, formatDistance, SECTION_STYLE, TOOLTIP_STYLE } from '../map/layers/tooltip';
import { FlightPath, ObservedWindStation } from '../types';

export type { CourseEditTarget, TargetEditTarget };

import WindDirectionArrow from './WindDirectionArrow';

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
  const { altitudeLabel, formatWindSpeed, windSpeedLabel } = useUnits();
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

  // Crosshair cursor while measuring; clicks add measure points
  // (priority 10 so measuring takes precedence over target editing).
  useMapCursor(showMeasureTool && measuring ? 'crosshair' : null);
  useMapClick(latlng => {
    setMeasurePoints(pts => [...pts, latlng]);
  }, { enabled: showMeasureTool && measuring, priority: 10 });

  return (
    <>
      <FlightPathsLayer
        pathA={pathA}
        pathB={pathB}
        showPreWind={showPreWind}
        showPoms={showPoms}
        showPomAltitudes={showPomAltitudes}
        showPomTooltips={showPomTooltips}
        highlightCorrespondingPoints={highlightCorrespondingPoints}
        showCrabArrow={showCrabArrow}
      />

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
      <CourseLayer courses={courses} />

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
      {targetEditTarget && <TargetEditLayer edit={targetEditTarget} />}

      {/* Course edit handles — center drag + rotation handle */}
      {courseEditTarget && <CourseEditLayer edit={courseEditTarget} />}

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
