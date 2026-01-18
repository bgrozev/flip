/* eslint-disable new-cap */
import * as turf from '@turf/turf';
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
import { AppProvider } from '@toolpad/core/AppProvider';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
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
  WindsComponent,
  defaultPattern,
  useSettings
} from './components';
import { SOURCE_DZ, SOURCE_MANUAL, fetchForecast } from './forecast/forecast';
import { FlightPath, LatLng, Target, Settings } from './types';
import { latLngToPoint } from './util/coords';
import { findClosestDropzone } from './util/dropzones';
import { hasTargetMovedTooFar, normalizeBearing } from './util/geo';
import { CODEC_JSON, addWind, averageWind, reposition } from './util/util';
import { WindRow, Winds } from './util/wind';

interface NavigationItem {
  segment?: string;
  title?: string;
  icon?: React.ReactNode;
  kind?: 'divider';
}

const NAVIGATION: NavigationItem[] = [
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
  const entry = NAVIGATION.find(item => item.segment === segment);

  return entry?.title ?? 'Unknown';
}

const defaultTarget: Target = {
  target: {
    lat: 28.21887,
    lng: -82.15122
  },
  finalHeading: 270
};

export default function DashboardLayoutBasic() {
  const [manoeuvre, setManoeuvre] = useLocalStorageState<FlightPath>(
    'flip.manoeuvre_turf',
    [],
    { codec: CODEC_JSON }
  );
  const [storedTarget, setStoredTarget] = useLocalStorageState<Target>('flip.target', defaultTarget, {
    codec: CODEC_JSON
  });
  // Ensure target is never null
  const target: Target = storedTarget ?? defaultTarget;
  const [pattern, setPattern] = useLocalStorageState<FlightPath>(
    'flip.pattern_turf',
    defaultPattern,
    { codec: CODEC_JSON }
  );
  const [winds, setWinds] = useState<Winds>(new Winds());
  const [settings, setSettings] = useSettings();
  const [fetching, setFetching] = useState(false);

  const [waitingForClick1, setWaitingForClick1] = useState(false);
  const [waitingForClick2, setWaitingForClick2] = useState(false);
  const [selectHeading, setSelectHeading] = useState(false);
  const [click1, setClick1] = useState<LatLng | undefined>(undefined);

  const setTarget = useCallback(
    (newTarget: Target) => {
      setStoredTarget(currentTarget => {
        if (currentTarget && hasTargetMovedTooFar(currentTarget.target, newTarget.target)) {
          console.log('Moved too far, invalidating winds');
          setWinds(new Winds());
        }

        return newTarget;
      });
    },
    [setStoredTarget]
  );

  const isMobile = useMediaQuery('(max-width:600px)');
  const router = useDemoRouter('/map');

  function selectFromMap(heading: boolean) {
    setWaitingForClick1(true);
    setWaitingForClick2(false);
    setSelectHeading(heading);
    if (isMobile) {
      router.navigate('/map');
    }
  }

  function handleMapClick(point: LatLng) {
    if (waitingForClick1) {
      if (selectHeading) {
        setClick1(point);
        setWaitingForClick1(false);
        setWaitingForClick2(true);
      } else {
        const updated: Target = { target: point, finalHeading: target?.finalHeading ?? 270 };

        setTarget(updated);
        setWaitingForClick1(false);
        setWaitingForClick2(false);
        setClick1(undefined);
      }
    } else if (waitingForClick2 && click1) {
      const pointTurf = latLngToPoint(point);
      const click1Turf = latLngToPoint(click1);
      const updated: Target = {
        target: click1,
        finalHeading: normalizeBearing(Math.round(turf.bearing(pointTurf, click1Turf)))
      };

      setTarget(updated);
      setWaitingForClick1(false);
      setWaitingForClick2(false);
      setClick1(undefined);
    } else if (isMobile) {
      router.navigate('/map');
    }
  }

  let c = reposition(manoeuvre ?? [], pattern ?? [], target ?? defaultTarget, settings.correctPatternHeading);
  const c2 = winds ? addWind(c, winds, settings.interpolateWind) : [];

  for (let i = 0; i < c.length; i++) {
    c2[i].properties.phase = c[i].properties.phase;
  }
  const averageWind_ = averageWind(c, c2);

  interface WindSummaryData {
    average: { speedKts?: number; direction?: number };
    ground?: WindRow & { observed?: boolean };
  }

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

  const fetch = () => {
    if (!target?.target) {
      console.log('Not fetching winds, no target');

      return;
    }

    const targetPoint: [number, number] = [target.target.lng, target.target.lat];
    let dz = findClosestDropzone(targetPoint);
    const distanceToDz = turf.distance(targetPoint, [dz.lng, dz.lat], { units: 'feet' });

    if (distanceToDz > 5000) {
      dz = undefined as any;
    }

    console.log(
      `Fetching winds for: ${JSON.stringify(target.target)},` +
        ` useDzGroundWind=${settings.useDzGroundWind} (dz=${dz?.name})`
    );

    setFetching(true);

    fetchForecast(
      target.target,
      settings.useDzGroundWind ? dz?.fetchGroundWind : undefined
    )
      .then(fetchedWinds => {
        let limit = settings.limitWind;

        if (c2.length > 0 && c2[c2.length - 1].properties.alt > limit) {
          limit = c2[c2.length - 1].properties.alt;
        }
        fetchedWinds.winds = fetchedWinds.winds.filter(w => w.altFt <= limit);
        setWinds(fetchedWinds);
        setFetching(false);
      })
      .catch(err => {
        console.log(`Failed to fetch winds: ${err}`);
        setFetching(false);
        const newWinds = new Winds([new WindRow(0, 0, 0)]);

        setWinds(newWinds);
      });
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
        fetch={fetch}
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
      waitingForClick={waitingForClick1 || waitingForClick2}
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
            onRefreshWindsClick={fetch}
            onSelectTargetClick={() => selectFromMap(false)}
            onSelectTargetAndHeadingClick={() => selectFromMap(true)}
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
    <AppProvider router={router} theme={demoTheme} navigation={NAVIGATION as any}>
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

interface WindSummaryData {
  average: { speedKts?: number; direction?: number };
  ground?: { direction: number; speedKts: number; observed?: boolean };
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
