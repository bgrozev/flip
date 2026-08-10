/* eslint-disable new-cap */
import {
  Adjust as AdjustIcon,
  Air as AirIcon,
  Crop as CropIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  FavoriteSharp as FavoriteIcon,
  Flag as FlagIcon,
  Groups as GroupsIcon,
  HelpOutline as HelpOutlineIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  RotateLeft as RotateLeftIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery
} from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { AppProvider, Navigation, Router } from '@toolpad/core/AppProvider';
import { DashboardLayout } from '@toolpad/core/DashboardLayout';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';

import {
  ABOUT_TOPIC_PATH,
  MAP_PATH,
  isLegacyAboutPathname,
  isMapPathname,
  isPathnameAllowed,
  panelFromPathname,
  panelPath
} from './app/routing';
import { applyModeDefaults, hasFeature, migrateModeId } from './modes';
import { applyNerdGate, withNerd } from './modes/nerd';

import {
  CoursesComponent,
  ExportDialog,
  FlockingComponent,
  HelpComponent,
  ManoeuvreComponent,
  MapComponent,
  ModePicker,
  PatternComponent,
  ShortcutsOverlay,
  SettingsComponent,
  TargetComponent,
  ToolbarActions,
  SpotSummary,
  WindSummary,
  WindsComponent,
  Wordmark
} from './components';
import { CourseEditTarget, ManoeuvreEditTarget, TargetEditTarget } from './map/layers';
import {
  AppStateProvider,
  DEFAULT_TARGET,
  PlaceSelection,
  useAppState,
  useCustomCourses,
  NotificationsProvider,
  useFlightPaths,
  useFlipFlop,
  useFlockingPath,
  useKeyboardShortcuts,
  useMode,
  useSetups,
  useSavedPlaces,
  useWinds
} from './hooks';
import { Course, FlightPath, LatLng, PanelId, PatternParams, Target, WindSummaryData } from './types';
import {
  destinationPoint,
  distanceFeet,
  hasTargetMovedTooFar,
  WIND_INVALIDATE_THRESHOLD_FT
} from './core/geometry';
import { formatDistanceFeet } from './core/units';
import {
  exitForFixedEnd,
  jumprunFromExit,
  localMilesEN,
  vectorCardinalDirection
} from './core/flocking';
import { COURSES } from './core/courses';
import { dropzoneForPlaceId, placeNameFromId } from './core/places';
import { DROPZONES } from './util/dropzones';
import { flipPatternSides, makePatternByType, withFullPattern } from './core/pattern';
import { describeManoeuvrePath, mirrorManoeuvre, placeInitiation } from './core/manoeuvre';
import { SpotText, formatSpot } from './core/spotText';
import { DEFAULT_MANOEUVRE_PARAMS } from './core/model';
import { SOURCE_DZ, SOURCE_MANUAL, windBandAltitudesFt } from './core/wind';
import { windTrust } from './core/windTrust';
import { visibleShortcuts } from './core/keymap';
import { topicForPanel } from './core/help';
import { normalizeDirection } from './core/validation';
import { SetupSnapshot } from './core/setups';

/** Keyboard target nudges: a fine step and a coarse one. */
const NUDGE_FT = 25;
const NUDGE_FAR_FT = 250;
const FT_TO_M = 0.3048;
const HEADING_STEP_DEG = 5;
/** The fine heading step: `,` and `.`, for landing exactly on a runway. */
const HEADING_FINE_STEP_DEG = 1;
/** Below this the target counts as "at" the place, and no offset is reported. */
const PLACE_OFFSET_MIN_FT = 100;
const NUDGE_BEARINGS: Record<string, number> = {
  arrowup: 0, arrowright: 90, arrowdown: 180, arrowleft: 270
};

const PANEL_NAV: Record<PanelId, { title: string; icon: React.ReactElement }> = {
  pattern: { title: 'Pattern', icon: <CropIcon /> },
  manoeuvre: { title: 'Manoeuvre', icon: <RotateLeftIcon /> },
  target: { title: 'Location', icon: <AdjustIcon /> },
  wind: { title: 'Wind', icon: <AirIcon /> },
  courses: { title: 'Courses', icon: <FlagIcon /> },
  flocking: { title: 'Flocking', icon: <GroupsIcon /> },
  settings: { title: 'Settings', icon: <SettingsIcon /> },
  help: { title: 'Help', icon: <InfoIcon /> }
};

/** App-level panels shown after a divider, at the bottom of the sidebar. */
const SECONDARY_PANELS: readonly PanelId[] = ['settings', 'help'];

