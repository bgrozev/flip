import React, { useMemo, useState, useCallback } from 'react';

import { useUnits } from '../hooks';
import { Course, LatLng, Settings } from '../types';
import { distanceFeet } from '../core/geometry';
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
  StationsLayer,
  TargetEditLayer,
  TargetEditTarget
} from '../map/layers';
import { formatDistance } from '../map/layers/tooltip';
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
      {/* Observed wind stations + ground-wind arrow near the target */}
      <StationsLayer
        stations={observedStations}
        center={center}
        finalHeading={finalHeading}
        groundWindStation={groundWindStation}
        forecastGroundWind={forecastGroundWind}
        forecastValidTime={forecastValidTime}
      />

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
