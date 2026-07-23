/**
 * Observed-wind stations layer: a wind arrow at each discovered station's
 * geographic location, with a rich hover tooltip (`StationDetails`). The
 * ground-wind readout for the target now lives in the winds indicator's
 * hover instead of a target-anchored arrow.
 */
import React, { useCallback, useRef, useState } from 'react';

import { formatDegrees, speedGustLabel } from '../../core/units';
import { beaufortColor } from '../../core/wind';
import { useUnits } from '../../hooks';
import { ObservedWindStation } from '../../types';
import { MapOverlay } from '..';

import { DirectionArrow, SECTION_STYLE, TOOLTIP_STYLE } from './tooltip';

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

const ARROW_LABEL_STYLE: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  color: 'white',
  textShadow: '0 0 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)',
  lineHeight: 1,
  marginTop: 1,
  whiteSpace: 'nowrap'
};

/** Wind arrow glyph, rotated to point where the wind is going. */
function WindArrowGlyph({ color, rotation }: { color: string; rotation: number }) {
  return (
    <svg
      width="22"
      height="26"
      viewBox="0 0 22 26"
      style={{ transform: `rotate(${rotation}deg)`, display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}
    >
      <polygon points="11,1 19,20 11,15 3,20" fill={color} stroke="white" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The rich observed-station readout (name, provenance, wind + gusts, temp,
 * humidity, pressure, visibility, clouds). Container-agnostic so it can be
 * shown both as a map tooltip here and inside the winds indicator's hover.
 */
export function StationDetails({ station }: { station: ObservedWindStation }) {
  const { formatWindSpeed, formatTemperature, formatPressure, windSpeedLabel, altitudeLabel } = useUnits();
  const distMiles = (station.distanceFt / 5280).toFixed(1);
  const wind = formatWindSpeed(station.wind.speedKts);
  const gust = station.wind.gustKts !== undefined ? formatWindSpeed(station.wind.gustKts) : null;

  return (
    <>
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
    </>
  );
}

/** Map tooltip wrapper around StationDetails (anchored above the marker). */
function StationTooltip({ station, onMouseEnter, onMouseLeave }: {
  station: ObservedWindStation;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
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
      <StationDetails station={station} />
    </div>
  );
}

export interface StationsLayerProps {
  /** Observed wind stations to render at their geographic locations. */
  stations: ObservedWindStation[];
}

export default function StationsLayer({
  stations
}: StationsLayerProps) {
  const { formatWindSpeed, windSpeedLabel } = useUnits();
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);
  const stationLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onStationEnter = useCallback((id: string) => {
    if (stationLeaveTimer.current) clearTimeout(stationLeaveTimer.current);
    setHoveredStationId(id);
  }, []);

  const onStationLeave = useCallback(() => {
    stationLeaveTimer.current = setTimeout(() => setHoveredStationId(null), 200);
  }, []);

  return (
    <>
      {/* Observed wind stations — each at its real geographic location */}
      {stations.map(station => {
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
                <WindArrowGlyph color={color} rotation={arrowRotation} />
                <div style={ARROW_LABEL_STYLE}>
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
    </>
  );
}
