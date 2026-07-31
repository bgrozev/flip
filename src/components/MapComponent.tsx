import { Box } from '@mui/material';
import React from 'react';

import { MapContainer, MapControl } from '../map';
import {
  CourseEditLayer,
  CourseEditTarget,
  CourseLayer,
  FlightPathsLayer,
  FlockingLayer,
  FlockingLayerProps,
  ManoeuvreEditLayer,
  ManoeuvreEditTarget,
  ManoeuvreHintLayer,
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
import ShortcutHint from './ShortcutHint';
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
  /** Point hover tooltips exist at all (nerd mode's `pointTooltips`). */
  pointTooltips?: boolean;
  courses?: Course[];
  courseEditTarget?: CourseEditTarget;
  targetEditTarget?: TargetEditTarget;
  /** Drag handle for the turn's initiation point (parametric turns only). */
  manoeuvreEditTarget?: ManoeuvreEditTarget;
  observedStations?: ObservedWindStation[];
  /** Flocking layer data (only provided in flocking mode). */
  flocking?: Omit<FlockingLayerProps, 'showPreWind' | 'showPoms' | 'showPomAltitudes'>;
  /** Which layers may render (from the active mode); defaults to all. */
  layers?: readonly MapLayerId[];
  /** Wind-trust verdict for the top-of-map status banner (hidden when fresh). */
  windTrust?: { trust: WindTrust; forecastTime?: Date };
  /** Compact winds indicator overlay data (gated by settings.displayMapWinds). */
  /** One-time "press ? for shortcuts" nudge; omitted where it makes no sense. */
  shortcutHint?: {
    show: boolean;
    onOpen: () => void;
  };
  mapWinds?: {
    winds: WindProfile;
    altitudesFt: number[];
    interpolate: boolean;
    forecastTime?: Date;
    onOpen: () => void;
    onRefresh: () => void;
    fetching: boolean;
    /** Nearest observed station injected as ground wind (hover detail). */
    groundStation?: ObservedWindStation;
    /** Forecast ground wind, when no observed station is in use (hover detail). */
    forecastGround?: { direction: number; speedKts: number; validTime?: Date };
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
  pointTooltips = false,
  courses = [],
  courseEditTarget,
  targetEditTarget,
  manoeuvreEditTarget,
  observedStations = [],
  flocking,
  layers = MAP_LAYER_IDS,
  mapWinds,
  shortcutHint,
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
    <MapContainer
      center={cameraCenter ?? center}
      initialZoom={initialZoom}
      provider={settings.mapProvider}
      showLabels={settings.showMapLabels}
    >
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
          enableTooltips={pointTooltips}
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

      {has('manoeuvreHint') && (settings.showManoeuvreHint || settings.showFinalApproachLine) && (
        <ManoeuvreHintLayer
          path={pathB}
          idealPath={pathA}
          showTurnHint={settings.showManoeuvreHint}
          showFinalApproachLine={settings.showFinalApproachLine}
        />
      )}

      {has('manoeuvreEdit') && manoeuvreEditTarget && (
        <ManoeuvreEditLayer edit={manoeuvreEditTarget} />
      )}

      {has('courses') && <CourseLayer courses={courses} />}

      {has('stations') && <StationsLayer stations={observedStations} />}

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
            groundStation={mapWinds.groundStation}
            forecastGround={mapWinds.forecastGround}
            topOffset={windTrust && windTrust.trust.level !== 'fresh' ? 46 : 10}
          />
        </MapControl>
      )}

      {shortcutHint && (
        <MapControl>
          <Box sx={{ position: 'absolute', bottom: 28, left: 10, pointerEvents: 'auto' }}>
            <ShortcutHint show={shortcutHint.show} onOpenShortcuts={shortcutHint.onOpen} />
          </Box>
        </MapControl>
      )}
    </MapContainer>
  );
}

export default React.memo(MapComponent);
