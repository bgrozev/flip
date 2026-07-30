import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React, { createContext, useContext, useCallback, ReactNode, useMemo } from 'react';

import {
  DEFAULT_FLOCKING_PARAMS,
  DEFAULT_MANOEUVRE_CONFIG,
  DEFAULT_PATTERN_PARAMS,
  DEFAULT_SETTINGS,
  DEFAULT_TARGET,
  SCHEMA_VERSION,
  migrateFlockingParams,
  migrateManoeuvreConfig,
  migratePatternParams,
  migratePatternParamsByMode,
  migrateSettings,
  migrateTarget,
  migrateTargetsByMode,
  migrateTargetsByPlace,
  migrateTouchedSettings,
  seedTouchedSettings
} from '../core/model';
import { FlockingParams } from '../core/flocking';
import {
  DropzoneModeConfig,
  FlightPath,
  ManoeuvreConfig,
  PatternParams,
  PlaceTargets,
  Settings,
  Target
} from '../types';
import { createVersionedCodec } from '../util/storage';
import { applyInitiationAltitudeOffset, createManoeuvrePath } from '../core/manoeuvre';
import { mirror } from '../core/geometry';
import { dropzoneForPlaceId, placeModeTargets } from '../core/places';
import { BUILT_IN_PARAMS, courseIsAtPlace } from '../core/courses';
import { DROPZONES } from '../util/dropzones';
import { samples } from '../samples';

import { useCustomCourses } from './useCustomCourses';

// Canonical defaults live in core/model; re-exported here for existing users
export { DEFAULT_PATTERN_PARAMS, DEFAULT_MANOEUVRE_CONFIG };

/** The settings keys the user has explicitly changed. */
type TouchedSettings = (keyof Settings)[];

/**
 * The place a target move belongs to: its id (the key its adjustments are
 * remembered under) and whatever starting configuration the dropzone
 * database declares for it.
 */
export interface PlaceSelection {
  id: string;
  modes?: Record<string, DropzoneModeConfig>;
  /**
   * Use the target passed in rather than whatever was remembered at this
   * place. For loading a preset, which names both a place and its own target:
   * the preset IS the remembered setup, so it must not be overwritten by the
   * last thing the user did at that dropzone.
   */
  useGivenTarget?: boolean;
}

// The codec's type is widened to include null (the "never stored" state the
// initializer provides); parsing stored data still always yields a list.
const TOUCHED_SETTINGS_CODEC = createVersionedCodec<TouchedSettings | null>(
  SCHEMA_VERSION,
  migrateTouchedSettings
);

function computeManoeuvre(config: ManoeuvreConfig): FlightPath {
  let path: FlightPath;

  switch (config.type) {
    case 'parameters':
      return config.params ? createManoeuvrePath(config.params) : [];
    case 'track':
      path = config.trackData ?? [];
      break;
    case 'samples': {
      if (typeof config.sampleIndex !== 'number') return [];
      path = samples[config.sampleIndex]?.getPath() ?? [];
      if (config.sampleLeft === false) path = mirror(path);
      break;
    }
    default:
      return [];
  }

  return applyInitiationAltitudeOffset(path, config.initiationAltitudeOffset ?? 0);
}

// Context value type
interface AppStateContextValue {
  // Derived paths (for rendering)
  manoeuvre: FlightPath;

  // Config state (source of truth for presets)
  manoeuvreConfig: ManoeuvreConfig;
  patternParams: PatternParams;
  flockingParams: FlockingParams;
  target: Target;
  settings: Settings;
  /** Settings keys the user has explicitly changed (mode defaults skip these). */
  touchedSettings: readonly (keyof Settings)[];
  selectedCourseId: string | null;
  /**
   * The place the user is at (a `Place.id`), or null for a target that
   * belongs to no place. Courses are scoped to it, and presets record it.
   */
  activePlaceId: string | null;