/** Focus map renders no header at all; a module-level component so the
 * slot identity stays stable across renders. */
function HiddenHeader() {
  return null;
}

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
    selectPlaceTarget,
    patternParamsForMode,
    setPatternParamsForMode,
    flockingParams,
    setFlockingParams,
    settings,
    setSettings,
    touchedSettings,
    selectedCourseId,
    setSelectedCourseId,
    activePlaceId
  } = useAppState();

  const [courseEditOpen, setCourseEditOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Ephemeral: "show me just the map" is a way of looking at the plan, not a
  // preference, so it is deliberately not persisted.
  const [focusMap, setFocusMap] = useState(false);
  // Owned here so the `S` shortcut can open it (see SetupSelector).
  const [setupsOpen, setSetupsOpen] = useState(false);

  const router = useToolpadRouter();
  const navigate = useNavigate();

  // Mode: ?mode=... in a shared link applies immediately (this render) and
  // is persisted below; otherwise the stored choice (or first-run) rules.
  const rawUrlMode = router.searchParams.get('mode');
  const urlModeId = migrateModeId(rawUrlMode);
  const { mode: baseMode, setModeId, firstRun } = useMode(urlModeId);

  // Nerd mode widens whatever the active mode exposes. Read from the
  // *stored* settings, not `modeSettings` below — nerd is global, so no
  // mode may default it, and resolving it here breaks the cycle (the
  // settings resolution needs the mode, which needs the flag).
  const mode = useMemo(() => withNerd(baseMode, settings.nerd), [baseMode, settings.nerd]);

  // Each mode plans against its own target; modes with none yet share the
  // legacy one, so existing setups carry over on first switch.
  const target = targetForMode(mode.id);

  // Each mode keeps its own pattern: a swooper's descent rate and long legs
  // describe their canopy, not the student pattern next to it.
  const modePatternParams = patternParamsForMode(mode.id);
  const setModePatternParams = useCallback(
    (value: PatternParams) => setPatternParamsForMode(mode.id, value),
    [setPatternParamsForMode, mode.id]
  );


  // Persist the link's mode, then strip the param to keep the URL canonical
  useEffect(() => {
    if (rawUrlMode !== null) {
      if (urlModeId) {
        setModeId(urlModeId);
      }
      navigate(router.pathname, { replace: true });
    }
  }, [rawUrlMode, urlModeId, router.pathname, navigate, setModeId]);

  // The About panel became a Help topic; keep old links working.
  useEffect(() => {
    if (isLegacyAboutPathname(router.pathname)) {
      navigate(ABOUT_TOPIC_PATH, { replace: true });
    }
  }, [router.pathname, navigate]);

  // Route guard: panels outside the current mode, unknown paths and the
  // legacy /map alias all redirect to the map
  useEffect(() => {
    if (isLegacyAboutPathname(router.pathname)) {
      return;
    }
    if (!isPathnameAllowed(router.pathname, mode.nav) ||
        (isMapPathname(router.pathname) && router.pathname !== MAP_PATH)) {
      navigate(MAP_PATH, { replace: true });
    }
  }, [router.pathname, mode, navigate]);

  // Effective settings: mode defaults fill in the settings the user never
  // touched; the Settings panel still edits the stored values. The nerd
  // gate runs last and ignores "touched" — with nerd off the user cannot
  // see those controls, so an old choice must not keep them in effect.
  const modeSettings = useMemo(
    () => applyNerdGate(applyModeDefaults(settings, mode, touchedSettings), settings.nerd),
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
    (newTarget: Target, place?: PlaceSelection) => {
      if (
        hasTargetMovedTooFar(
          target.target,
          newTarget.target,
          WIND_INVALIDATE_THRESHOLD_FT
        )
      ) {
        invalidateWinds();
      }
      selectPlaceTarget(newTarget, place);
    },
    [target.target, selectPlaceTarget, invalidateWinds]
  );

  // Loading a setup is a place selection too — a setup names the dropzone it
  // was saved at, so that the course it names is still one the Courses panel
  // lists. `useGivenTarget` keeps the setup's own target: the setup IS the
  // remembered arrangement for that place.
  const applySetupTarget = useCallback(
    (newTarget: Target, placeId: string | null) => {
      selectPlace(
        newTarget,
        placeId
          ? {
            id: placeId,
            modes: dropzoneForPlaceId(DROPZONES, placeId)?.modes,
            useGivenTarget: true
          }
          : undefined
      );
    },
    [selectPlace]
  );

  const isMobile = useMediaQuery('(max-width:600px)');

  // Everything a setup can store, as it is right now: what the toolbar
  // compares against to say whether the loaded setup is still what is on
  // screen, and what "save" writes.
  const setupSnapshot: SetupSnapshot = useMemo(
    () => ({
      modeId: mode.id,
      patternParams: modePatternParams,
      manoeuvre: manoeuvreConfig,
      flockingParams,
      target,
      placeId: activePlaceId,
      selectedCourseId
    }),
    [
      mode.id,
      modePatternParams,
      manoeuvreConfig,
      flockingParams,
      target,
      activePlaceId,
      selectedCourseId
    ]
  );

  // A stored mode id is data, so it is validated on the way back in rather
  // than trusted: an id from a retired mode leaves the mode alone.
  const applySetupMode = useCallback(
    (id: string) => {
      const modeId = migrateModeId(id);

      if (modeId) setModeId(modeId);
    },
    [setModeId]
  );

  const setups = useSetups({
    snapshot: setupSnapshot,
    applyTarget: applySetupTarget,
    setModeId: applySetupMode,
    setPatternParamsForMode,
    setManoeuvreConfig,
    setFlockingParams,
    setSelectedCourseId
  });

  // Flocking mode replaces the pattern/manoeuvre derivation with its own
  // descent-path pipeline; each derivation only runs in its own mode.
  const isFlocking = mode.id === 'flocking';

  // The wordmark is the FliP/FloP switch, so it needs to know which planner
  // it is showing and which one to go back to.
  const flipFlop = useFlipFlop(mode.id, setModeId);

  // Modes without the leg-count control always fly the full pattern. The
  // override is applied on READ, never written back: a swooper's stored
  // NONE/1/2 choice must survive a trip through Standard Pattern.
  const effectivePatternParams = useMemo(
    () => (hasFeature(mode, 'patternLegCount')
      ? modePatternParams
      : withFullPattern(modePatternParams)),
    [mode, modePatternParams]
  );
  const pattern = useMemo(
    () => makePatternByType(effectivePatternParams),
    [effectivePatternParams]
  );

  const paths = useFlightPaths({
    manoeuvre: !isFlocking && hasFeature(mode, 'manoeuvre') ? manoeuvre ?? [] : [],
    pattern: !isFlocking ? pattern ?? [] : [],
    target: target ?? DEFAULT_TARGET,
    winds: effectiveWinds,
    // Only recorded turns need it. It snaps the pattern's final leg to +/-90
    // of the target heading, which exists to tolerate a track or a sample
    // being a few degrees off; a parametric turn knows its entry heading
    // exactly, and snapping a 135 would leave a 45-degree kink.
    correctPatternHeading:
      modeSettings.correctPatternHeading && manoeuvreConfig.type !== 'parameters',
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

  /**
   * The initiation handle. Dragging it is meant to be the primary way to
   * set a turn up, so it is live whenever a parametric turn is being flown
   * — no edit mode, the way the target handle works. A recorded track has
   * no depth and offset to write back to, so it gets no handle.
   *
   * It rides the IDEAL path. The turn is set up in still air and the wind
   * correction is what FliP hands back, so the handle belongs on the input
   * line; on the corrected one it read as if the drift were something you
   * could drag.
   */
  const manoeuvreEditTarget: ManoeuvreEditTarget | undefined = useMemo(() => {
    if (isFlocking || !hasFeature(mode, 'manoeuvre') || manoeuvreConfig.type !== 'parameters') {
      return undefined;
    }

    const ofManoeuvre = (path: FlightPath) =>
      path.filter(point => point.properties.phase === 'manoeuvre');
    const ideal = describeManoeuvrePath(ofManoeuvre(paths.ideal));

    if (!ideal) {
      return undefined;
    }

    return {
      target: (target ?? DEFAULT_TARGET).target,
      initiation: ideal.initiation,
      onMove: (point: LatLng) => {
        const params = manoeuvreConfig.params ?? DEFAULT_MANOEUVRE_PARAMS;

        setManoeuvreConfig({
          ...manoeuvreConfig,
          params: { ...params, ...placeInitiation(point, target ?? DEFAULT_TARGET, params) }
        });
      }
    };
  }, [isFlocking, mode, manoeuvreConfig, paths.ideal, target, setManoeuvreConfig]);

  // Flocking's output, formatted once for the top bar. The panel and the map
  // label build their own from the same `formatSpot`, so all three agree.
  const spotText = useMemo(
    () => (isFlocking && flocking.spot
      ? formatSpot(flocking.spot, modeSettings.units.distance, {
        missMi: flocking.missMi,
        tier: flocking.tier
      })
      : null),
    [isFlocking, flocking.spot, flocking.missMi, flocking.tier, modeSettings.units.distance]
  );

  // The solver draws NOTHING when no corridor reaches the target — including
  // when a dropzone declares no corridors at all, which is the usual case
  // right after moving to a new one, since corridors deliberately never
  // travel. An empty map is indistinguishable from a broken one, so the map
  // says why.
  const emptyNotice = useMemo(() => {
    if (!isFlocking || flockingParams.mode !== 'solve' || flocking.solve?.best) {
      return undefined;
    }

    return flockingParams.solveCorridors.some(corridor => corridor.enabled)
      ? {
        title: 'No jumprun solves',
        detail: 'No corridor gets the group close enough — widen one, or check the winds.'
      }
      : {
        title: 'No jumprun corridors here',
        detail: 'Corridors belong to a dropzone. Add one in the Flocking panel.'
      };
  }, [isFlocking, flockingParams.mode, flockingParams.solveCorridors, flocking.solve]);

  // What the Location panel puts at the top: which place, and how far the
  // target has been dragged off it. The dropzone's own coordinates are only
  // a starting point (places remember what you moved to), so the offset is
  // information rather than a fault — with a way back when it was a mistake.
  const { places: savedPlaces, isFavorite, toggleFavorite } = useSavedPlaces();
  const activePlace = useMemo(
    () => savedPlaces.find(place => place.id === activePlaceId) ?? null,
    [savedPlaces, activePlaceId]
  );
  const activePlaceIsFavorite = activePlace ? isFavorite(activePlace.name) : false;
  const placeOffsetLabel = useMemo(() => {
    if (!activePlace) {
      return undefined;
    }

    const offsetFt = distanceFeet(
      { lat: activePlace.lat, lng: activePlace.lng },
      target.target
    );

    // Below a canopy's own length the target is "there"; saying it moved 12 ft
    // would be noise on every plan, since dragging it is the normal thing.
    return offsetFt < PLACE_OFFSET_MIN_FT
      ? undefined
      : formatDistanceFeet(offsetFt, modeSettings.units.altitude);
  }, [activePlace, target.target, modeSettings.units.altitude]);
  const resetTargetToPlace = useCallback(() => {
    if (activePlace) {
      setTarget({
        target: { lat: activePlace.lat, lng: activePlace.lng },
        finalHeading: activePlace.direction ?? target.finalHeading
      });
    }
  }, [activePlace, setTarget, target.finalHeading]);

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

  const handleFetchWinds = useCallback(
    (overrideForecastTime?: Date | null, opts?: { force?: boolean }) => {
      // Winds are fetched at every level (ground to ~41k ft); no altitude cap.
      fetchWinds(overrideForecastTime, opts);
    },
    [fetchWinds]
  );

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

  // Refetch when the wind SOURCE changes — the model, or forecast vs
  // sounding. Nothing did this before: changing the model in Settings
  // stored the choice and left the old profile on screen until the user
  // hit refresh, and the comparison table's "use this one" would have had
  // the same dead feel. The click cannot do the fetch itself, because
  // `fetchWinds` closes over the settings it is replacing.
  const lastSourceRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${modeSettings.windAloftSource}:${modeSettings.windModel}`;

    // Skip the initial value: the auto-fetch above already covers load.
    if (lastSourceRef.current === null) {
      lastSourceRef.current = key;

      return;
    }
    if (lastSourceRef.current === key) {
      return;
    }
    lastSourceRef.current = key;
    handleFetchWinds(undefined, { force: true });
  }, [modeSettings.windAloftSource, modeSettings.windModel, handleFetchWinds]);

  // Heading that lands into wind: the ground wind's direction (it is where
  // the wind comes FROM), or null when there is no wind to land into. Drives
  // the Upwind button and stands in for a missing dropzone landing direction.
  const upwindHeading = useMemo(() => {
    const ground = effectiveWinds?.winds?.[0];

    return ground && ground.speedKts > 0
      ? Math.round(ground.direction % 360)
      : null;
  }, [effectiveWinds]);

  const nudgeTarget = useCallback((combo: string, distanceFt: number) => {
    const bearing = NUDGE_BEARINGS[combo.replace('shift+', '')];

    if (bearing === undefined) {
      return;
    }
    setTarget({
      ...target,
      target: destinationPoint(target.target, bearing, distanceFt * FT_TO_M)
    });
  }, [target, setTarget]);

  /**
   * Select a forecast hour the way the scrubber does — the selected time and
   * the fetch go together. Setting the time alone moves the slider but never
   * re-slices the cached window, so the table and the paths would not budge.
   */
  const applyForecastTime = useCallback((time: Date | null) => {
    onForecastTimeChange(time);
    handleFetchWinds(time);
  }, [onForecastTimeChange, handleFetchWinds]);

  /**
   * Step whole hours from now, on the same grid as the scrubber (0 = now)
   * and clamped to the hours actually cached.
   */
  const stepForecastHour = useCallback((delta: number) => {
    const currentHour = forecastTime
      ? Math.round((forecastTime.getTime() - Date.now()) / 3600_000)
      : 0;
    const maxHour = scrubHours && scrubHours > 0 ? scrubHours - 1 : 0;
    const next = Math.min(Math.max(currentHour + delta, 0), maxHour);

    applyForecastTime(next === 0 ? null : new Date(Date.now() + next * 3600_000));
  }, [forecastTime, scrubHours, applyForecastTime]);

  const rotateHeading = useCallback((deltaDeg: number) => {
    setTarget({
      ...target,
      finalHeading: normalizeDirection(target.finalHeading + deltaDeg)
    });
  }, [target, setTarget]);

  // --- Keyboard shortcuts -------------------------------------------------
  // The bindings and the `?` list both come from core/keymap, filtered to
  // what this mode exposes.
  const shortcuts = useMemo(
    () => visibleShortcuts({
      navPanels: mode.nav,
      features: mode.features,
      headingRelevant: !isFlocking
    }),
    [mode, isFlocking]
  );

  const openPanel = panelFromPathname(router.pathname);

  const shortcutHandlers = useMemo(() => ({
    'app.help': () => setShortcutsOpen(true),
    'app.focusMap': () => setFocusMap(on => !on),
    // Layered, most-transient first: leave focus, else close the panel.
    'app.close': () => {
      if (focusMap) {
        setFocusMap(false);
      } else if (openPanel) {
        navigate(MAP_PATH);
      }
    },
    'app.mode.pattern': () => setModeId('pattern'),
    'app.mode.swoop': () => setModeId('swoop'),
    'app.mode.flocking': () => setModeId('flocking'),
    'app.export': () => setExportOpen(true),
    'app.presets': () => setSetupsOpen(true),
    'panel.pattern': () => router.navigate(panelPath('pattern')),
    'panel.manoeuvre': () => router.navigate(panelPath('manoeuvre')),
    'panel.target': () => router.navigate(panelPath('target')),
    'panel.wind': () => router.navigate(panelPath('wind')),
    'panel.courses': () => router.navigate(panelPath('courses')),
    'panel.flocking': () => router.navigate(panelPath('flocking')),
    'panel.settings': () => router.navigate(panelPath('settings')),
    'pattern.flipSides': () => setModePatternParams(flipPatternSides(modePatternParams)),
    // Mirrors whichever way the turn is described — parameters, sample or
    // recorded track; `mirrorManoeuvre` owns that distinction.
    'manoeuvre.mirror': () => setManoeuvreConfig(mirrorManoeuvre(manoeuvreConfig)),
    'winds.refresh': () => handleFetchWinds(undefined, { force: true }),
    'winds.hourBack': () => stepForecastHour(-1),
    'winds.hourForward': () => stepForecastHour(1),
    'winds.now': () => applyForecastTime(null),
    'target.nudge': (combo: string) => nudgeTarget(combo, NUDGE_FT),
    'target.nudgeFar': (combo: string) => nudgeTarget(combo, NUDGE_FAR_FT),
    'target.rotateLeft': () => rotateHeading(-HEADING_STEP_DEG),
    'target.rotateRight': () => rotateHeading(HEADING_STEP_DEG),
    'target.rotateLeftFine': () => rotateHeading(-HEADING_FINE_STEP_DEG),
    'target.rotateRightFine': () => rotateHeading(HEADING_FINE_STEP_DEG),
    'target.upwind': () => {
      if (upwindHeading !== null) {
        setTarget({ ...target, finalHeading: upwindHeading });
      }
    }
  }), [
    focusMap, openPanel, navigate, router, setModeId, handleFetchWinds,
    applyForecastTime, stepForecastHour, nudgeTarget, rotateHeading,
    upwindHeading, setTarget, target, setModePatternParams, modePatternParams
  ]);

  // The mode picker owns the keyboard on first run; the `?` dialog and any
  // menu are handled by the guard inside the hook.
  useKeyboardShortcuts(shortcuts, shortcutHandlers, !firstRun);

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
        // Each mode has its own pattern, and the panel's number fields are
        // uncontrolled (seeded once from initialValue) — remount on a mode
        // change or they keep showing the previous mode's numbers.
        key={mode.id}
        params={effectivePatternParams}
        onParamsChange={setModePatternParams}
        legCountSelectable={hasFeature(mode, 'patternLegCount')}
        nerd={settings.nerd}
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
        activePlace={activePlace}
        placeOffsetLabel={placeOffsetLabel}
        onResetToPlace={resetTargetToPlace}
        isFavorite={activePlaceIsFavorite}
        onToggleFavorite={activePlace?.kind === 'dropzone' || activePlace?.kind === 'favorite'
          ? () => toggleFavorite(activePlace.name)
          : undefined}
        showHeadingField={hasFeature(mode, 'headingField') && !isFlocking}
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
        allowManualEdit={hasFeature(mode, 'manualWind')}
        bandAltitudesFt={keyWindAltitudesFt}
        interpolate={modeSettings.interpolateWind}
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
        showExport={hasFeature(mode, 'export')}
        placeId={activePlaceId}
        placeName={placeNameFromId(activePlaceId)}
      />
    );
  } else if (activePanel === 'help') {
    p = (
      <HelpComponent
        topicId={router.searchParams.get('topic')}
        onSelectTopic={(id: string | null) => navigate(
          id ? `${panelPath('help')}?topic=${id}` : panelPath('help')
        )}
        shortcuts={shortcuts}
      />
    );
  } else if (activePanel === 'settings') {
    p = <SettingsComponent settings={settings} setSettings={setSettings} />;
  }

  let sidebar: React.ReactNode;

  if (p) {
    const helpTopic = activePanel ? topicForPanel(activePanel) : undefined;

    sidebar = (
      <Box
        sx={{
          px: 4,
          // Tight at the top: the panel title is the first thing under the
          // app bar, and a 32px gap above it was just lost screen.
          pt: 1.5,
          pb: 4,
          display: 'flex',
          flexDirection: 'column',
          // Panels read left-to-right like a form. This used to be
          // `alignItems: 'left'` (not a value align-items has, so it did
          // nothing) over `textAlign: 'center'`, which every panel then had
          // to undo line by line — and anything that forgot came out
          // centred.
          alignItems: 'stretch',
          textAlign: 'left'
        }}
      >
        {/* One header for every panel, so the reference is reachable from
            wherever the question came up — the primary route on mobile,
            where panels are full-screen. */}
        {activePanel && (
          <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontSize: '1rem', flex: 1, textAlign: 'left' }}>
              {PANEL_NAV[activePanel].title}
            </Typography>
            {/* Fetching the forecast is the Wind panel's own action, so it
                sits in its header rather than costing a full-width button
                in the panel or a permanent slot in the app toolbar. */}
            {activePanel === 'wind' && (
              <Tooltip title="Fetch the latest forecast">
                <IconButton
                  size="small"
                  aria-label="refresh-wind"
                  onClick={() => handleFetchWinds(undefined, { force: true })}
                >
                  {fetching
                    ? <CircularProgress size={18} />
                    : <RefreshIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
            {helpTopic && (
              <Tooltip title={`What do these mean? (${helpTopic.title})`}>
                <IconButton
                  size="small"
                  aria-label={`Help: ${helpTopic.title}`}
                  onClick={() => navigate(`${panelPath('help')}?topic=${helpTopic.id}`)}
                >
                  <HelpOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        )}
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

  // Positioning a course is an explicit mode, because its handles sit on top
  // of the target's — a course centre is usually within metres of where you
  // land, so with both live you cannot tell which one you are grabbing. While
  // it is on the target is not draggable (below); it is off by default and
  // turns off again when the selection changes.
  const selectedCustomParam = customParams.find(c => c.id === selectedCourseId) ?? null;
  const editingCourse = courseEditOpen && selectedCustomParam !== null && activePanel === 'courses';
  const courseEditTarget: CourseEditTarget | undefined =
    editingCourse && selectedCustomParam
      ? {
        center: { lat: selectedCustomParam.lat, lng: selectedCustomParam.lng } as LatLng,
        direction: selectedCustomParam.direction,
        onMove: (newCenter: LatLng) => updateCourse(selectedCustomParam.id, { lat: newCenter.lat, lng: newCenter.lng }),
        onRotate: (newDir: number) => updateCourse(selectedCustomParam.id, { direction: newDir })
      }
      : undefined;

  // The target is draggable in every mode. Flocking hides the final-heading
  // rotate handle (it has its own jumprun/canopy controls). The one time it
  // is withheld is while a course is being positioned: the two handle sets
  // overlap, so one of them has to yield.
  const targetEditTarget: TargetEditTarget | undefined = editingCourse
    ? undefined
    : {
      target: target.target,
      heading: target.finalHeading,
      onMove: (pos: LatLng) => setTarget({ ...target, target: pos }),
      onHeadingChange: (h: number) => setTarget({ ...target, finalHeading: Math.round(h) }),
      // The panel's "Upwind" button went with the final-heading field, and a
      // phone has no `u` key — so the gesture lives on the handle that already
      // means "landing direction". Omitted when there is no wind to face.
      onUpwind: upwindHeading === null
        ? undefined
        : () => setTarget({ ...target, finalHeading: upwindHeading }),
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
      pointTooltips={hasFeature(mode, 'pointTooltips')}
      layers={mode.mapLayers}
      // On a phone the map shares the screen with the open panel, so the
      // corner overlays have to give the strip back.
      compactOverlays={isMobile && activePanel !== null && !focusMap}
      shortcutHint={{
        show: !isMobile && !focusMap,
        onOpen: () => setShortcutsOpen(true)
      }}
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
      emptyNotice={emptyNotice}
      // On a phone the map is a strip beside the open panel; pressing it means
      // "put the panel away and let me look". On a desktop the two are side by
      // side, so there is nothing in the way and nothing to close.
      onBackgroundPress={isMobile && activePanel ? () => navigate(MAP_PATH) : undefined}
      courses={enabledCourses}
      courseEditTarget={courseEditTarget}
      targetEditTarget={targetEditTarget}
      manoeuvreEditTarget={manoeuvreEditTarget}
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
  // Slot components must keep a STABLE identity: Toolpad renders whatever
  // component it is handed, so a fresh arrow function on every render makes
  // React unmount and remount the entire toolbar each time App re-renders.
  // That remount is what used to re-open the preset menu on any state change
  // (and threw away the toolbar's own state with it). The components are
  // created once and read their props from a ref, which is refreshed on every
  // render, so they still render current data.
  const toolbarPropsRef = useRef<React.ComponentProps<typeof ToolbarActions>>(null!);

  toolbarPropsRef.current = {
    modeId: mode.id,
    onModeChange: setModeId,
    onExportClick: () => setExportOpen(true),
    showExport: hasFeature(mode, 'export'),
    nerd: settings.nerd,
    onNerdOff: () => setSettings({ ...settings, nerd: false }),
    showSetups: modeSettings.showPresets && hasFeature(mode, 'presets'),
    setups,
    activeModeId: mode.id,
    placeId: activePlaceId,
    placeName: placeNameFromId(activePlaceId),
    setupsOpen,
    onSetupsOpenChange: setSetupsOpen
  };

  const appTitlePropsRef = useRef<React.ComponentProps<typeof CustomAppTitle>>(null!);

  appTitlePropsRef.current = {
    wind: windSummary,
    spot: spotText ?? undefined,
    flocking: flipFlop.flocking,
    onToggleFlocking: flipFlop.toggle
  };

  const slots = useMemo(() => ({
    toolbarActions: () => <ToolbarActions {...toolbarPropsRef.current} />,
    sidebarFooter: SidebarFooter,
    appTitle: () => <CustomAppTitle {...appTitlePropsRef.current} />
  }), []);

  const dashboard = (
    <DashboardLayout
      defaultSidebarCollapsed={true}
      hideNavigation={focusMap}
      // Focus map hides the header outright. The DashboardLayout itself stays
      // mounted, so the map is never torn down and re-created — that would
      // reload tiles and lose the camera.
      slots={focusMap ? { ...slots, header: HiddenHeader } : slots}
    >
      <LayoutWithSidebar box={focusMap ? null : sidebar} map={map} focusMap={focusMap} />
    </DashboardLayout>
  );

  const bottomNavPanels = mode.nav.filter(id => !SECONDARY_PANELS.includes(id));
  const bottomNavValue = activePanel ? bottomNavPanels.indexOf(activePanel) : -1;

  const activeSetupName = setups.activeSetup?.name ?? 'unnamed';

  const navigation = useMemo(() => buildNavigation(mode.nav), [mode]);

  return (
    <AppProvider router={router} theme={demoTheme} navigation={navigation}>
      {dashboard}
      <ModePicker open={firstRun} onSelect={setModeId} />
      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        shortcuts={shortcuts}
        modeLabel={mode.label}
      />
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        path={isFlocking ? flocking.corrected : paths.display}
        target={target.target}
        presetName={activeSetupName}
      />
      {isMobile && !focusMap && (
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

/**
 * The top bar. In flocking the wind summary gives way to the SPOT, which is
 * that mode's whole output and the thing a flocker reads out to the pilot —
 * and the wind it displaces is already on the map's winds indicator. Every
 * other mode is unchanged.
 *
 * The wordmark leading it is also the FliP/FloP switch — see `Wordmark`.
 */
function CustomAppTitle({
  wind,
  spot,
  flocking,
  onToggleFlocking
}: {
  wind?: WindSummaryData;
  spot?: SpotText;
  flocking: boolean;
  onToggleFlocking: () => void;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={{ xs: 1, sm: 2 }} sx={{ minWidth: 0 }}>
      <Wordmark flocking={flocking} onToggle={onToggleFlocking} />
      {spot && <SpotSummary spot={spot} />}
      {!spot && wind && wind.average && wind.ground && (
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
          densityAltitudeFt={wind.densityAltitudeFt}
          densityAltitudeSeverity={wind.densityAltitudeSeverity}
          elevationFt={wind.elevationFt}
        />
      )}
    </Stack>
  );
}

interface LayoutWithSidebarProps {
  box: React.ReactNode;
  map: React.ReactNode;
  /** Focus map: the header is replaced, so the overlap has to be re-measured. */
  focusMap: boolean;
}

/**
 * How far the app bar overhangs the content, in px.
 *
 * Toolpad's DashboardLayout reserves ONE toolbar height for `main` and pins the
 * bar over it. On a phone the bar's contents — the wind summary or the spot,
 * the mode switch, the presets menu — wrap to a second row and the bar grows
 * past that reservation, so the top of `main` sits underneath it. On the map
 * that hid the winds indicator's own header (refresh and collapse included).
 * Measured rather than assumed: how tall the bar gets depends on what the
 * active mode puts in it.
 */
function useAppBarOverlap(focusMap: boolean): number {
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    const bar = document.querySelector('header');
    const main = document.querySelector('main');

    if (!bar || !main) {
      setOverlap(0);

      return;
    }

    // Padding is applied inside `main`, so measuring cannot move either of
    // these — no feedback loop.
    const measure = () => setOverlap(Math.max(
      0,
      Math.round(bar.getBoundingClientRect().bottom - main.getBoundingClientRect().top)
    ));

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(bar);
    observer.observe(main);

    return () => observer.disconnect();
  }, [focusMap]);

  return overlap;
}

/** How much of the mobile content area the map keeps while a panel is open. */
const MOBILE_MAP_SPLIT = '40%';

/**
 * The map strip when the split is collapsed. Not zero, deliberately: the map
 * is never unmounted or given a zero-sized viewport, so its tiles and camera
 * survive a trip through a panel — which is the whole point of the split.
 */
const MOBILE_MAP_PEEK = 88;

function LayoutWithSidebar({ box, map, focusMap }: LayoutWithSidebarProps) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const appBarOverlap = useAppBarOverlap(focusMap);
  // Collapsing is per-session, not persisted: it is a "give me the form" gesture
  // for one long panel, not a preference. Survives panel navigation because this
  // component stays mounted.
  const [mapCollapsed, setMapCollapsed] = useState(false);

  // On mobile the panel used to REPLACE the map, which broke seeing what an
  // edit does and tore the map down on every panel visit (tiles reload, camera
  // lost). They now split the screen: the map keeps the top, the panel scrolls
  // below it, and the divider collapses the map to a strip when the form needs
  // the room.
  if (isMobile) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          pt: `${appBarOverlap}px`,
          pb: '56px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            flex: box
              ? `0 0 ${mapCollapsed ? `${MOBILE_MAP_PEEK}px` : MOBILE_MAP_SPLIT}`
              : '1 1 auto',
            minHeight: 0
          }}
        >
          {map}
        </Box>
        {box && (
          <>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexShrink: 0,
                borderTop: 1,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper'
              }}
            >
              <Tooltip title={mapCollapsed ? 'Show more map' : 'Show more panel'}>
                <IconButton
                  size="small"
                  aria-label={mapCollapsed ? 'Show more map' : 'Show more panel'}
                  onClick={() => setMapCollapsed(v => !v)}
                  sx={{ py: 0 }}
                >
                  {mapCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', px: 2, pt: 2 }}>
              {box}
            </Box>
          </>
        )}
      </Box>
    );
  }

  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ width: '100%', height: '100%', boxSizing: 'border-box', pt: `${appBarOverlap}px` }}
    >
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
