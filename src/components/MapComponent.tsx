import { InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material';
import { Box } from '@mui/material';
import React from 'react';

import { MapContainer, MapControl, useMapClick } from '../map';
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
import MapNotice, { MAP_NOTICE_HEIGHT } from './MapNotice';
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
  /**
   * Why the map is showing no plan, when it is showing none on purpose. The
   * flocking solver draws nothing at all when no corridor reaches the target,
   * and an empty map is indistinguishable from a broken one.
   */
  emptyNotice?: { title: string; detail: string };
  /**
   * Pressing the map background. Fires on every background click alongside
   * whichever layer owns the gesture — used on a phone, where a press on the
   * map means "put the panel away and let me look".
   */
  onBackgroundPress?: () => void;
  /**
   * The map is sharing the screen with a panel (phone split). Corner overlays
   * shrink so they don't cover the strip of map that is left.
   */
  compactOverlays?: boolean;
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
  windTrust,
  emptyNotice,
  onBackgroundPress,
  compactOverlays = false
}: MapComponentProps) {
  const has = (layer: MapLayerId) => layers.includes(layer);
  // The corner overlays start below whatever strips are showing.
  const noticeCount =
    (windTrust && windTrust.trust.level !== 'fresh' ? 1 : 0) + (emptyNotice ? 1 : 0);
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

      {onBackgroundPress && <BackgroundPressWatcher onPress={onBackgroundPress} />}

      {(windTrust || emptyNotice) && (
        <MapControl>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1100 }}>
            {windTrust && (
              <WindTrustBanner trust={windTrust.trust} forecastTime={windTrust.forecastTime} />
            )}
            {emptyNotice && (
              <MapNotice
                icon={InfoOutlinedIcon}
                title={emptyNotice.title}
                detail={emptyNotice.detail}
              />
            )}
          </div>
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
            compact={compactOverlays}
            topOffset={10 + noticeCount * MAP_NOTICE_HEIGHT}
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

/**
 * Reports a press on the map background without taking it from the layer that
 * owns the gesture — it registers as an OBSERVER, so shift-click still moves
 * the target and a tap still dismisses the heading handle.
 *
 * It has to live inside `MapContainer` to see the interactions context, which
 * is why it is a component rather than a hook call in `MapComponent`.
 */
function BackgroundPressWatcher({ onPress }: { onPress: () => void }) {
  useMapClick(() => onPress(), { observe: true });

  return null;
}

export default React.memo(MapComponent);
