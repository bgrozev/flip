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
import { AppProvider, Navigation } from '@toolpad/core/AppProvider';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import React, { useCallback, useMemo, useState } from 'react';

import {
  AboutComponent,
  CoursesComponent,
  ExportDialog,
  FlipIcon,
  ManoeuvreComponent,
  MapComponent,
  PatternComponent,
  SettingsComponent,
  TargetComponent,
  ToolbarActions,
  WindSummary,
  WindsComponent
} from './components';
import { CourseEditTarget, TargetEditTarget } from './components/MapComponent';
import { SOURCE_DZ, SOURCE_MANUAL } from './forecast/forecast';
import {
  AppStateProvider,
  DEFAULT_TARGET,
  useAppState,
  useCustomCourses,
  useFetchForecast,
  useObservedWind,
  usePresets
} from './hooks';
import { Course, LatLng, Target, WindSummaryData } from './types';
import { addWind, hasTargetMovedTooFar } from './util/geo';
import { COURSES } from './util/courses';
import { averageWind, reposition, straightenLegs } from './util/util';
import { WindRow, Winds } from './util/wind';

const NAVIGATION: Navigation = [
  {
    segment: 'pattern',
    title: 'Pattern',
    icon: <CropIcon />
  },
  {
    segment: 'manoeuvre',
    title: 'Manoeuvre',
    icon: <RotateLeftIcon />
  },
  {
    segment: 'target',
    title: 'Target',
    icon: <AdjustIcon />
  },
  {
    segment: 'wind',
    title: 'Wind',
    icon: <AirIcon />
  },
  {
    segment: 'courses',
    title: 'Courses',
    icon: <FlagIcon />
  },
  {
    kind: 'divider'
  },
  {
    segment: 'settings',
    title: 'Settings',
    icon: <SettingsIcon />
  },
  {
    segment: 'about',
    title: 'About',
    icon: <InfoIcon />
  }
];

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

interface Router {
  pathname: string;
  searchParams: URLSearchParams;
  navigate: (path: string | URL) => void;
}

function useDemoRouter(initialPath: string): Router {
  const [pathname, setPathname] = useState(initialPath);

  const navigate = useCallback(
    (path: string | URL) => {
      const normalizedPath = String(path);

      if (normalizedPath === pathname) {
        setPathname('/map'); // Route to map instead

        return;
      }

      setPathname(normalizedPath);
    },
    [pathname]
  );

  return useMemo(() => {
    return {
      pathname,
      searchParams: new URLSearchParams(),
      navigate
    };
  }, [pathname, navigate]);
}


