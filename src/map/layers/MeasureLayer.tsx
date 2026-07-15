/**
 * Measure tool layer: a ruler toggle button over the map, click-to-add
 * measure points with cumulative distance labels, and click-to-remove on
 * the point markers. Owns all measure state.
 */
import React, { useCallback, useMemo, useState } from 'react';

import { distanceFeet } from '../../core/geometry';
import { useUnits } from '../../hooks';
import { LatLng } from '../../types';
import { MapCircle, MapControl, MapOverlay, MapPolyline, useMapClick, useMapCursor } from '..';

import { formatDistance } from './tooltip';

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

export interface MeasureLayerProps {
  /** Whether the measure tool is available (the showMeasureTool setting). */
  enabled: boolean;
}

export default function MeasureLayer({ enabled }: MeasureLayerProps) {
  const { altitudeLabel } = useUnits();
  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<LatLng[]>([]);

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
  useMapCursor(enabled && measuring ? 'crosshair' : null);
  useMapClick(latlng => {
    setMeasurePoints(pts => [...pts, latlng]);
  }, { enabled: enabled && measuring, priority: 10 });

  if (!enabled) {
    return null;
  }

  return (
    <>
      {/* Polyline through the measure points */}
      {measuring && measurePoints.length > 1 && (
        <MapPolyline
          path={measurePoints}
          color="#2196F3"
          opacity={1}
          weight={2}
          zIndex={20}
        />
      )}

      {/* Point markers and cumulative distance labels */}
      {measuring && measurePoints.map((point, i) => (
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

      {/* Ruler toggle button */}
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
    </>
  );
}
