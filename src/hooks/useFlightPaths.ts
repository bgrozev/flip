import { useMemo } from 'react';

import { FlightPath, Target } from '../types';
import { addWind, averageWind, reposition, straightenLegs } from '../core/geometry';
import { WindProfile } from '../core/wind';

export interface FlightPaths {
  /** Ideal path (manoeuvre + pattern repositioned to the target), no wind */
  ideal: FlightPath;
  /** Wind-corrected path */
  corrected: FlightPath;
  /** Wind-corrected path for display (legs optionally straightened) */
  display: FlightPath;
  /** Average wind effect between the ideal and corrected paths */
  averageWind: { speedKts?: number; direction?: number };
}

interface UseFlightPathsParams {
  manoeuvre: FlightPath;
  pattern: FlightPath;
  target: Target;
  winds: WindProfile;
  correctPatternHeading: boolean;
  interpolateWind: boolean;
  straightenLegsEnabled: boolean;
}

/**
 * The derive pipeline: reposition → addWind → straightenLegs + averageWind,
 * memoized on its actual inputs so the turf-heavy math runs once per input
 * change instead of on every render.
 */
export function useFlightPaths({
  manoeuvre,
  pattern,
  target,
  winds,
  correctPatternHeading,
  interpolateWind,
  straightenLegsEnabled
}: UseFlightPathsParams): FlightPaths {
  return useMemo(() => {
    const ideal = reposition(manoeuvre, pattern, target, correctPatternHeading);
    const corrected = addWind(ideal, winds, interpolateWind);
    const display = straightenLegsEnabled ? straightenLegs(corrected) : corrected;

    return {
      ideal,
      corrected,
      display,
      averageWind: averageWind(ideal, corrected)
    };
  }, [
    manoeuvre,
    pattern,
    target,
    winds,
    correctPatternHeading,
    interpolateWind,
    straightenLegsEnabled
  ]);
}
