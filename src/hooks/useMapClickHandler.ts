import * as turf from '@turf/turf';
import { useCallback, useState } from 'react';

import { LatLng, Target } from '../types';
import { latLngToPoint } from '../util/coords';
import { normalizeBearing } from '../util/geo';

interface UseMapClickHandlerOptions {
  /** Current target (needed for preserving heading when only selecting location) */
  currentTarget: Target;
  /** Callback when a new target is selected */
  onTargetSelected: (target: Target) => void;
  /** Optional callback to navigate to map view (for mobile) */
  onNavigateToMap?: () => void;
}

interface UseMapClickHandlerResult {
  /** Call this when the map is clicked */
  handleMapClick: (point: LatLng) => void;
  /** Start selecting a target from the map. If withHeading=true, requires two clicks. */
  selectFromMap: (withHeading: boolean) => void;
  /** Whether we're waiting for a click (show crosshair cursor, etc.) */
  isWaitingForClick: boolean;
  /** Cancel any in-progress selection */
  cancelSelection: () => void;
}

/**
 * Hook to manage map click interactions for selecting a target location and heading.
 *
 * Supports two modes:
 * 1. Single click: Select target location only (preserves current heading)
 * 2. Two clicks: First click sets location, second click sets heading direction
 */
export function useMapClickHandler({
  currentTarget,
  onTargetSelected,
  onNavigateToMap
}: UseMapClickHandlerOptions): UseMapClickHandlerResult {
  // Click state machine:
  // idle -> waitingForClick1 (after selectFromMap)
  // waitingForClick1 -> idle (single click mode, target selected)
  // waitingForClick1 -> waitingForClick2 (two click mode, first point captured)
  // waitingForClick2 -> idle (second click, heading calculated)
  const [waitingForClick1, setWaitingForClick1] = useState(false);
  const [waitingForClick2, setWaitingForClick2] = useState(false);
  const [selectHeading, setSelectHeading] = useState(false);
  const [click1, setClick1] = useState<LatLng | undefined>(undefined);

  const resetState = useCallback(() => {
    setWaitingForClick1(false);
    setWaitingForClick2(false);
    setSelectHeading(false);
    setClick1(undefined);
  }, []);

  const selectFromMap = useCallback(
    (withHeading: boolean) => {
      setWaitingForClick1(true);
      setWaitingForClick2(false);
      setSelectHeading(withHeading);
      setClick1(undefined);
      onNavigateToMap?.();
    },
    [onNavigateToMap]
  );

  const handleMapClick = useCallback(
    (point: LatLng) => {
      if (waitingForClick1) {
        if (selectHeading) {
          // Two-click mode: first click captures location
          setClick1(point);
          setWaitingForClick1(false);
          setWaitingForClick2(true);
        } else {
          // Single-click mode: select location, keep current heading
          const updated: Target = {
            target: point,
            finalHeading: currentTarget.finalHeading
          };
          onTargetSelected(updated);
          resetState();
        }
      } else if (waitingForClick2 && click1) {
        // Two-click mode: second click determines heading
        const pointTurf = latLngToPoint(point);
        const click1Turf = latLngToPoint(click1);
        const updated: Target = {
          target: click1,
          finalHeading: normalizeBearing(Math.round(turf.bearing(pointTurf, click1Turf)))
        };
        onTargetSelected(updated);
        resetState();
      } else {
        // Not in selection mode - navigate to map on mobile
        onNavigateToMap?.();
      }
    },
    [
      waitingForClick1,
      waitingForClick2,
      selectHeading,
      click1,
      currentTarget.finalHeading,
      onTargetSelected,
      onNavigateToMap,
      resetState
    ]
  );

  const cancelSelection = useCallback(() => {
    resetState();
  }, [resetState]);

  return {
    handleMapClick,
    selectFromMap,
    isWaitingForClick: waitingForClick1 || waitingForClick2,
    cancelSelection
  };
}
