import React from 'react';

import { MapContainer, MapControl } from '../map';
import {
  CourseEditLayer,
  CourseEditTarget,
  CourseLayer,
  FlightPathsLayer,
  MeasureLayer,
  StationsLayer,
  TargetEditLayer,
  TargetEditTarget
} from '../map/layers';
import { Course, FlightPath, LatLng, ObservedWindStation, Settings } from '../types';

import WindDirectionArrow from './WindDirectionArrow';

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

/**
 * The map: a thin composition of the map container and feature layers.
 * All map behavior lives in src/map (adapter primitives + layers).
 */
function MapComponent({
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
  const {
    showPoms,
    showPomAltitudes,
    showPomTooltips,
    showPreWind,
    displayWindArrow,
    highlightCorrespondingPoints,
    showMeasureTool,
    showCrabArrow
  } = settings;

  return (
    <MapContainer center={center}>
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

      <CourseLayer courses={courses} />

      <MeasureLayer enabled={showMeasureTool} />

      <StationsLayer
        stations={observedStations}
        center={center}
        finalHeading={finalHeading}
        groundWindStation={groundWindStation}
        forecastGroundWind={forecastGroundWind}
        forecastValidTime={forecastValidTime}
      />

      {targetEditTarget && <TargetEditLayer edit={targetEditTarget} />}

      {courseEditTarget && <CourseEditLayer edit={courseEditTarget} />}

      {displayWindArrow && (
        <MapControl>
          <WindDirectionArrow direction={windDirection} speed={windSpeed} />
        </MapControl>
      )}
    </MapContainer>
  );
}

export default React.memo(MapComponent);