  // Setters
  setManoeuvreConfig: (config: ManoeuvreConfig) => void;
  setPatternParams: (params: PatternParams) => void;
  /** Pattern params for a mode (falls back to the shared legacy value). */
  patternParamsForMode: (modeId: string) => PatternParams;
  /** Set the pattern params for a given mode only. */
  setPatternParamsForMode: (modeId: string, params: PatternParams) => void;
  setFlockingParams: (params: FlockingParams) => void;
  setTarget: (target: Target) => void;
  /** The target for a given mode (falls back to the shared legacy target). */
  targetForMode: (modeId: string) => Target;
  /** Set the target for a given mode only. */
  setTargetForMode: (modeId: string, target: Target) => void;
  /**
   * Move the target in every mode. For choosing a *place* — which is a
   * statement about where you are, not about what you are planning.
   *
   * Pass the place to give the move a memory: adjustments made while that
   * place is active are recorded against it, and selecting it again restores
   * them instead of the place's stored coordinates. The place's declared
   * per-mode config seeds the first visit. Omit it for targets that belong
   * to no place (a preset, a geocoder hit).
   */
  selectPlaceTarget: (target: Target, place?: PlaceSelection) => void;
  /** Restore the active place's corridors to what its dropzone declares. */
  resetFlockingCorridors: () => void;
  /** True when the active place has corridor edits of its own. */
  flockingCorridorsAreCustom: boolean;
  setSettings: (settings: Settings) => void;
  setSelectedCourseId: (id: string | null) => void;

