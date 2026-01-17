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
import {
    Box,
    Divider,
    Stack,
    Typography,
    useMediaQuery
} from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { AppProvider } from '@toolpad/core/AppProvider';
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
import { DashboardLayout } from './components/DashboardLayout.tsx';
import { SOURCE_DZ, SOURCE_MANUAL, fetchForecast } from './forecast/forecast.js';
import { findClosestDropzone } from './util/dropzones.js';
import {
    hasTargetMovedTooFar,
    normalizeBearing,
    toTurfPoint
} from './util/geo.js';
import {
    CODEC_JSON,
    addWind,
    averageWind,
    reposition
} from './util/util.js';
import { WindRow, Winds } from './util/wind.js';

const NAVIGATION = [
    {
        segment: 'pattern',
        title: 'Pattern',
        icon: <CropIcon/>
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

function useDemoRouter(initialPath) {
    const [ pathname, setPathname ] = useState(initialPath);

    const navigate = useCallback(
    path => {
        const normalizedPath = String(path);

        if (normalizedPath === pathname) {
            setPathname('/map'); // Route to map instead

            return;
        }

        setPathname(normalizedPath);
    },
    [ pathname ]
    );

    return useMemo(() => {
        return {
            pathname,
            searchParams: new URLSearchParams(),
            navigate
        };
    }, [ pathname, navigate ]);
}

function getTitleFromPathname(pathname) {
    const segment = pathname.replace('/', '');
    const entry = NAVIGATION.find(item => item.segment === segment);

    return entry?.title ?? 'Unknown';
}

const defaultTarget = {
    target: {
        lat: 28.21887,
        lng: -82.15122
    },
    finalHeading: 270
};

export default function DashboardLayoutBasic() {

    const [ manoeuvre, setManoeuvre ] = useLocalStorageState('flip.manoeuvre_turf', [], { codec: CODEC_JSON });
    const [ target, setTarget_ ] = useLocalStorageState('flip.target', defaultTarget, { codec: CODEC_JSON });
    const [ pattern, setPattern ] = useLocalStorageState('flip.pattern_turf', defaultPattern, { codec: CODEC_JSON });
    const [ winds, setWinds ] = useState(new Winds());
    const [ settings, setSettings ] = useSettings();
    const [ fetching, setFetching ] = useState(false);

    const [ waitingForClick1, setWaitingForClick1 ] = useState(false);
    const [ waitingForClick2, setWaitingForClick2 ] = useState(false);
    const [ selectHeading, setSelectHeading ] = useState(false);
    const [ click1, setClick1 ] = useState(undefined);
    const [ isNavigationExpanded, setIsNavigationExpanded ] = useState(false);

    const setTarget = useCallback(
        newTarget => {
            setTarget_(currentTarget => {
                if (hasTargetMovedTooFar(currentTarget.target, newTarget.target)) {
                    console.log('Moved too far, invalidating winds');
                    setWinds(new Winds());
                }

                return newTarget;
            });
        },
        [ setTarget_, target ]
    );

    const isMobile = useMediaQuery('(max-width:600px)');
    const router = useDemoRouter('/map');

    function selectFromMap(heading) {
        setWaitingForClick1(true);
        setWaitingForClick2(false);
        setSelectHeading(heading);
        if (isMobile) {
            setIsNavigationExpanded(false);
            router.navigate('/map');
        }
    }

    function handleMapClick(point) {
        if (waitingForClick1) {
            if (selectHeading) {
                setClick1(point);
                setWaitingForClick1(false);
                setWaitingForClick2(true);
            } else {
                const updated = { ...target, target: point };

                setTarget(updated);
                setWaitingForClick1(false);
                setWaitingForClick2(false);
                setClick1(undefined);
            }
        } else if (waitingForClick2) {
            const updated = {
                ...target,
                target: click1,
                finalHeading: normalizeBearing(Math.round(turf.bearing(toTurfPoint(point), toTurfPoint(click1))))
            };

            setTarget(updated);
            setWaitingForClick1(false);
            setWaitingForClick2(false);
            setClick1(undefined);
        } else if (isMobile) {
            setIsNavigationExpanded(false);
            router.navigate('/map');
        }
    }

    let c = reposition(manoeuvre, pattern, target, settings.correctPatternHeading);
    const c2 = winds ? addWind(c, winds, settings.interpolateWind) : [];

    for (let i = 0; i < c.length; i++) {
        c2[i].phase = c[i].phase;
    }
    const averageWind_ = averageWind(c, c2);
    let windSummary;

    if (settings.displayWindSummary && (winds.groundSource !== SOURCE_MANUAL || winds.aloftSource !== SOURCE_MANUAL)
        && typeof averageWind_.speedKts === 'number') {

        windSummary = {};
        windSummary.average = averageWind_;
        if (winds.groundSource !== SOURCE_MANUAL && winds.winds && winds.winds.length > 0) {
            windSummary.ground = winds.winds[0];
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

        const targetPoint = [ target.target.lng, target.target.lat ];
        let dz = findClosestDropzone(targetPoint);
        const distanceToDz = turf.distance(targetPoint, [ dz.lng, dz.lat ], { units: 'feet' });

        if (distanceToDz > 5000) {
            dz = null;
        }

        const { forecastSource } = settings;

        console.log(
            `Fetching winds using ${forecastSource} for: ${JSON.stringify(target.target)},`
            + ` useDzGroundWind=${settings.useDzGroundWind} (dz=${dz?.name})`
        );

        setFetching(true);

        fetchForecast(forecastSource, target.target, settings.useDzGroundWind && dz?.fetchGroundWind)
            .then(fetchedWinds => {
                let limit = settings.limitWind;

                if (c2.length > 0 && c2[c2.length - 1].alt > limit) {
                    limit = c2[c2.length - 1].alt;
                }
                fetchedWinds.winds = fetchedWinds.winds.filter(w => w.altFt <= limit);
                setWinds(fetchedWinds);
                setFetching(false);
            })
            .catch(err => {
                console.log(`Failed to fetch winds: ${err}`);
                setFetching(false);
                const newWinds = new Winds([ new WindRow(0, 0, 0) ]);

                setWinds(newWinds);
            });
    };

    if (!settings.showPreWind) {
        c = [];
    }

    function onUpwindClick() {
        if (winds?.winds && winds.winds.length > 0 && winds.winds[0].speedKts > 0) {
            const newTarget = {
                ...target,
                finalHeading: Math.round(winds.winds[0].direction % 360)
            };

            setTarget(newTarget);
        }
    }

    let p = null;

    if (router.pathname === '/manoeuvre') {
        p = <ManoeuvreComponent
            setManoeuvre={setManoeuvre}
            manoeuvreToSave={c2.filter(point => point.phase === 'manoeuvre')}
        />;
    } else if (router.pathname === '/pattern') {
        p = <PatternComponent onChange={setPattern} />;
    } else if (router.pathname === '/target') {
        p = <TargetComponent
            selectFromMap={selectFromMap}
            target={target}
            setTarget={setTarget}
            onUpwindClick={onUpwindClick}
        />;
    } else if (router.pathname === '/wind') {
        p = <WindsComponent
            center={target.target}
            winds={ winds }
            setWinds={ setWinds }
            fetching= { fetching }
            setFetching = { setFetching }
            settings={ settings }
            fetch= { fetch }
        />;
    } else if (router.pathname === '/about') {
        p = <AboutComponent/>;
    } else if (router.pathname === '/settings') {
        p = <SettingsComponent
            settings={ settings }
            setSettings={ setSettings } />;
    }

    let sidebar;

    if (p) {
        sidebar = <Box
            sx={{ px: 4, py: 4, display: 'flex', flexDirection: 'column', alignItems: 'left', textAlign: 'center' }}
        >
            {p}
        </Box>;
    }
    const map = <MapComponent
        center={target.target}
        pathA={c}
        pathB={c2}
        showPoms={settings.showPoms}
        showPomAltitudes={settings.showPomAltitudes}
        settings={settings}
        onClick={handleMapClick}
        windDirection={averageWind_?.direction}
        windSpeed={averageWind_?.speedKts}
        waitingForClick={waitingForClick1 || waitingForClick2}
    />;
    const dashboard = <DashboardLayout
        navigation={NAVIGATION}
        isNavigationExpanded={isNavigationExpanded}
        setIsNavigationExpanded={setIsNavigationExpanded}
        defaultSidebarCollapsed={true}
        slots={{
            toolbarActions: () => (
                <ToolbarActions
                    fetching={fetching}
                    onMapButtonClick={() => {
                        setIsNavigationExpanded(false);
                        router.navigate('/map');
                    }}
                    onRefreshWindsClick={fetch}
                    onSelectTargetClick={() => selectFromMap(false) }
                    onSelectTargetAndHeadingClick={() => selectFromMap(true) }
                />
            ),
            sidebarFooter: SidebarFooter,
            appTitle: () => CustomAppTitle({ wind: windSummary })
        }}
    >
        <LayoutWithSidebar title={getTitleFromPathname(router.pathname)} box={sidebar} map={map} />
    </DashboardLayout>;

    return <AppProvider
        router={router}
        theme={demoTheme}
    >
        {dashboard}
    </AppProvider>;
}


function SidebarFooter({ mini }) {
    return (
        <Typography
            variant="caption"
            sx={{ m: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}
        >
            {mini
                ? '© FliP'
                : <>
                © {new Date().getFullYear()} FliP made with <FavoriteIcon sx={{ fontSize: 14 }} />
                </>
            }
        </Typography>
    );
}


function CustomAppTitle({ wind }) {
    return (
        <Stack direction="row" alignItems="center" spacing={2}>
            <FlipIcon fontSize="large" color="primary" />
            <Typography
                variant="h7"
                sx={{
                    fontWeight: 'bold',
                    color: '#14E02B',
                    textTransform: 'uppercase'
                }}
            >
                FliP
            </Typography>
            <Divider/>
            { wind && WindSummary(wind) }
        </Stack>
    );
}

function LayoutWithSidebar({ box, map, title }) {
    return (
        <Stack direction="row" spacing={2} sx={{ width: '100%', height: '100%' }}>
            {box && (
                <Box
                    elevation={2}
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
