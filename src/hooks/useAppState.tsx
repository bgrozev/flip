import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React, { createContext, useContext, useCallback, ReactNode, useMemo } from 'react';

import { FlightPath, ManoeuvreConfig, PatternParams, Settings, Target } from '../types';
import { createSafeCodec, createSimpleCodec } from '../util/storage';
import { DEFAULT_UNIT_PREFERENCES } from '../util/units';
import { makePatternByType } from '../util/pattern';
import { createManoeuvrePath } from '../util/manoeuvre';
import { mirror } from '../util/geo';
import { samples } from '../samples';

// Default values
const DEFAULT_TARGET: Target = {
  target: {
    lat: 28.21887,
    lng: -82.15122
  },
  finalHeading: 270
};

export const DEFAULT_PATTERN_PARAMS: PatternParams = {
  type: 'three-leg',
  descentRateMph: 9,
  glideRatio: 3.0,
  legs: [
    { altitude: 300, direction: 0 },
    { altitude: 300, direction: 270 },
    { altitude: 300, direction: 270 }
  ]
};

export const DEFAULT_MANOEUVRE_CONFIG: ManoeuvreConfig = { type: 'none' };

const DEFAULT_SETTINGS: Settings = {
  showPoms: true,
  showPomAltitudes: true,
  showPomTooltips: true,
  showPreWind: true,
  displayWindArrow: false,
  displayWindSummary: true,
  interpolateWind: true,
  correctPatternHeading: true,
  straightenLegs: true,
  useDzGroundWind: true,
  limitWind: 3000,
  showPresets: true,
  showMeasureTool: false,
  highlightCorrespondingPoints: true,
  units: DEFAULT_UNIT_PREFERENCES
};

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

  const offset = config.initiationAltitudeOffset;

  if (offset && offset !== 0 && path.length > 0) {
    const originalInitAlt = path[path.length - 1].properties.alt;
    const maxDelta = originalInitAlt * 0.15;
    const clampedNewAlt = Math.min(
      Math.max(originalInitAlt + offset, originalInitAlt - maxDelta),
      originalInitAlt + maxDelta
    );
    const scale = clampedNewAlt / originalInitAlt;

    path = path.map(p => ({
      ...p,
      geometry: { ...p.geometry },
      properties: { ...p.properties, alt: p.properties.alt * scale }
    }));
  }

  return path;
}

// Context value type
interface AppStateContextValue {
  // Derived paths (for rendering)
  manoeuvre: FlightPath;
  pattern: FlightPath;

  // Config state (source of truth for presets)
  manoeuvreConfig: ManoeuvreConfig;
  patternParams: PatternParams;
  target: Target;
  settings: Settings;

  // Setters
  setManoeuvreConfig: (config: ManoeuvreConfig) => void;
  setPatternParams: (params: PatternParams) => void;
  setTarget: (target: Target) => void;
  setSettings: (settings: Settings) => void;

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
      { codec: createSimpleCodec<ManoeuvreConfig>(DEFAULT_MANOEUVRE_CONFIG) }
    );
  const manoeuvreConfig = storedManoeuvreConfig ?? DEFAULT_MANOEUVRE_CONFIG;

  // Target state
  const [storedTarget, setStoredTarget] = useLocalStorageState<Target>(
    'flip.target',
    DEFAULT_TARGET,
    { codec: createSafeCodec(DEFAULT_TARGET) }
  );
  const target = storedTarget ?? DEFAULT_TARGET;

  // Pattern params — source of truth; path is derived.
  // Uses the same key as the old PatternComponent so existing user data is preserved.
  const [storedPatternParams, setStoredPatternParams] = useLocalStorageState<PatternParams>(
    'flip.pattern.params',
    DEFAULT_PATTERN_PARAMS,
    { codec: createSafeCodec(DEFAULT_PATTERN_PARAMS) }
  );
  const patternParams = storedPatternParams ?? DEFAULT_PATTERN_PARAMS;

  // Settings
  const [storedSettings, setStoredSettings] = useLocalStorageState<Settings>(
    'flip.settings',
    DEFAULT_SETTINGS,
    { codec: createSafeCodec(DEFAULT_SETTINGS) }
  );
  const settings = storedSettings ?? DEFAULT_SETTINGS;

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

  const setTarget = useCallback(
    (value: Target) => setStoredTarget(value),
    [setStoredTarget]
  );

  const setSettings = useCallback(
    (value: Settings) => setStoredSettings(value),
    [setStoredSettings]
  );

  const resetAll = useCallback(() => {
    setStoredManoeuvreConfig(DEFAULT_MANOEUVRE_CONFIG);
    setStoredTarget(DEFAULT_TARGET);
    setStoredPatternParams(DEFAULT_PATTERN_PARAMS);
    setStoredSettings(DEFAULT_SETTINGS);
  }, [setStoredManoeuvreConfig, setStoredTarget, setStoredPatternParams, setStoredSettings]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      manoeuvre,
      pattern,
      manoeuvreConfig,
      patternParams,
      target,
      settings,
      setManoeuvreConfig,
      setPatternParams,
      setTarget,
      setSettings,
      resetAll
    }),
    [
      manoeuvre,
      pattern,
      manoeuvreConfig,
      patternParams,
      target,
      settings,
      setManoeuvreConfig,
      setPatternParams,
      setTarget,
      setSettings,
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
