/* eslint-disable new-cap */
import {
  Adjust as AdjustIcon,
  Air as AirIcon,
  Crop as CropIcon,
  FavoriteSharp as FavoriteIcon,
  Flag as FlagIcon,
  Groups as GroupsIcon,
  Info as InfoIcon,
  RotateLeft as RotateLeftIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Divider,
  Paper,
  Stack,
  Typography,
  useMediaQuery
} from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { AppProvider, Navigation, Router } from '@toolpad/core/AppProvider';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';

import {
  MAP_PATH,
  isMapPathname,
  isPathnameAllowed,
  panelFromPathname,
  panelPath
} from './app/routing';
import { applyModeDefaults, hasFeature, migrateModeId } from './modes';

import {
  AboutComponent,
  CoursesComponent,
  ExportDialog,
  FlipIcon,
  FlockingComponent,
  ManoeuvreComponent,
  MapComponent,
  ModePicker,
  PatternComponent,
  SettingsComponent,
  TargetComponent,
  ToolbarActions,
  WindSummary,
  WindsComponent
} from './components';
import { CourseEditTarget, TargetEditTarget } from './map/layers';
import {
  AppStateProvider,
  DEFAULT_TARGET,
  useAppState,
  useCustomCourses,
  NotificationsProvider,
  useFlightPaths,
  useFlockingPath,
  useMode,
  usePresets,
  useWinds
} from './hooks';
import { Course, LatLng, PanelId, Target, WindSummaryData } from './types';
import { destinationPoint, hasTargetMovedTooFar, WIND_INVALIDATE_THRESHOLD_FT } from './core/geometry';
import {
  exitForFixedEnd,
  jumprunFromExit,
  localMilesEN,
  vectorCardinalDirection
} from './core/flocking';
import { COURSES } from './core/courses';
import { makePatternByType, withFullPattern } from './core/pattern';
import { SOURCE_DZ, SOURCE_MANUAL, windBandAltitudesFt } from './core/wind';
import { windTrust } from './core/windTrust';

const PANEL_NAV: Record<PanelId, { title: string; icon: React.ReactElement }> = {
  pattern: { title: 'Pattern', icon: <CropIcon /> },
  manoeuvre: { title: 'Manoeuvre', icon: <RotateLeftIcon /> },
  target: { title: 'Target', icon: <AdjustIcon /> },
  wind: { title: 'Wind', icon: <AirIcon /> },
  courses: { title: 'Courses', icon: <FlagIcon /> },
  flocking: { title: 'Flocking', icon: <GroupsIcon /> },
  settings: { title: 'Settings', icon: <SettingsIcon /> },
  about: { title: 'About', icon: <InfoIcon /> }
};

/** App-level panels shown after a divider, at the bottom of the sidebar. */
const SECONDARY_PANELS: readonly PanelId[] = ['settings', 'about'];

/** Sidebar navigation for a mode: its panels, divider before the app-level ones. */
function buildNavigation(nav: readonly PanelId[]): Navigation {
  const item = (id: PanelId) => ({ segment: id, ...PANEL_NAV[id] });
  const primary = nav.filter(id => !SECONDARY_PANELS.includes(id));
  const secondary = nav.filter(id => SECONDARY_PANELS.includes(id));

  return [
    ...primary.map(item),
    ...primary.length > 0 && secondary.length > 0 ? [{ kind: 'divider' as const }] : [],
    ...secondary.map(item)
  ];
}

const demoTheme = createTheme({
  colorSchemes: { light: true, dark: true },
  cssVariables: {
    colorSchemeSelector: 'class'
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 600,
      lg: 1200,
      xl: 1536
    }
  }
});

/**
 * Adapts react-router to Toolpad's AppProvider router interface, preserving
 * one deliberate UX quirk: navigating to the already-open panel closes it
 * (routes back to the map). Mobile relies on this as the panel-close toggle.
 */
function useToolpadRouter(): Router {
  const location = useLocation();
  const navigate = useNavigate();

  return useMemo(() => ({
    pathname: location.pathname,
    searchParams: new URLSearchParams(location.search),
    navigate: (path: string | URL) => {
      const target = path instanceof URL ? path.pathname + path.search : String(path);

      navigate(target === location.pathname ? MAP_PATH : target);
    }
  }), [location.pathname, location.search, navigate]);
}

