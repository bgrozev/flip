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
import {
  Course,
  FlightPath,
  LatLng,
  MAP_LAYER_IDS,
  MapLayerId,
  ObservedWindStation,
  Settings
} from '../types';

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
  /** Which layers may render (from the active mode); defaults to all. */
  layers?: readonly MapLayerId[];
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
  finalHeading = 0,
  layers = MAP_LAYER_IDS
}: MapComponentProps) {
  const has = (layer: MapLayerId) => layers.includes(layer);
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
    <MapContainer center={center} provider={settings.mapProvider}>
      {has('flightPaths') && (
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
      )}

      {has('courses') && <CourseLayer courses={courses} />}

      {has('measure') && <MeasureLayer enabled={showMeasureTool} />}

      {has('stations') && (
        <StationsLayer
          stations={observedStations}
          center={center}
          finalHeading={finalHeading}
          groundWindStation={groundWindStation}
          forecastGroundWind={forecastGroundWind}
          forecastValidTime={forecastValidTime}
        />
      )}

      {has('targetEdit') && targetEditTarget && <TargetEditLayer edit={targetEditTarget} />}

      {has('courseEdit') && courseEditTarget && <CourseEditLayer edit={courseEditTarget} />}

      {has('windArrow') && displayWindArrow && (
        <MapControl>
          <WindDirectionArrow direction={windDirection} speed={windSpeed} />
        </MapControl>
      )}
    </MapContainer>
  );
}

export default React.memo(MapComponent);
