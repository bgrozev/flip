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
  migrateSettings,
  migrateTarget,
  migrateTargetsByMode,
  migrateTouchedSettings,
  seedTouchedSettings
} from '../core/model';
import { FlockingParams } from '../core/flocking';
import { FlightPath, ManoeuvreConfig, PatternParams, Settings, Target } from '../types';
import { createVersionedCodec } from '../util/storage';
import { makePatternByType } from '../core/pattern';
import { applyInitiationAltitudeOffset, createManoeuvrePath } from '../core/manoeuvre';
import { mirror } from '../core/geometry';
import { samples } from '../samples';

// Canonical defaults live in core/model; re-exported here for existing users
export { DEFAULT_PATTERN_PARAMS, DEFAULT_MANOEUVRE_CONFIG };

/** The settings keys the user has explicitly changed. */
type TouchedSettings = (keyof Settings)[];

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
  pattern: FlightPath;

  // Config state (source of truth for presets)
  manoeuvreConfig: ManoeuvreConfig;
  patternParams: PatternParams;
  flockingParams: FlockingParams;
  target: Target;
  settings: Settings;
  /** Settings keys the user has explicitly changed (mode defaults skip these). */
  touchedSettings: readonly (keyof Settings)[];
  selectedCourseId: string | null;

  // Setters
  setManoeuvreConfig: (config: ManoeuvreConfig) => void;
  setPatternParams: (params: PatternParams) => void;
  setFlockingParams: (params: FlockingParams) => void;
  setTarget: (target: Target) => void;
  /** The target for a given mode (falls back to the shared legacy target). */
  targetForMode: (modeId: string) => Target;
  /** Set the target for a given mode only. */
  setTargetForMode: (modeId: string, target: Target) => void;
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

  // Pattern params — source of truth; path is derived.
  // Uses the same key as the old PatternComponent so existing user data is preserved.
  const [storedPatternParams, setStoredPatternParams] = useLocalStorageState<PatternParams>(
    'flip.pattern.params',
    DEFAULT_PATTERN_PARAMS,
    { codec: createVersionedCodec(SCHEMA_VERSION, migratePatternParams) }
  );
  const patternParams = storedPatternParams ?? DEFAULT_PATTERN_PARAMS;

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

  // Derived paths — computed from configs, not stored
  const manoeuvre = useMemo(() => computeManoeuvre(manoeuvreConfig), [manoeuvreConfig]);
  const pattern = useMemo(() => makePatternByType(patternParams), [patternParams]);

  const setManoeuvreConfig = useCallback(
    (value: ManoeuvreConfig) => setStoredManoeuvreConfig(value),
    [setStoredManoeuvreConfig]
  );

  const setPatternParams = useCallback(
    (value: PatternParams) => setStoredPatternParams(value),
    [setStoredPatternParams]
  );

  const setFlockingParams = useCallback(
    (value: FlockingParams) => setStoredFlockingParams(value),
    [setStoredFlockingParams]
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

  const setTargetForMode = useCallback(
    (modeId: string, value: Target) => {
      setStoredTargetsByMode({ ...targetsByMode, [modeId]: value });
    },
    [targetsByMode, setStoredTargetsByMode]
  );

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
    setStoredPatternParams(DEFAULT_PATTERN_PARAMS);
    setStoredFlockingParams(DEFAULT_FLOCKING_PARAMS);
    setStoredSettings(DEFAULT_SETTINGS);
    setStoredTouched([]);
    setStoredSelectedCourseId(null);
  }, [setStoredManoeuvreConfig, setStoredTarget, setStoredTargetsByMode, setStoredPatternParams, setStoredFlockingParams, setStoredSettings, setStoredTouched, setStoredSelectedCourseId]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      manoeuvre,
      pattern,
      manoeuvreConfig,
      patternParams,
      flockingParams,
      target,
      settings,
      touchedSettings,
      selectedCourseId,
      setManoeuvreConfig,
      setPatternParams,
      setFlockingParams,
      setTarget,
      targetForMode,
      setTargetForMode,
      setSettings,
      setSelectedCourseId,
      resetAll
    }),
    [
      manoeuvre,
      pattern,
      manoeuvreConfig,
      patternParams,
      flockingParams,
      target,
      settings,
      touchedSettings,
      selectedCourseId,
      setManoeuvreConfig,
      setPatternParams,
      setFlockingParams,
      setTarget,
      targetForMode,
      setTargetForMode,
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
