import React, { createContext, useContext, ReactNode } from 'react';

import { LatLng, Target } from '../types';

interface TargetContextValue {
  /** Current target (location + heading) */
  target: Target;
  /** Update the target in the current mode only (drag, heading, ...) */
  setTarget: (target: Target) => void;
  /**
   * Select a place: moves the target in EVERY mode, because which dropzone
   * you are at is not a per-mode choice. Optionally sets the heading too.
   */
  selectLocation: (location: LatLng, heading?: number) => void;
}

const TargetContext = createContext<TargetContextValue | null>(null);

interface TargetProviderProps {
  target: Target;
  setTarget: (target: Target) => void;
  /**
   * Applies a chosen place. Defaults to `setTarget` (current mode only) so
   * the provider stays usable on its own; App passes the every-mode setter.
   */
  selectPlace?: (target: Target) => void;
  children: ReactNode;
}

/**
 * Provider for target location context.
 * Wrap location-related components to avoid prop drilling.
 */
export function TargetProvider({
  target,
  setTarget,
  selectPlace,
  children
}: TargetProviderProps) {
  const selectLocation = (location: LatLng, heading?: number) => {
    (selectPlace ?? setTarget)({
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
