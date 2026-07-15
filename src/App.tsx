/* eslint-disable new-cap */
import {
  Adjust as AdjustIcon,
  Air as AirIcon,
  Crop as CropIcon,
  FavoriteSharp as FavoriteIcon,
  Flag as FlagIcon,
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SOURCE_DZ, SOURCE_MANUAL } from './forecast/forecast';
import {
  AppStateProvider,
  DEFAULT_TARGET,
  useAppState,
  useCustomCourses,
  useFetchForecast,
  useFlightPaths,
  useMode,
  useObservedWind,
  usePresets
} from './hooks';
import { Course, LatLng, PanelId, Target, WindSummaryData } from './types';
import { hasTargetMovedTooFar } from './core/geometry';
import { COURSES } from './util/courses';
import { WindRow, composeWinds, createWindRow } from './core/wind';

const PANEL_NAV: Record<PanelId, { title: string; icon: React.ReactElement }> = {
  pattern: { title: 'Pattern', icon: <CropIcon /> },
  manoeuvre: { title: 'Manoeuvre', icon: <RotateLeftIcon /> },
  target: { title: 'Target', icon: <AdjustIcon /> },
  wind: { title: 'Wind', icon: <AirIcon /> },
  courses: { title: 'Courses', icon: <FlagIcon /> },
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
        <DashboardContent />
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
    settings,
    setSettings,
    selectedCourseId,
    setSelectedCourseId
  } = useAppState();

  const [forecastTime, setForecastTime] = useState<Date | null>(null);
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

  // Effective settings: mode defaults fill in where the user is at the
  // global default; the Settings panel still edits the stored values.
  const modeSettings = useMemo(() => applyModeDefaults(settings, mode), [settings, mode]);

  const { winds, fetching, fetchWinds, setWinds, resetWinds } = useFetchForecast({
    target: target.target,
    settings: modeSettings
  });

  const { stations, nearestStation, stationsFetched, fetchingObserved, fetchObserved, resetObserved } = useObservedWind();

  // Inject nearest observed station as ground wind (when enabled and forecast has been fetched)
  const effectiveWinds = useMemo(() => {
    if (!modeSettings.useDzGroundWind || !nearestStation || winds.aloftSource === SOURCE_MANUAL) {
      return winds;
    }
    return composeWinds(
      winds,
      createWindRow(0, nearestStation.wind.direction, nearestStation.wind.speedKts)
    );
  }, [winds, nearestStation, modeSettings.useDzGroundWind]);

  // Wrap setTarget to invalidate winds when target moves too far
  const setTarget = useCallback(
    (newTarget: Target) => {
      if (hasTargetMovedTooFar(target.target, newTarget.target)) {
        console.log('Moved too far, invalidating winds');
        resetWinds();
        resetObserved();
      }
      setTargetBase(newTarget);
    },
    [target.target, setTargetBase, resetWinds, resetObserved]
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

  const paths = useFlightPaths({
    manoeuvre: hasFeature(mode, 'manoeuvre') ? manoeuvre ?? [] : [],
    pattern: pattern ?? [],
    target: target ?? DEFAULT_TARGET,
    winds: effectiveWinds,
    correctPatternHeading: modeSettings.correctPatternHeading,
    interpolateWind: modeSettings.interpolateWind,
    straightenLegsEnabled: modeSettings.straightenLegs
  });
  const averageWind_ = paths.averageWind;

  let windSummary: WindSummaryData | undefined;

  if (
    modeSettings.displayWindSummary &&
    (effectiveWinds.groundSource !== SOURCE_MANUAL || effectiveWinds.aloftSource !== SOURCE_MANUAL) &&
    typeof averageWind_.speedKts === 'number'
  ) {
    windSummary = { average: averageWind_ };
    if (effectiveWinds.groundSource !== SOURCE_MANUAL && effectiveWinds.winds && effectiveWinds.winds.length > 0) {
      const groundWind: WindRow & { observed?: boolean } = { ...effectiveWinds.winds[0] };

      if (effectiveWinds.groundSource === SOURCE_DZ) {
        groundWind.observed = true;
      }
      windSummary.ground = groundWind;
    }
    if (effectiveWinds.validTime) {
      windSummary.forecastTime = effectiveWinds.validTime;
    }
  }

  const handleFetchWinds = (overrideForecastTime?: Date | null) => {
    const maxAlt = paths.corrected.length > 0
      ? paths.corrected[paths.corrected.length - 1].properties.alt
      : undefined;
    const ft = overrideForecastTime !== undefined ? overrideForecastTime : forecastTime;
    fetchWinds(maxAlt, ft);
    if (modeSettings.useDzGroundWind && target && ft === null) {
      fetchObserved(target.target);
    } else if (ft !== null) {
      resetObserved();
    }
  };

  const handleForecastTimeChange = (newTime: Date | null) => {
    setForecastTime(newTime);
    if (newTime !== null) resetObserved();
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
        onForecastTimeChange={handleForecastTimeChange}
        stations={stations}
        stationsFetched={stationsFetched}
        fetchingObserved={fetchingObserved}
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
            onRefreshWindsClick={handleFetchWinds}
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
        appTitle: () => CustomAppTitle({ wind: windSummary, forecastTime: windSummary?.forecastTime })
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
        path={paths.display}
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