  // Actions
  resetAll: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

interface AppStateProviderProps {
  children: ReactNode;
}

/**
 * Provider for centralized app state management.
 * Stores configs (patternParams, manoeuvreConfig) as the source of truth.
 * Derives FlightPaths (pattern, manoeuvre) via useMemo — no redundant path storage.
 */
export function AppStateProvider({ children }: AppStateProviderProps) {
  // Manoeuvre config — source of truth; path is derived
  const [storedManoeuvreConfig, setStoredManoeuvreConfig] =
    useLocalStorageState<ManoeuvreConfig>(
      'flip.manoeuvre.config',
      DEFAULT_MANOEUVRE_CONFIG,
      { codec: createVersionedCodec(SCHEMA_VERSION, migrateManoeuvreConfig) }
    );
  const manoeuvreConfig = storedManoeuvreConfig ?? DEFAULT_MANOEUVRE_CONFIG;

  // Target state
  const [storedTarget, setStoredTarget] = useLocalStorageState<Target>(
    'flip.target',
    DEFAULT_TARGET,
    { codec: createVersionedCodec(SCHEMA_VERSION, migrateTarget) }
  );
  const target = storedTarget ?? DEFAULT_TARGET;

  // Per-mode targets. Modes plan against different places (a swoop target
  // and a flocking end point are rarely the same), so each mode keeps its
  // own; a mode with no entry yet falls back to the shared legacy target,
  // which is what every existing user has.
  const [storedTargetsByMode, setStoredTargetsByMode] =
    useLocalStorageState<Record<string, Target>>(
      'flip.targets.byMode',
      {},
      { codec: createVersionedCodec(SCHEMA_VERSION, migrateTargetsByMode) }
    );
  const targetsByMode = useMemo(() => storedTargetsByMode ?? {}, [storedTargetsByMode]);

  // Per-place target memory. A dropzone's coordinates are where the database
  // says the DZ is; the spot a user shift-clicks to is where they actually
  // land. Recording the latter against the place means a trip to another DZ
  // and back restores their spot instead of snapping to the database's.
  const [storedActivePlaceId, setStoredActivePlaceId] =
    useLocalStorageState<string | null>('flip.place.active', null);
  const activePlaceId = storedActivePlaceId ?? null;

  const [storedTargetsByPlace, setStoredTargetsByPlace] =
    useLocalStorageState<Record<string, PlaceTargets>>(
      'flip.targets.byPlace',
      {},
      { codec: createVersionedCodec(SCHEMA_VERSION, migrateTargetsByPlace) }
    );
  const targetsByPlace = useMemo(() => storedTargetsByPlace ?? {}, [storedTargetsByPlace]);

  // Pattern params — source of truth; path is derived.
  // Uses the same key as the old PatternComponent so existing user data is preserved.
  const [storedPatternParams, setStoredPatternParams] = useLocalStorageState<PatternParams>(
    'flip.pattern.params',
    DEFAULT_PATTERN_PARAMS,
    { codec: createVersionedCodec(SCHEMA_VERSION, migratePatternParams) }
  );
  const patternParams = storedPatternParams ?? DEFAULT_PATTERN_PARAMS;

  // Per-mode pattern params. A swooper's high descent rate and long legs
  // describe their canopy, not the student pattern next to it, so each mode
  // keeps its own; a mode with no entry yet falls back to the shared legacy
  // value, which is what every existing user has.
  const [storedPatternByMode, setStoredPatternByMode] =
    useLocalStorageState<Record<string, PatternParams>>(
      'flip.pattern.byMode',
      {},
      { codec: createVersionedCodec(SCHEMA_VERSION, migratePatternParamsByMode) }
    );
  const patternByMode = useMemo(() => storedPatternByMode ?? {}, [storedPatternByMode]);

  // Flocking params — source of truth for the flocking mode's math
  const [storedFlockingParams, setStoredFlockingParams] = useLocalStorageState<FlockingParams>(
    'flip.flocking.params',
    DEFAULT_FLOCKING_PARAMS,
    { codec: createVersionedCodec(SCHEMA_VERSION, migrateFlockingParams) }
  );
  const flockingParams = storedFlockingParams ?? DEFAULT_FLOCKING_PARAMS;

  // Settings
  const [storedSettings, setStoredSettings] = useLocalStorageState<Settings>(
    'flip.settings',
    DEFAULT_SETTINGS,
    { codec: createVersionedCodec(SCHEMA_VERSION, migrateSettings) }
  );
  const settings = storedSettings ?? DEFAULT_SETTINGS;

  // Which settings the user has explicitly changed. Pre-tracking users have
  // no stored list (null); their list is seeded from every key whose stored
  // value differs from the global default, which reproduces the old
  // equals-global-default resolution exactly.
  const [storedTouched, setStoredTouched] = useLocalStorageState<TouchedSettings | null>(
    'flip.settings.touched',
    null,
    { codec: TOUCHED_SETTINGS_CODEC }
  );
  const touchedSettings = useMemo(
    () => storedTouched ?? seedTouchedSettings(settings),
    [storedTouched, settings]
  );

  // Selected course
  const [storedSelectedCourseId, setStoredSelectedCourseId] = useLocalStorageState<string | null>(
    'flip.courses.selected',
    null
  );
  const selectedCourseId = storedSelectedCourseId ?? null;

  // Courses belong to a place, so choosing a place has to be able to drop a
  // selection that belongs to another one — which means knowing the user's
  // own courses, not just the built-in list.
  const { customParams } = useCustomCourses();

  // Derived paths — computed from configs, not stored. The pattern path is
  // NOT derived here: how many legs it has depends on the mode (Standard
  // Pattern always flies three), and modes are App's concern, so App owns
  // that derivation. Deriving it here too would give callers a second,
  // silently mode-blind version.
  const manoeuvre = useMemo(() => computeManoeuvre(manoeuvreConfig), [manoeuvreConfig]);

  const setManoeuvreConfig = useCallback(
    (value: ManoeuvreConfig) => setStoredManoeuvreConfig(value),
    [setStoredManoeuvreConfig]
  );

  const setPatternParams = useCallback(
    (value: PatternParams) => setStoredPatternParams(value),
    [setStoredPatternParams]
  );

  const patternParamsForMode = useCallback(
    (modeId: string) => patternByMode[modeId] ?? patternParams,
    [patternByMode, patternParams]
  );

  const setPatternParamsForMode = useCallback(
    (modeId: string, value: PatternParams) => {
      setStoredPatternByMode({ ...patternByMode, [modeId]: value });
    },
    [patternByMode, setStoredPatternByMode]
  );

  // Pinning (or dragging) the Spot Reference is a statement about a point on
  // the ground at the place you are at, so it is remembered with that place —
  // same reasoning as the target. Only a change to the reference itself
  // touches the place record; the rest of the flocking params are headings
  // and distances that travel fine.
  const setFlockingParams = useCallback(
    (value: FlockingParams) => {
      setStoredFlockingParams(value);

      const referenceChanged = value.referencePoint !== flockingParams.referencePoint;
      const corridorsChanged = value.solveCorridors !== flockingParams.solveCorridors;

      if (activePlaceId && (referenceChanged || corridorsChanged)) {
        const entry = targetsByPlace[activePlaceId] ??
          { shared: target, byMode: targetsByMode };

        setStoredTargetsByPlace({
          ...targetsByPlace,
          [activePlaceId]: {
            ...entry,
            flockingReference: value.referencePoint,
            flockingCorridors: value.solveCorridors
          }
        });
      }
    },
    [
      setStoredFlockingParams,
      activePlaceId,
      flockingParams.referencePoint,
      targetsByPlace,
      setStoredTargetsByPlace,
      target,
      targetsByMode
    ]
  );

  const setTarget = useCallback(
    (value: Target) => setStoredTarget(value),
    [setStoredTarget]
  );

  // Persist the new settings and mark every key whose value changed as
  // touched — the only writer is the Settings panel, so a changed key is
  // an explicit user choice.
  const targetForMode = useCallback(
    (modeId: string) => targetsByMode[modeId] ?? target,
    [targetsByMode, target]
  );

  // Every positioning edit (drag, shift-click, heading) is also written
  // through to the active place, so its memory is always current — there is
  // no snapshot-on-leave that could go stale or be lost to a closed tab.
  const setTargetForMode = useCallback(
    (modeId: string, value: Target) => {
      const nextByMode = { ...targetsByMode, [modeId]: value };

      setStoredTargetsByMode(nextByMode);

      if (activePlaceId) {
        setStoredTargetsByPlace({
          ...targetsByPlace,
          [activePlaceId]: { shared: target, byMode: nextByMode }
        });
      }
    },
    [
      targetsByMode,
      setStoredTargetsByMode,
      activePlaceId,
      targetsByPlace,
      setStoredTargetsByPlace,
      target
    ]
  );

  // Dropping the per-mode entries (rather than writing the new target into
  // each of them) is what makes this work for modes the user has never
  // opened: with no override left, every mode reads the shared target.
  const selectPlaceTarget = useCallback(
    (value: Target, place?: PlaceSelection) => {
      const remembered = place ? targetsByPlace[place.id] : undefined;
      const declared = place?.modes;
      const nextPlaceId = place?.id ?? null;
      // A preset carries its own target and overrides every mode with it, so
      // it ignores what was remembered here — but only for the target. The
      // place's Spot Reference and corridors still apply: a preset says
      // nothing about either, and dropping them would lose the user's
      // corridor setup for the dropzone it just took them to.
      const useRememberedTarget = remembered !== undefined && !place?.useGivenTarget;

      // A course is a set of buoys in one pond, so a selection made at another
      // dropzone is meaningless here — and worse than meaningless, because the
      // map pans to the selected course. Unassigned courses (no place of their
      // own) survive the move: they are offered everywhere.
      if (nextPlaceId !== activePlaceId && selectedCourseId) {
        const selected = [...customParams, ...BUILT_IN_PARAMS]
          .find(c => c.id === selectedCourseId);

        if (selected && !courseIsAtPlace(selected, nextPlaceId)) {
          setStoredSelectedCourseId(null);
        }
      }

      setStoredActivePlaceId(nextPlaceId);
      setStoredTarget(useRememberedTarget ? remembered.shared : value);
      // What the user did here wins; failing that, what the dropzone says
      // this mode starts from; failing that, the shared target. A preset
      // clears the per-mode entries so its own target reaches every mode.
      setStoredTargetsByMode(
        useRememberedTarget
          ? remembered.byMode
          : place?.useGivenTarget ? {} : placeModeTargets(declared, value)
      );

      // A Spot Reference left pinned at the old dropzone would be measured
      // against the new one — the flat-earth projection the spot text uses
      // turns that into "4538 mi prior". Restore this place's own (the user's
      // pin, else the DZ's canonical landmark), or unpin.
      const reference = remembered?.flockingReference ??
        declared?.flocking?.spotReference ?? null;
      // Corridors describe a dropzone's own airspace, so they never travel:
      // a place with none configured and nothing remembered has none, rather
      // than inheriting the restrictions of the DZ you just came from.
      const corridors = place
        ? remembered?.flockingCorridors ?? declared?.flocking?.solveCorridors ?? []
        : undefined;

      if (
        reference !== flockingParams.referencePoint ||
        (corridors !== undefined && corridors !== flockingParams.solveCorridors)
      ) {
        setStoredFlockingParams({
          ...flockingParams,
          referencePoint: reference,
          ...(corridors !== undefined ? { solveCorridors: corridors } : {})
        });
      }
    },
    [
      targetsByPlace,
      setStoredActivePlaceId,
      setStoredTarget,
      setStoredTargetsByMode,
      flockingParams,
      setStoredFlockingParams,
      activePlaceId,
      selectedCourseId,
      customParams,
      setStoredSelectedCourseId
    ]
  );

  /**
   * Throw away the corridor edits made at this place and go back to what the
   * dropzone declares — nothing, for a place the database says nothing about.
   */
  const resetFlockingCorridors = useCallback(() => {
    const declared = dropzoneForPlaceId(DROPZONES, activePlaceId)
      ?.modes?.flocking?.solveCorridors ?? [];

    setStoredFlockingParams({ ...flockingParams, solveCorridors: declared });

    if (activePlaceId && targetsByPlace[activePlaceId]) {
      // Forget this place's own corridors so it falls back to the dropzone's
      const entry = { ...targetsByPlace[activePlaceId] };

      delete entry.flockingCorridors;
      setStoredTargetsByPlace({ ...targetsByPlace, [activePlaceId]: entry });
    }
  }, [
    activePlaceId,
    flockingParams,
    setStoredFlockingParams,
    targetsByPlace,
    setStoredTargetsByPlace
  ]);

  /** Whether this place has corridor edits to reset (enables the button). */
  const flockingCorridorsAreCustom = activePlaceId !== null &&
    targetsByPlace[activePlaceId]?.flockingCorridors !== undefined;

  const setSettings = useCallback(
    (value: Settings) => {
      const changed = (Object.keys(value) as (keyof Settings)[]).filter(
        key => JSON.stringify(value[key]) !== JSON.stringify(settings[key])
      );

      if (changed.length > 0) {
        setStoredTouched([...new Set([...touchedSettings, ...changed])]);
      }
      setStoredSettings(value);
    },
    [setStoredSettings, setStoredTouched, settings, touchedSettings]
  );

  const setSelectedCourseId = useCallback(
    (value: string | null) => setStoredSelectedCourseId(value),
    [setStoredSelectedCourseId]
  );

  const resetAll = useCallback(() => {
    setStoredManoeuvreConfig(DEFAULT_MANOEUVRE_CONFIG);
    setStoredTarget(DEFAULT_TARGET);
    setStoredTargetsByMode({});
    setStoredTargetsByPlace({});
    setStoredActivePlaceId(null);
    setStoredPatternParams(DEFAULT_PATTERN_PARAMS);
    setStoredPatternByMode({});
    setStoredFlockingParams(DEFAULT_FLOCKING_PARAMS);
    setStoredSettings(DEFAULT_SETTINGS);
    setStoredTouched([]);
    setStoredSelectedCourseId(null);
  }, [setStoredManoeuvreConfig, setStoredTarget, setStoredTargetsByMode, setStoredTargetsByPlace, setStoredActivePlaceId, setStoredPatternParams, setStoredPatternByMode, setStoredFlockingParams, setStoredSettings, setStoredTouched, setStoredSelectedCourseId]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      manoeuvre,
      manoeuvreConfig,
      patternParams,
      flockingParams,
      target,
      settings,
      touchedSettings,
      selectedCourseId,
      activePlaceId,
      setManoeuvreConfig,
      setPatternParams,
      patternParamsForMode,
      setPatternParamsForMode,
      setFlockingParams,
      setTarget,
      targetForMode,
      setTargetForMode,
      selectPlaceTarget,
      resetFlockingCorridors,
      flockingCorridorsAreCustom,
      setSettings,
      setSelectedCourseId,
      resetAll
    }),
    [
      manoeuvre,
      manoeuvreConfig,
      patternParams,
      flockingParams,
      target,
      settings,
      touchedSettings,
      selectedCourseId,
      activePlaceId,
      setManoeuvreConfig,
      setPatternParams,
      patternParamsForMode,
      setPatternParamsForMode,
      setFlockingParams,
      setTarget,
      targetForMode,
      setTargetForMode,
      selectPlaceTarget,
      resetFlockingCorridors,
      flockingCorridorsAreCustom,
      setSettings,
      setSelectedCourseId,
      resetAll
    ]
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

/**
 * Hook to access the centralized app state.
 * Must be used within an AppStateProvider.
 */
export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}

// Re-export defaults for use elsewhere
export { DEFAULT_TARGET, DEFAULT_SETTINGS };
