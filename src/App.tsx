/* eslint-disable new-cap */
import {
  Adjust as AdjustIcon,
  Air as AirIcon,
  Crop as CropIcon,
  FavoriteSharp as FavoriteIcon,
  Info as InfoIcon,
  RotateLeft as RotateLeftIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { Box, Divider, Stack, Typography, useMediaQuery } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { AppProvider, Navigation } from '@toolpad/core/AppProvider';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import React, { useCallback, useMemo, useState } from 'react';

import {
  AboutComponent,
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
import { SOURCE_DZ, SOURCE_MANUAL } from './forecast/forecast';
import {
  AppStateProvider,
  DEFAULT_TARGET,
  useAppState,
  useFetchForecast,
  useMapClickHandler,
  usePresets
} from './hooks';
import { Target, WindSummaryData } from './types';
import { addWind, hasTargetMovedTooFar } from './util/geo';
import { averageWind, reposition } from './util/util';
import { WindRow } from './util/wind';

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

function getTitleFromPathname(pathname: string): string {
  const segment = pathname.replace('/', '');
  const entry = NAVIGATION.find(item => 'segment' in item && item.segment === segment);

  return entry && 'title' in entry ? entry.title ?? 'Unknown' : 'Unknown';
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
    setManoeuvre,
    target,
    setTarget: setTargetBase,
    pattern,
    setPattern,
    settings,
    setSettings
  } = useAppState();

  const { winds, fetching, fetchWinds, setWinds, resetWinds } = useFetchForecast({
    target: target.target,
    settings
  });

  // Wrap setTarget to invalidate winds when target moves too far
  const setTarget = useCallback(
    (newTarget: Target) => {
      if (hasTargetMovedTooFar(target.target, newTarget.target)) {
        console.log('Moved too far, invalidating winds');
        resetWinds();
      }
      setTargetBase(newTarget);
    },
    [target.target, setTargetBase, resetWinds]
  );

  const isMobile = useMediaQuery('(max-width:600px)');
  const router = useDemoRouter('/map');

  const { handleMapClick, selectFromMap, isWaitingForClick } = useMapClickHandler({
    currentTarget: target,
    onTargetSelected: setTarget,
    onNavigateToMap: isMobile ? () => router.navigate('/map') : undefined
  });

  const {
    presets,
    activePresetId,
    createPreset,
    loadPreset,
    updatePreset,
    deletePreset
  } = usePresets({
    target,
    setTarget,
    setPattern,
    setManoeuvre
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
  const c2 = winds ? addWind(c, winds, settings.interpolateWind) : [];

  for (let i = 0; i < c.length; i++) {
    c2[i].properties.phase = c[i].properties.phase;
  }
  const averageWind_ = averageWind(c, c2);

  let windSummary: WindSummaryData | undefined;

  if (
    settings.displayWindSummary &&
    (winds.groundSource !== SOURCE_MANUAL || winds.aloftSource !== SOURCE_MANUAL) &&
    typeof averageWind_.speedKts === 'number'
  ) {
    windSummary = { average: averageWind_ };
    if (winds.groundSource !== SOURCE_MANUAL && winds.winds && winds.winds.length > 0) {
      const groundWind = winds.winds[0] as WindRow & { observed?: boolean };
      windSummary.ground = groundWind;
      if (winds.groundSource === SOURCE_DZ) {
        windSummary.ground.observed = true;
      }
    }
  }

  const handleFetchWinds = () => {
    const maxAlt = c2.length > 0 ? c2[c2.length - 1].properties.alt : undefined;
    fetchWinds(maxAlt);
  };

  if (!settings.showPreWind) {
    c = [];
  }

  function onUpwindClick() {
    if (winds?.winds && winds.winds.length > 0 && winds.winds[0].speedKts > 0 && target) {
      const newTarget: Target = {
        target: target.target,
        finalHeading: Math.round(winds.winds[0].direction % 360)
      };

      setTarget(newTarget);
    }
  }

  let p: React.ReactNode = null;

  if (router.pathname === '/manoeuvre') {
    p = (
      <ManoeuvreComponent
        setManoeuvre={setManoeuvre}
        manoeuvreToSave={c2.filter(point => point.properties.phase === 'manoeuvre')}
      />
    );
  } else if (router.pathname === '/pattern') {
    p = <PatternComponent onChange={setPattern} />;
  } else if (router.pathname === '/target') {
    p = (
      <TargetComponent
        selectFromMap={selectFromMap}
        target={target}
        setTarget={setTarget}
        onUpwindClick={onUpwindClick}
      />
    );
  } else if (router.pathname === '/wind') {
    p = (
      <WindsComponent
        winds={winds}
        setWinds={setWinds}
        fetching={fetching}
        fetch={handleFetchWinds}
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
  const map = (
    <MapComponent
      center={target.target}
      pathA={c}
      pathB={c2}
      settings={settings}
      onClick={handleMapClick}
      windDirection={averageWind_?.direction ?? 0}
      windSpeed={averageWind_?.speedKts ?? 0}
      waitingForClick={isWaitingForClick}
    />
  );
  const dashboard = (
    <DashboardLayout
      defaultSidebarCollapsed={true}
      slots={{
        toolbarActions: () => (
          <ToolbarActions
            fetching={fetching}
            onMapButtonClick={() => router.navigate('/map')}
            onRefreshWindsClick={handleFetchWinds}
            onSelectTargetClick={() => selectFromMap(false)}
            onSelectTargetAndHeadingClick={() => selectFromMap(true)}
            presets={presets}
            activePresetId={activePresetId}
            onPresetSelect={loadPreset}
            onPresetSave={handlePresetSave}
            onPresetDelete={handlePresetDelete}
          />
        ),
        sidebarFooter: SidebarFooter,
        appTitle: () => CustomAppTitle({ wind: windSummary })
      }}
    >
      <LayoutWithSidebar
        title={getTitleFromPathname(router.pathname)}
        box={sidebar}
        map={map}
      />
    </DashboardLayout>
  );

  return (
    <AppProvider router={router} theme={demoTheme} navigation={NAVIGATION}>
      {dashboard}
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
          color: '#14E02B',
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
  title: string;
}

function LayoutWithSidebar({ box, map, title }: LayoutWithSidebarProps) {
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
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight="medium" gutterBottom>
              {title}
            </Typography>
            <Divider />
          </Box>
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
