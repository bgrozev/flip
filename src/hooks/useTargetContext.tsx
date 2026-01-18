import React, { createContext, useContext, ReactNode } from 'react';

import { LatLng, Target } from '../types';

interface TargetContextValue {
  /** Current target (location + heading) */
  target: Target;
  /** Update the target */
  setTarget: (target: Target) => void;
  /** Convenience method to select a location, optionally with heading */
  selectLocation: (location: LatLng, heading?: number) => void;
}

const TargetContext = createContext<TargetContextValue | null>(null);

interface TargetProviderProps {
  target: Target;
  setTarget: (target: Target) => void;
  children: ReactNode;
}

/**
 * Provider for target location context.
 * Wrap location-related components to avoid prop drilling.
 */
export function TargetProvider({ target, setTarget, children }: TargetProviderProps) {
  const selectLocation = (location: LatLng, heading?: number) => {
    setTarget({
      target: location,
      finalHeading: heading ?? target.finalHeading
    });
  };

  return (
    <TargetContext.Provider value={{ target, setTarget, selectLocation }}>
      {children}
    </TargetContext.Provider>
  );
}

/**
 * Hook to access target context.
 * Must be used within a TargetProvider.
 */
export function useTarget(): TargetContextValue {
  const context = useContext(TargetContext);
  if (!context) {
    throw new Error('useTarget must be used within a TargetProvider');
  }
  return context;
}
