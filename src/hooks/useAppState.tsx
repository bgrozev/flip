import { useLocalStorageState } from '@toolpad/core/useLocalStorageState';
import React, { createContext, useContext, useCallback, ReactNode, useMemo } from 'react';

import { FlightPath, Settings, Target } from '../types';
import { CODEC_JSON } from '../util/util';
import { defaultPattern } from '../components/PatternComponent';

// Default values
const DEFAULT_TARGET: Target = {
  target: {
    lat: 28.21887,
    lng: -82.15122
  },
  finalHeading: 270
};

const DEFAULT_SETTINGS: Settings = {
  showPreWind: true,
  showPoms: true,
  showPomAltitudes: true,
  useDzGroundWind: true,
  interpolateWind: true,
  displayWindArrow: false,
  displayWindSummary: true,
  correctPatternHeading: true,
  limitWind: 3000
};

// Storage keys
const STORAGE_KEYS = {
  manoeuvre: 'flip.manoeuvre_turf',
  target: 'flip.target',
  pattern: 'flip.pattern_turf',
  settings: 'flip.settings'
} as const;

// Context value type
interface AppStateContextValue {
  // State
  manoeuvre: FlightPath;
  target: Target;
  pattern: FlightPath;
  settings: Settings;

  // Setters
  setManoeuvre: (manoeuvre: FlightPath) => void;
  setTarget: (target: Target) => void;
  setPattern: (pattern: FlightPath) => void;
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
 * Handles persistence to localStorage for core app state.
 */
export function AppStateProvider({ children }: AppStateProviderProps) {
  // Manoeuvre state
  const [storedManoeuvre, setStoredManoeuvre] = useLocalStorageState<FlightPath>(
    STORAGE_KEYS.manoeuvre,
    [],
    { codec: CODEC_JSON }
  );
  const manoeuvre = storedManoeuvre ?? [];

  // Target state
  const [storedTarget, setStoredTarget] = useLocalStorageState<Target>(
    STORAGE_KEYS.target,
    DEFAULT_TARGET,
    { codec: CODEC_JSON }
  );
  const target = storedTarget ?? DEFAULT_TARGET;

  // Pattern state
  const [storedPattern, setStoredPattern] = useLocalStorageState<FlightPath>(
    STORAGE_KEYS.pattern,
    defaultPattern,
    { codec: CODEC_JSON }
  );
  const pattern = storedPattern ?? defaultPattern;

  // Settings state
  const [storedSettings, setStoredSettings] = useLocalStorageState<Settings>(
    STORAGE_KEYS.settings,
    DEFAULT_SETTINGS,
    { codec: CODEC_JSON }
  );
  const settings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...storedSettings }),
    [storedSettings]
  );

  // Wrapped setters with null handling
  const setManoeuvre = useCallback((value: FlightPath) => {
    setStoredManoeuvre(value);
  }, [setStoredManoeuvre]);

  const setTarget = useCallback((value: Target) => {
    setStoredTarget(value);
  }, [setStoredTarget]);

  const setPattern = useCallback((value: FlightPath) => {
    setStoredPattern(value);
  }, [setStoredPattern]);

  const setSettings = useCallback((value: Settings) => {
    setStoredSettings({ ...DEFAULT_SETTINGS, ...value });
  }, [setStoredSettings]);

  // Reset all state to defaults
  const resetAll = useCallback(() => {
    setStoredManoeuvre([]);
    setStoredTarget(DEFAULT_TARGET);
    setStoredPattern(defaultPattern);
    setStoredSettings(DEFAULT_SETTINGS);
  }, [setStoredManoeuvre, setStoredTarget, setStoredPattern, setStoredSettings]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      manoeuvre,
      target,
      pattern,
      settings,
      setManoeuvre,
      setTarget,
      setPattern,
      setSettings,
      resetAll
    }),
    [
      manoeuvre,
      target,
      pattern,
      settings,
      setManoeuvre,
      setTarget,
      setPattern,
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
