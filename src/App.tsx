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
import { hasTargetMovedTooFar } from './core/geometry';
import { COURSES } from './core/courses';
import { SOURCE_DZ, SOURCE_MANUAL } from './core/wind';

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
    target,
    setTarget: setTargetBase,
    pattern,
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
  const [targetEditOpen, setTargetEditOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const router = useToolpadRouter();
  const navigate = useNavigate();

  // Mode: ?mode=... in a shared link applies immediately (this render) and
  // is persisted below; otherwise the stored choice (or first-run) rules.
  const rawUrlMode = router.searchParams.get('mode');
  const urlModeId = migrateModeId(rawUrlMode);
  const { mode, setModeId, firstRun } = useMode(urlModeId);

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
    handleFetchWinds: fetchWindsWithMaxAlt,
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

  // Wrap setTarget to invalidate winds when target moves too far
  const setTarget = useCallback(
    (newTarget: Target) => {
      if (hasTargetMovedTooFar(target.target, newTarget.target)) {
        console.log('Moved too far, invalidating winds');
        invalidateWinds();
      }
      setTargetBase(newTarget);
    },
    [target.target, setTargetBase, invalidateWinds]
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
    setTarget,
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

  const windSummary = useMemo(
    () => makeWindSummary(averageWind_),
    [makeWindSummary, averageWind_]
  );

  // Free-mode map manipulation: exit slides along the run; the run
  // rotates/translates; the canopy flight rotates (which switches it to an
  // explicit direction).
  const handleExitDrag = useCallback((exitAlongMi: number) => {
    setFlockingParams({ ...flockingParams, exitAlongMi });
  }, [flockingParams, setFlockingParams]);
  const handleJumprunRotate = useCallback((directionDeg: number) => {
    setFlockingParams({
      ...flockingParams,
      jumprun: { ...flockingParams.jumprun, directionDeg: Math.round(directionDeg) }
    });
  }, [flockingParams, setFlockingParams]);
  const handleJumprunTranslate = useCallback((offsetMi: number) => {
    setFlockingParams({
      ...flockingParams,
      jumprun: { ...flockingParams.jumprun, offsetMi }
    });
  }, [flockingParams, setFlockingParams]);
  const handleCanopyRotate = useCallback((directionDeg: number) => {
    setFlockingParams({ ...flockingParams, canopyDirection: Math.round(directionDeg) });
  }, [flockingParams, setFlockingParams]);
  // Dragging the Spot Reference pins it at the dropped point.
  const handleReferenceDrag = useCallback((pos: LatLng) => {
    setFlockingParams({ ...flockingParams, referencePoint: pos });
  }, [flockingParams, setFlockingParams]);

  const handleFetchWinds = (overrideForecastTime?: Date | null, opts?: { force?: boolean }) => {
    // The fetch limit must reach the top of what is flown: the corrected
    // path's exit altitude, or the flocking window top.
    const maxAlt = isFlocking
      ? flockingParams.windowTopFt
      : paths.corrected.length > 0
        ? paths.corrected[paths.corrected.length - 1].properties.alt
        : undefined;

    fetchWindsWithMaxAlt(maxAlt, overrideForecastTime, opts);
  };

  function onUpwindClick() {
    if (effectiveWinds?.winds && effectiveWinds.winds.length > 0 && effectiveWinds.winds[0].speedKts > 0 && target) {
      const newTarget: Target = {
        target: target.target,
        finalHeading: Math.round(effectiveWinds.winds[0].direction % 360)
      };

      setTarget(newTarget);
    }
  }

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
    p = <PatternComponent params={patternParams} onParamsChange={setPatternParams} />;
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
        onTarget={flocking.onTarget}
        canopyDeviationWarning={flocking.canopyDeviationWarning}
        solve={flocking.solve}
        distanceUnit={modeSettings.units.distance}
        hasWind={flocking.hasWind}
        target={target.target}
      />
    );
  } else if (activePanel === 'target') {
    p = (
      <TargetComponent
        target={target}
        setTarget={setTarget}
        editOpen={targetEditOpen}
        onEditOpenChange={open => {
          setTargetEditOpen(open);
          if (open && isMobile) router.navigate(MAP_PATH);
        }}
        onUpwindClick={onUpwindClick}
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

  const targetEditTarget: TargetEditTarget | undefined = targetEditOpen
    ? {
      target: target.target,
      heading: target.finalHeading,
      onMove: (pos: LatLng) => setTarget({ ...target, target: pos }),
      onHeadingChange: (h: number) => setTarget({ ...target, finalHeading: Math.round(h) })
    }
    : undefined;

  const map = (
    <MapComponent
      center={target.target}
      cameraCenter={mapCenter}
      initialZoom={mode.defaultZoom}
      pathA={paths.ideal}
      pathB={paths.display}
      settings={modeSettings}
      layers={mode.mapLayers}
      windDirection={averageWind_?.direction ?? 0}
      windSpeed={averageWind_?.speedKts ?? 0}
      courses={enabledCourses}
      courseEditTarget={courseEditTarget}
      targetEditTarget={targetEditTarget}
      observedStations={forecastTime === null ? stations : []}
      groundWindStation={forecastTime === null && effectiveWinds.groundSource === SOURCE_DZ ? nearestStation ?? undefined : undefined}
      forecastGroundWind={effectiveWinds.groundSource !== SOURCE_DZ && effectiveWinds.aloftSource !== SOURCE_MANUAL && effectiveWinds.winds.length > 0
        ? { direction: effectiveWinds.winds[0].direction, speedKts: effectiveWinds.winds[0].speedKts }
        : undefined}
      forecastValidTime={effectiveWinds.validTime}
      finalHeading={target.finalHeading}
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
        jumprunLine: flocking.jumprunLine,
        end: flocking.end,
        missMi: flocking.missMi,
        onTarget: flocking.onTarget,
        onExitDrag: flockingParams.mode === 'free' ? handleExitDrag : undefined,
        onJumprunRotate: flockingParams.mode === 'free' ? handleJumprunRotate : undefined,
        onJumprunTranslate: flockingParams.mode === 'free' ? handleJumprunTranslate : undefined,
        onCanopyRotate: flockingParams.mode === 'free' ? handleCanopyRotate : undefined,
        corridorOutlines: flocking.corridorOutlines,
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
            targetEditOpen={targetEditOpen}
            onTargetEditToggle={() => {
              const next = !targetEditOpen;
              setTargetEditOpen(next);
              if (next && isMobile) router.navigate(MAP_PATH);
            }}
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
          <CustomAppTitle wind={windSummary} forecastTime={windSummary?.forecastTime} />
        )
      }}
    >
      <LayoutWithSidebar box={sidebar} map={map} />
    </DashboardLayout>
  );

  const bottomNavPanels = mode.nav.filter(id => !SECONDARY_PANELS.includes(id));
  const bottomNavValue = activePanel ? bottomNavPanels.indexOf(activePanel) : -1;

  const activePresetName = presets.find(p => p.id === activePresetId)?.name ?? 'unnamed';

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

function CustomAppTitle({ wind, forecastTime }: { wind?: WindSummaryData; forecastTime?: Date }) {
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
          forecastTime={forecastTime}
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