export default function DashboardLayoutBasic() {
  return (
    <AppStateProvider>
      <DashboardContent />
    </AppStateProvider>
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

  const { winds, fetching, fetchWinds, setWinds, resetWinds } = useFetchForecast({
    target: target.target,
    settings
  });

  const { stations, nearestStation, stationsFetched, fetchingObserved, fetchObserved, resetObserved } = useObservedWind();

  // Inject nearest observed station as ground wind (when enabled and forecast has been fetched)
  const effectiveWinds = useMemo(() => {
    if (!settings.useDzGroundWind || !nearestStation || winds.aloftSource === SOURCE_MANUAL) {
      return winds;
    }
    const cloned = Winds.copy(winds);
    cloned.setGroundWind(new WindRow(0, nearestStation.wind.direction, nearestStation.wind.speedKts));
    cloned.groundSource = SOURCE_DZ;
    return cloned;
  }, [winds, nearestStation, settings.useDzGroundWind]);

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
  const router = useDemoRouter('/map');

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

  let c = reposition(manoeuvre ?? [], pattern ?? [], target ?? DEFAULT_TARGET, settings.correctPatternHeading);
  const c2 = effectiveWinds ? addWind(c, effectiveWinds, settings.interpolateWind) : [];

  for (let i = 0; i < c.length; i++) {
    c2[i].properties.phase = c[i].properties.phase;
  }
  const c2Display = settings.straightenLegs ? straightenLegs(c2) : c2;
  const averageWind_ = averageWind(c, c2);

  let windSummary: WindSummaryData | undefined;

  if (
    settings.displayWindSummary &&
    (effectiveWinds.groundSource !== SOURCE_MANUAL || effectiveWinds.aloftSource !== SOURCE_MANUAL) &&
    typeof averageWind_.speedKts === 'number'
  ) {
    windSummary = { average: averageWind_ };
    if (effectiveWinds.groundSource !== SOURCE_MANUAL && effectiveWinds.winds && effectiveWinds.winds.length > 0) {
      const groundWind = effectiveWinds.winds[0] as WindRow & { observed?: boolean };
      windSummary.ground = groundWind;
      if (effectiveWinds.groundSource === SOURCE_DZ) {
        windSummary.ground.observed = true;
      }
    }
    if (effectiveWinds.validTime) {
      windSummary.forecastTime = effectiveWinds.validTime;
    }
  }

  const handleFetchWinds = (overrideForecastTime?: Date | null) => {
    const maxAlt = c2.length > 0 ? c2[c2.length - 1].properties.alt : undefined;
    const ft = overrideForecastTime !== undefined ? overrideForecastTime : forecastTime;
    fetchWinds(maxAlt, ft);
    if (settings.useDzGroundWind && target && ft === null) {
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

  let p: React.ReactNode = null;

  if (router.pathname === '/manoeuvre') {
    p = (
      <ManoeuvreComponent
        manoeuvreConfig={manoeuvreConfig}
        onConfigChange={setManoeuvreConfig}
        manoeuvreToSave={c2.filter(point => point.properties.phase === 'manoeuvre')}
      />
    );
  } else if (router.pathname === '/pattern') {
    p = <PatternComponent params={patternParams} onParamsChange={setPatternParams} />;
  } else if (router.pathname === '/target') {
    p = (
      <TargetComponent
        target={target}
        setTarget={setTarget}
        editOpen={targetEditOpen}
        onEditOpenChange={open => {
          setTargetEditOpen(open);
          if (open && isMobile) router.navigate('/map');
        }}
        onUpwindClick={onUpwindClick}
      />
    );
  } else if (router.pathname === '/wind') {
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
  } else if (router.pathname === '/courses') {
    p = (
      <CoursesComponent
        selectedCourseId={selectedCourseId}
        onSelect={setSelectedCourseId}
        target={target}
        onTargetChange={setTarget}
        editOpen={courseEditOpen}
        onEditOpenChange={setCourseEditOpen}
      />
    );
  } else if (router.pathname === '/about') {
    p = <AboutComponent />;
  } else if (router.pathname === '/settings') {
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
  const enabledCourses: Course[] = selectedCourse ? [selectedCourse] : [];

  const selectedCustomParam = customParams.find(c => c.id === selectedCourseId) ?? null;
  const courseEditTarget: CourseEditTarget | undefined =
    courseEditOpen && selectedCustomParam && router.pathname === '/courses'
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
      pathA={c}
      pathB={c2Display}
      settings={settings}
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
            fetching={fetching}
            onRefreshWindsClick={handleFetchWinds}
            onExportClick={() => setExportOpen(true)}
            targetEditOpen={targetEditOpen}
            onTargetEditToggle={() => {
              const next = !targetEditOpen;
              setTargetEditOpen(next);
              if (next && isMobile) router.navigate('/map');
            }}
            showPresets={settings.showPresets}
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

  const BOTTOM_NAV_PATHS = ['/pattern', '/manoeuvre', '/target', '/wind', '/courses'];
  const bottomNavValue = BOTTOM_NAV_PATHS.indexOf(router.pathname);

  const activePresetName = presets.find(p => p.id === activePresetId)?.name ?? 'unnamed';

  return (
    <AppProvider router={router} theme={demoTheme} navigation={NAVIGATION}>
      {dashboard}
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        path={c2Display}
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
            onChange={(_e, newValue) => router.navigate(BOTTOM_NAV_PATHS[newValue])}
            showLabels
          >
            <BottomNavigationAction label="Pattern" icon={<CropIcon />} />
            <BottomNavigationAction label="Manoeuvre" icon={<RotateLeftIcon />} />
            <BottomNavigationAction label="Target" icon={<AdjustIcon />} />
            <BottomNavigationAction label="Wind" icon={<AirIcon />} />
            <BottomNavigationAction label="Courses" icon={<FlagIcon />} />
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
