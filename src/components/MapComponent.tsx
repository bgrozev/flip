import React from 'react';

import { MapContainer, MapControl } from '../map';
import {
  CourseEditLayer,
  CourseEditTarget,
  CourseLayer,
  FlightPathsLayer,
  FlockingLayer,
  FlockingLayerProps,
  StationsLayer,
  TargetEditLayer,
  TargetEditTarget
} from '../map/layers';
import { WindProfile } from '../core/wind';
import { WindTrust } from '../core/windTrust';
import {
  Course,
  FlightPath,
  LatLng,
  MAP_LAYER_IDS,
  MapLayerId,
  ObservedWindStation,
  Settings
} from '../types';

import WindMiniIndicator from './WindMiniIndicator';
import WindTrustBanner from './WindTrustBanner';

interface MapComponentProps {
  /** Reference location (the target): anchors the stations/ground-wind layer. */
  center: LatLng;
  /**
   * Camera center for the map view; the map pans when it changes. Defaults to
   * `center`. Kept separate so e.g. "jump to course" can move the camera
   * without re-anchoring target-relative overlays.
   */
  cameraCenter?: LatLng;
  /** Initial/mode-default zoom; re-applied when it changes (mode switch). */
  initialZoom?: number;
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
  /** Flocking layer data (only provided in flocking mode). */
  flocking?: Omit<FlockingLayerProps, 'showPreWind' | 'showPoms' | 'showPomAltitudes'>;
  /** Which layers may render (from the active mode); defaults to all. */
  layers?: readonly MapLayerId[];
  /** Wind-trust verdict for the top-of-map status banner (hidden when fresh). */
  windTrust?: { trust: WindTrust; forecastTime?: Date };
  /** Compact winds indicator overlay data (gated by settings.displayMapWinds). */
  mapWinds?: {
    winds: WindProfile;
    altitudesFt: number[];
    interpolate: boolean;
    forecastTime?: Date;
    onOpen: () => void;
    onRefresh: () => void;
    fetching: boolean;
  };
}

/**
 * The map: a thin composition of the map container and feature layers.
 * All map behavior lives in src/map (adapter primitives + layers).
 */
function MapComponent({
  center,
  cameraCenter,
  initialZoom,
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
  flocking,
  layers = MAP_LAYER_IDS,
  mapWinds,
  windTrust
}: MapComponentProps) {
  const has = (layer: MapLayerId) => layers.includes(layer);
  const {
    showPoms,
    showPomAltitudes,
    showPomTooltips,
    showPreWind,
    highlightCorrespondingPoints,
    showCrabArrow
  } = settings;

  return (
    <MapContainer center={cameraCenter ?? center} initialZoom={initialZoom} provider={settings.mapProvider}>
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

      {has('flocking') && flocking && (
        <FlockingLayer
          {...flocking}
          showPreWind={showPreWind}
          showPoms={showPoms}
          showPomAltitudes={showPomAltitudes}
        />
      )}

      {has('courses') && <CourseLayer courses={courses} />}

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

      {windTrust && (
        <MapControl>
          <WindTrustBanner trust={windTrust.trust} forecastTime={windTrust.forecastTime} />
        </MapControl>
      )}

      {settings.displayMapWinds && mapWinds && (
        <MapControl>
          <WindMiniIndicator
            winds={mapWinds.winds}
            altitudesFt={mapWinds.altitudesFt}
            interpolate={mapWinds.interpolate}
            forecastTime={mapWinds.forecastTime}
            onOpen={mapWinds.onOpen}
            onRefresh={mapWinds.onRefresh}
            fetching={mapWinds.fetching}
            topOffset={windTrust && windTrust.trust.level !== 'fresh' ? 46 : 10}
          />
        </MapControl>
      )}
    </MapContainer>
  );
}

export default React.memo(MapComponent);