export default function App() {
  return (
    <BrowserRouter>
      <AppStateProvider>
        <NotificationsProvider>
          <DashboardContent />
        </NotificationsProvider>
      </AppStateProvider>
    </BrowserRouter>
  );
}

function DashboardContent() {
  const {
    manoeuvre,
    manoeuvreConfig,
    setManoeuvreConfig,
    targetForMode,
    setTargetForMode,
    setTargetEverywhere,
    patternParams,
    setPatternParams,
    flockingParams,
    setFlockingParams,
    settings,
    setSettings,
    touchedSettings,
    selectedCourseId,
    setSelectedCourseId
  } = useAppState();

  const [courseEditOpen, setCourseEditOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const router = useToolpadRouter();
  const navigate = useNavigate();

  // Mode: ?mode=... in a shared link applies immediately (this render) and
  // is persisted below; otherwise the stored choice (or first-run) rules.
  const rawUrlMode = router.searchParams.get('mode');
  const urlModeId = migrateModeId(rawUrlMode);
  const { mode, setModeId, firstRun } = useMode(urlModeId);

  // Each mode plans against its own target; modes with none yet share the
  // legacy one, so existing setups carry over on first switch.
  const target = targetForMode(mode.id);

  // Persist the link's mode, then strip the param to keep the URL canonical
  useEffect(() => {
    if (rawUrlMode !== null) {
      if (urlModeId) {
        setModeId(urlModeId);
      }
      navigate(router.pathname, { replace: true });
    }
  }, [rawUrlMode, urlModeId, router.pathname, navigate, setModeId]);

  // Route guard: panels outside the current mode, unknown paths and the
  // legacy /map alias all redirect to the map
  useEffect(() => {
    if (!isPathnameAllowed(router.pathname, mode.nav) ||
        (isMapPathname(router.pathname) && router.pathname !== MAP_PATH)) {
      navigate(MAP_PATH, { replace: true });
    }
  }, [router.pathname, mode, navigate]);

  // Effective settings: mode defaults fill in the settings the user never
  // touched; the Settings panel still edits the stored values.
  const modeSettings = useMemo(
    () => applyModeDefaults(settings, mode, touchedSettings),
    [settings, mode, touchedSettings]
  );

  const {
    effectiveWinds,
    fetching,
    setWinds,
    invalidateWinds,
    forecastTime,
    onForecastTimeChange,
    handleFetchWinds: fetchWinds,
    stations,
    nearestStation,
    stationsFetched,
    fetchingObserved,
    scrubHours,
    makeWindSummary
  } = useWinds({
    target: target.target,
    settings: modeSettings
  });

  // Wrap setTarget to invalidate winds when the target moves too far.
  // Each mode plans against its own target (see useAppState).
  const setTarget = useCallback(
    (newTarget: Target) => {
      if (
        hasTargetMovedTooFar(
          target.target,
          newTarget.target,
          WIND_INVALIDATE_THRESHOLD_FT
        )
      ) {
        invalidateWinds();
      }
      setTargetForMode(mode.id, newTarget);
    },
    [target.target, setTargetForMode, mode.id, invalidateWinds]
  );

  // Choosing a place (the picker, "nearest dropzone", loading a preset) is
  // not a per-mode edit: the dropzone you are at is the same whatever you
  // are planning, and having it change under you when switching modes is
  // just confusing. Positioning WITHIN the place — dragging the target,
  // shift-clicking, the heading input — stays per-mode.
  const selectPlace = useCallback(
    (newTarget: Target) => {
      if (
        hasTargetMovedTooFar(
          target.target,
          newTarget.target,
          WIND_INVALIDATE_THRESHOLD_FT
        )
      ) {
        invalidateWinds();
      }
      setTargetEverywhere(newTarget);
    },
    [target.target, setTargetEverywhere, invalidateWinds]
  );

  const isMobile = useMediaQuery('(max-width:600px)');

  const {
    presets,
    activePresetId,
    createPreset,
    loadPreset,
    updatePreset,
    deletePreset,
    renamePreset
  } = usePresets({
    target,
    patternParams,
    manoeuvreConfig,
    selectedCourseId,
    applyTarget: selectPlace,
    setPatternParams,
    setManoeuvreConfig,
    setSelectedCourseId
  });

  const handlePresetSave = (name?: string) => {
    if (name) {
      createPreset(name);
    } else if (activePresetId) {
      updatePreset(activePresetId);
    }
  };

  const handlePresetDelete = () => {
    if (activePresetId) {
      deletePreset(activePresetId);
    }
  };

  // Flocking mode replaces the pattern/manoeuvre derivation with its own
  // descent-path pipeline; each derivation only runs in its own mode.
  const isFlocking = mode.id === 'flocking';

  // Modes without the leg-count control always fly the full pattern. The
  // override is applied on READ, never written back: a swooper's stored
  // NONE/1/2 choice must survive a trip through Standard Pattern.
  const patternParamsForMode = useMemo(
    () => (hasFeature(mode, 'patternLegCount') ? patternParams : withFullPattern(patternParams)),
    [mode, patternParams]
  );
  const pattern = useMemo(
    () => makePatternByType(patternParamsForMode),
    [patternParamsForMode]
  );

  const paths = useFlightPaths({
    manoeuvre: !isFlocking && hasFeature(mode, 'manoeuvre') ? manoeuvre ?? [] : [],
    pattern: !isFlocking ? pattern ?? [] : [],
    target: target ?? DEFAULT_TARGET,
    winds: effectiveWinds,
    correctPatternHeading: modeSettings.correctPatternHeading,
    interpolateWind: modeSettings.interpolateWind,
    straightenLegsEnabled: modeSettings.straightenLegs
  });

  const flocking = useFlockingPath({
    active: isFlocking,
    params: flockingParams,
    target: target ?? DEFAULT_TARGET,
    winds: effectiveWinds,
    interpolateWind: modeSettings.interpolateWind,
    altitudeUnit: modeSettings.units.altitude
  });

  const averageWind_ = isFlocking ? flocking.averageWind : paths.averageWind;

  // Altitude bands for the map winds indicator: 5k ft for pattern, 15k for
  // flocking (extended to the jump's top if higher). Ground is added by the
  // component; the full profile (to ~41k) still shows in the Wind panel.
  const keyWindAltitudesFt = useMemo(() => {
    const ceilingFt = isFlocking ? Math.max(15000, flockingParams.windowTopFt) : 5000;
    return windBandAltitudesFt(ceilingFt);
  }, [isFlocking, flockingParams.windowTopFt]);

  const windSummary = useMemo(
    () => makeWindSummary(averageWind_),
    [makeWindSummary, averageWind_]
  );

  // Single wind-trust verdict for the top-of-map status banner (all modes).
  const trust = useMemo(
    () => windTrust(effectiveWinds, forecastTime, new Date()),
    [effectiveWinds, forecastTime]
  );

  // Free-mode map manipulation. Move: drag the exit anywhere — decompose
  // its position (relative to the reference, in the current run frame) into
  // offset + along, so the whole run follows in 2D. Rotate: set the run
  // direction, holding the exit fixed by re-deriving offset + along for it.
  // Canopy: rotate the canopy flight (switches it to an explicit direction).
  const handleJumprunMove = useCallback((exit: LatLng) => {
    const { offsetMi, exitAlongMi } = jumprunFromExit(
      flocking.reference, flocking.jumprunDeg, exit
    );

    setFlockingParams({
      ...flockingParams,
      jumprun: { ...flockingParams.jumprun, offsetMi },
      exitAlongMi
    });
  }, [flockingParams, setFlockingParams, flocking.reference, flocking.jumprunDeg]);
  const handleJumprunRotate = useCallback((directionDeg: number) => {
    const dir = Math.round(directionDeg);

    if (flocking.exit) {
      const { offsetMi, exitAlongMi } = jumprunFromExit(flocking.reference, dir, flocking.exit);

      setFlockingParams({
        ...flockingParams,
        jumprun: { ...flockingParams.jumprun, directionDeg: dir, offsetMi },
        exitAlongMi
      });
    }
  }, [flockingParams, setFlockingParams, flocking.reference, flocking.exit]);
  // Rotate the canopy flight about its FINISH point. Classic: set the run
  // direction — the unique exit re-derives so the finish stays on target.
  // Free: set the canopy direction and reposition the exit (via the jumprun
  // offset/along) so the finish holds where it is.
  const handleCanopyRotate = useCallback((directionDeg: number) => {
    const dir = Math.round(directionDeg);

    if (flockingParams.mode === 'classic') {
      setFlockingParams({ ...flockingParams, direction: dir });
      return;
    }

    if (flockingParams.mode === 'free' && flocking.exit && flocking.end && flocking.vectors) {
      // Use the flight's exact length (from the derived no-wind vector, not
      // speed×time) so the finish holds without drifting across rotations.
      const canopyLenMi = flocking.vectors.canopyFlight.lengthMi;
      const newExit = exitForFixedEnd(
        flocking.exit, flocking.end, flocking.canopyDeg, dir, canopyLenMi
      );
      const { offsetMi, exitAlongMi } = jumprunFromExit(
        flocking.reference, flocking.jumprunDeg, newExit
      );

      setFlockingParams({
        ...flockingParams,
        canopyDirection: dir,
        jumprun: { ...flockingParams.jumprun, offsetMi },
        exitAlongMi
      });
    }
  }, [
    flockingParams, setFlockingParams, flocking.exit, flocking.end,
    flocking.canopyDeg, flocking.reference, flocking.jumprunDeg, flocking.vectors
  ]);

  // End-of-CF handle (free): rotate the canopy about the exit — the exit and
  // jumprun stay put, only the canopy direction (and thus the finish) moves.
  const handleCanopyRotateAboutExit = useCallback((directionDeg: number) => {
    setFlockingParams({ ...flockingParams, canopyDirection: Math.round(directionDeg) });
  }, [flockingParams, setFlockingParams]);

  // Classic exit handle: dragging the exit translates the whole picture,
  // i.e. moves the target by the same offset (everything is target-relative).
  const handleExitTranslate = useCallback((pos: LatLng) => {
    if (!flocking.exit) {
      return;
    }
    const d = localMilesEN(flocking.exit, pos);
    const dist = Math.hypot(d.eastMi, d.northMi);
    if (dist < 1e-6) {
      return;
    }
    const moved = destinationPoint(
      target.target, vectorCardinalDirection(d.eastMi, d.northMi), dist * 1609.344
    );
    setTarget({ ...target, target: moved });
  }, [flocking.exit, target, setTarget]);
  // Dragging the Spot Reference pins it at the dropped point.
  const handleReferenceDrag = useCallback((pos: LatLng) => {
    setFlockingParams({ ...flockingParams, referencePoint: pos });
  }, [flockingParams, setFlockingParams]);

  const handleFetchWinds = (overrideForecastTime?: Date | null, opts?: { force?: boolean }) => {
    // Winds are fetched at every level (ground to ~41k ft); no altitude cap.
    fetchWinds(overrideForecastTime, opts);
  };

  // Auto-fetch the forecast on load, and again whenever the target has moved
  // far enough that the old forecast no longer describes where you are: a
  // forecast is location-specific, and moving to a new dropzone otherwise
  // left the winds cleared until the user hit refresh. On load this also
  // warms the prefetch cache that drives the time scrubber (memory-only,
  // hence empty on every reload). Skipped for user-owned manual winds, which
  // must not be clobbered.
  //
  // The ref records the location we last *attempted*, not the last success,
  // so a failing fetch can't spin: it retries only once the target moves
  // again. Small nudges stay below the threshold and keep their winds.
  const lastAutoFetchRef = useRef<LatLng | null>(null);
  useEffect(() => {
    if (!target.target || trust.level === 'manual') {
      return;
    }
    const lastFetchedFor = lastAutoFetchRef.current;

    if (
      lastFetchedFor &&
      !hasTargetMovedTooFar(lastFetchedFor, target.target, WIND_INVALIDATE_THRESHOLD_FT)
    ) {
      return;
    }
    lastAutoFetchRef.current = target.target;
    fetchWinds();
  }, [trust.level, target.target, fetchWinds]);

  // Heading that lands into wind: the ground wind's direction (it is where
  // the wind comes FROM), or null when there is no wind to land into. Drives
  // the Upwind button and stands in for a missing dropzone landing direction.
  const upwindHeading = useMemo(() => {
    const ground = effectiveWinds?.winds?.[0];

    return ground && ground.speedKts > 0
      ? Math.round(ground.direction % 360)
      : null;
  }, [effectiveWinds]);

  const rawPanel = panelFromPathname(router.pathname);
  const activePanel = rawPanel && mode.nav.includes(rawPanel) ? rawPanel : null;

  let p: React.ReactNode = null;

  if (activePanel === 'manoeuvre') {
    p = (
      <ManoeuvreComponent
        manoeuvreConfig={manoeuvreConfig}
        onConfigChange={setManoeuvreConfig}
        manoeuvreToSave={paths.corrected.filter(point => point.properties.phase === 'manoeuvre')}
      />
    );
  } else if (activePanel === 'pattern') {
    p = (
      <PatternComponent
        params={patternParamsForMode}
        onParamsChange={setPatternParams}
        legCountSelectable={hasFeature(mode, 'patternLegCount')}
      />
    );
  } else if (activePanel === 'flocking') {
    p = (
      <FlockingComponent
        params={flockingParams}
        onParamsChange={setFlockingParams}
        jumprunDeg={flocking.jumprunDeg}
        canopyDeg={flocking.canopyDeg}
        vectors={flocking.vectors}
        spot={flocking.spot}
        missMi={flocking.missMi}
        tier={flocking.tier}
        canopyDeviationDeg={flocking.canopyDeviationDeg}
        canopyDeviationWarning={flocking.canopyDeviationWarning}
        solve={flocking.solve}
        corridorSolutions={flocking.corridorSolutions}
        distanceUnit={modeSettings.units.distance}
        target={target.target}
      />
    );
  } else if (activePanel === 'target') {
    p = (
      <TargetComponent
        target={target}
        setTarget={setTarget}
        selectPlace={selectPlace}
        upwindHeading={upwindHeading}
        headingRelevant={!isFlocking}
      />
    );
  } else if (activePanel === 'wind') {
    p = (
      <WindsComponent
        winds={effectiveWinds}
        setWinds={setWinds}
        fetching={fetching}
        fetch={handleFetchWinds}
        forecastTime={forecastTime}
        onForecastTimeChange={onForecastTimeChange}
        stations={stations}
        stationsFetched={stationsFetched}
        fetchingObserved={fetchingObserved}
        scrubHours={scrubHours}
      />
    );
  } else if (activePanel === 'courses') {
    p = (
      <CoursesComponent
        selectedCourseId={selectedCourseId}
        onSelect={setSelectedCourseId}
        target={target}
        onTargetChange={setTarget}
        editOpen={courseEditOpen}
        onEditOpenChange={setCourseEditOpen}
        altitudeUnit={modeSettings.units.altitude}
      />
    );
  } else if (activePanel === 'about') {
    p = <AboutComponent />;
  } else if (activePanel === 'settings') {
    p = <SettingsComponent settings={settings} setSettings={setSettings} />;
  }

  let sidebar: React.ReactNode;

  if (p) {
    sidebar = (
      <Box
        sx={{
          px: 4,
          py: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'left',
          textAlign: 'center'
        }}
      >
        {p}
      </Box>
    );
  }
  const { customCourses, customParams, updateCourse } = useCustomCourses();
  const allCourses: Course[] = [...customCourses, ...COURSES];
  const selectedCourse = selectedCourseId ? allCourses.find(c => c.id === selectedCourseId) : undefined;
  const enabledCourses: Course[] = hasFeature(mode, 'courses') && selectedCourse ? [selectedCourse] : [];

  // Map camera: follows the target, but jumps to a course when one is
  // selected — built-in courses are geographically anchored (e.g. Skydive
  // Arizona) and would otherwise be invisible from a distant target. This is
  // a one-time pan per change (the map providers only pan when the camera
  // center *changes*), so the user can still drag freely afterwards.
  const [mapCenter, setMapCenter] = useState<LatLng>(target.target);
  const { lat: targetLat, lng: targetLng } = target.target;

  useEffect(() => {
    setMapCenter({ lat: targetLat, lng: targetLng });
  }, [targetLat, targetLng]);

  // Pan on course selection *changes* only (not on load with a persisted
  // selection — the map should keep opening at the target). Deselecting
  // pans back to the target.
  const prevCourseIdRef = useRef(selectedCourseId);
  const courseCenter = selectedCourse?.center;

  useEffect(() => {
    if (selectedCourseId === prevCourseIdRef.current) {
      return;
    }
    prevCourseIdRef.current = selectedCourseId;
    if (courseCenter) {
      setMapCenter({ lat: courseCenter.lat, lng: courseCenter.lng });
    } else if (!selectedCourseId) {
      setMapCenter({ lat: targetLat, lng: targetLng });
    }
  }, [selectedCourseId, courseCenter, targetLat, targetLng]);

  const selectedCustomParam = customParams.find(c => c.id === selectedCourseId) ?? null;
  const courseEditTarget: CourseEditTarget | undefined =
    courseEditOpen && selectedCustomParam && activePanel === 'courses'
      ? {
        center: { lat: selectedCustomParam.lat, lng: selectedCustomParam.lng } as LatLng,
        direction: selectedCustomParam.direction,
        onMove: (newCenter: LatLng) => updateCourse(selectedCustomParam.id, { lat: newCenter.lat, lng: newCenter.lng }),
        onRotate: (newDir: number) => updateCourse(selectedCustomParam.id, { direction: newDir })
      }
      : undefined;

  // Flocking ignores the target heading, so its target is always draggable
  // and only the move handle renders; other modes keep the explicit
  // "Edit on Map" toggle with the heading handle.
  // The target is always draggable, in every mode. Flocking hides the
  // final-heading rotate handle (it has its own jumprun/canopy controls).
  const targetEditTarget: TargetEditTarget = {
    target: target.target,
    heading: target.finalHeading,
    onMove: (pos: LatLng) => setTarget({ ...target, target: pos }),
    onHeadingChange: (h: number) => setTarget({ ...target, finalHeading: Math.round(h) }),
    headingEditable: !isFlocking
  };

  const map = (
    <MapComponent
      center={target.target}
      cameraCenter={mapCenter}
      initialZoom={mode.defaultZoom}
      pathA={paths.ideal}
      pathB={paths.display}
      settings={modeSettings}
      layers={mode.mapLayers}
      mapWinds={{
        winds: effectiveWinds,
        altitudesFt: keyWindAltitudesFt,
        interpolate: modeSettings.interpolateWind,
        forecastTime: effectiveWinds.validTime,
        onOpen: () => navigate('/wind'),
        onRefresh: () => handleFetchWinds(undefined, { force: true }),
        fetching,
        groundStation: forecastTime === null && effectiveWinds.groundSource === SOURCE_DZ
          ? nearestStation ?? undefined
          : undefined,
        forecastGround: effectiveWinds.groundSource !== SOURCE_DZ && effectiveWinds.aloftSource !== SOURCE_MANUAL && effectiveWinds.winds.length > 0
          ? {
            direction: effectiveWinds.winds[0].direction,
            speedKts: effectiveWinds.winds[0].speedKts,
            validTime: effectiveWinds.validTime
          }
          : undefined
      }}
      windTrust={{ trust, forecastTime: forecastTime ?? effectiveWinds.validTime }}
      courses={enabledCourses}
      courseEditTarget={courseEditTarget}
      targetEditTarget={targetEditTarget}
      observedStations={forecastTime === null ? stations : []}
      flocking={isFlocking ? {
        ideal: flocking.ideal,
        corrected: flocking.corrected,
        exit: flocking.exit,
        jumprunDeg: flocking.jumprunDeg,
        spot: flocking.spot,
        distanceUnit: modeSettings.units.distance,
        winds: effectiveWinds,
        reference: flocking.reference,
        onReferenceDrag: handleReferenceDrag,
        target: target.target,
        targetRadiusMi: flockingParams.targetRadiusMi,
        yellowRadiusMi: flockingParams.yellowRadiusMi,
        jumprunLine: flocking.jumprunLine,
        end: flocking.end,
        missMi: flocking.missMi,
        onTarget: flocking.onTarget,
        tier: flocking.tier,
        canopyDeviationDeg: flocking.canopyDeviationDeg,
        canopyDeviationWarning: flocking.canopyDeviationWarning,
        onJumprunMove: flockingParams.mode === 'free' ? handleJumprunMove : undefined,
        onJumprunRotate: flockingParams.mode === 'free' ? handleJumprunRotate : undefined,
        onCanopyRotate: flockingParams.mode === 'solve' ? undefined : handleCanopyRotate,
        onCanopyRotateAboutExit: flockingParams.mode === 'free' ? handleCanopyRotateAboutExit : undefined,
        onExitTranslate: flockingParams.mode === 'classic' ? handleExitTranslate : undefined,
        corridorOutlines: flocking.corridorOutlines,
        corridorLabels: flocking.corridorLabels,
        showGrid: flockingParams.showGrid
      } : undefined}
    />
  );
  const dashboard = (
    <DashboardLayout
      defaultSidebarCollapsed={true}
      slots={{
        toolbarActions: () => (
          <ToolbarActions
            modeId={mode.id}
            onModeChange={setModeId}
            fetching={fetching}
            onRefreshWindsClick={() => handleFetchWinds(undefined, { force: true })}
            onExportClick={() => setExportOpen(true)}
            showPresets={modeSettings.showPresets && hasFeature(mode, 'presets')}
            presets={presets}
            activePresetId={activePresetId}
            onPresetSelect={loadPreset}
            onPresetSave={handlePresetSave}
            onPresetDelete={handlePresetDelete}
            onPresetRename={renamePreset}
          />
        ),
        sidebarFooter: SidebarFooter,
        appTitle: () => (
          <CustomAppTitle wind={windSummary} />
        )
      }}
    >
      <LayoutWithSidebar box={sidebar} map={map} />
    </DashboardLayout>
  );

  const bottomNavPanels = mode.nav.filter(id => !SECONDARY_PANELS.includes(id));
  const bottomNavValue = activePanel ? bottomNavPanels.indexOf(activePanel) : -1;

  const activePresetName = presets.find(preset => preset.id === activePresetId)?.name ?? 'unnamed';

  const navigation = useMemo(() => buildNavigation(mode.nav), [mode]);

  return (
    <AppProvider router={router} theme={demoTheme} navigation={navigation}>
      {dashboard}
      <ModePicker open={firstRun} onSelect={setModeId} />
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        path={isFlocking ? flocking.corrected : paths.display}
        target={target.target}
        presetName={activePresetName}
      />
      {isMobile && (
        <Paper
          sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200 }}
          elevation={3}
        >
          <BottomNavigation
            value={bottomNavValue === -1 ? false : bottomNavValue}
            onChange={(_e, newValue) => router.navigate(panelPath(bottomNavPanels[newValue]))}
            showLabels
          >
            {bottomNavPanels.map(id => (
              <BottomNavigationAction key={id} label={PANEL_NAV[id].title} icon={PANEL_NAV[id].icon} />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </AppProvider>
  );
}

function SidebarFooter({ mini }: { mini?: boolean }) {
  return (
    <Typography
      variant="caption"
      sx={{ m: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}
    >
      {mini ? (
        '© FliP'
      ) : (
        <>
          © {new Date().getFullYear()} FliP made with{' '}
          <FavoriteIcon sx={{ fontSize: 14 }} />
        </>
      )}
    </Typography>
  );
}

function CustomAppTitle({ wind }: { wind?: WindSummaryData }) {
  return (
    <Stack direction="row" alignItems="center" spacing={2}>
      <FlipIcon />
      <Typography
        variant="h6"
        sx={{
          fontWeight: 'bold',
          color: '#4ade80',
          textTransform: 'uppercase'
        }}
      >
        FliP
      </Typography>
      <Divider />
      {wind && wind.average && wind.ground && (
        <WindSummary
          average={{
            direction: wind.average.direction ?? 0,
            speedKts: wind.average.speedKts ?? 0
          }}
          ground={{
            direction: wind.ground.direction,
            speedKts: wind.ground.speedKts,
            observed: wind.ground.observed
          }}
        />
      )}
    </Stack>
  );
}

interface LayoutWithSidebarProps {
  box: React.ReactNode;
  map: React.ReactNode;
}

function LayoutWithSidebar({ box, map }: LayoutWithSidebarProps) {
  const isMobile = useMediaQuery('(max-width:600px)');

  // On mobile: show either the panel (full-width) or the map — not both
  if (isMobile) {
    return (
      <Box sx={{ width: '100%', height: '100%', overflow: 'auto', pb: '56px' }}>
        {box ? (
          <Box sx={{ px: 2, pt: 2 }}>
            {box}
          </Box>
        ) : (
          map
        )}
      </Box>
    );
  }

  return (
    <Stack direction="row" spacing={2} sx={{ width: '100%', height: '100%' }}>
      {box && (
        <Box
          sx={{
            width: 380,
            py: 2,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            borderRadius: 0,
            overflow: 'auto'
          }}
        >
          {box}
        </Box>
      )}

      <Box
        sx={{
          flexGrow: 1,
          position: 'relative',
          ml: '0 !important',
          overflow: 'hidden'
        }}
      >
        {map}
      </Box>
    </Stack>
  );
}
