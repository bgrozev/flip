import { useMemo } from 'react';

import { FlightPath, LatLng, Target } from '../types';
import {
  FlockingParams,
  FlockingVectors,
  SpotDescription,
  flockingVectors,
  intoWindDirection,
  makeFlockingPath,
  spotDescription
} from '../core/flocking';
import { addWind, averageWind, translate } from '../core/geometry';
import { latLngToPoint } from '../core/coords';
import { AltitudeUnit } from '../core/units';
import { WindProfile } from '../core/wind';

/** POM label interval: 1000 ft, or ~250 m for metric users. */
const POM_INTERVAL_FT = 1000;
const POM_INTERVAL_METRIC_FT = 820.2; // 250 m

export interface FlockingDerived {
  /** No-wind descent path, end fixed at the target. */
  ideal: FlightPath;
  /** Wind-corrected descent path; its LAST point is the exit spot. */
  corrected: FlightPath;
  /** The exit spot, or null when the window is empty. */
  exit: LatLng | null;
  /** Resolved jumprun direction (into-wind resolved from the winds). */
  jumprunDeg: number;
  /** The FWC drift block: wind drift / canopy flight / combined. */
  vectors: FlockingVectors | null;
  /** FWC spot description relative to `reference`. */
  spot: SpotDescription | null;
  /** Effective reference point: pinned C, or the target. */
  reference: LatLng;
  /** Whether the wind profile has any non-calm rows. */
  hasWind: boolean;
  /** Average wind over the window (for the toolbar summary / wind arrow). */
  averageWind: { speedKts?: number; direction?: number };
}

interface UseFlockingPathParams {
  /** Only derive when the flocking mode is active. */
  active: boolean;
  params: FlockingParams;
  target: Target;
  winds: WindProfile;
  interpolateWind: boolean;
  altitudeUnit: AltitudeUnit;
}

const EMPTY: FlockingDerived = {
  ideal: [],
  corrected: [],
  exit: null,
  jumprunDeg: 0,
  vectors: null,
  spot: null,
  reference: { lat: 0, lng: 0 },
  hasWind: false,
  averageWind: {}
};

/**
 * The flocking derive pipeline: resolve the jumprun direction (into-wind
 * uses the wind profile), build the descent path, position it at the
 * target, apply wind, and describe the exit spot relative to the pinned
 * reference point (or the target). Memoized on its actual inputs; returns
 * an inert empty result when the mode is not active.
 */
export function useFlockingPath({
  active,
  params,
  target,
  winds,
  interpolateWind,
  altitudeUnit
}: UseFlockingPathParams): FlockingDerived {
  return useMemo(() => {
    if (!active) {
      return EMPTY;
    }

    const hasWind = winds.winds.some(row => row.speedKts > 0);
    const jumprunDeg = params.direction === 'into-wind'
      ? intoWindDirection(
        winds,
        params.windowTopFt,
        params.windowBottomFt,
        params.descentRateMph,
        interpolateWind
      )
      : params.direction;

    const raw = makeFlockingPath({
      windowTopFt: params.windowTopFt,
      windowBottomFt: params.windowBottomFt,
      descentRateMph: params.descentRateMph,
      horizontalSpeedMph: params.horizontalSpeedMph,
      directionDeg: jumprunDeg,
      pomIntervalFt: altitudeUnit === 'm' ? POM_INTERVAL_METRIC_FT : POM_INTERVAL_FT
    });

    const ideal = translate(raw, latLngToPoint(target.target));
    const corrected = addWind(ideal, winds, interpolateWind);

    const exitPoint = corrected.length > 1 ? corrected[corrected.length - 1] : null;
    const exit: LatLng | null = exitPoint
      ? { lat: exitPoint.geometry.coordinates[1], lng: exitPoint.geometry.coordinates[0] }
      : null;

    const reference = params.referencePoint ?? target.target;

    return {
      ideal,
      corrected,
      exit,
      jumprunDeg,
      vectors: flockingVectors(ideal, corrected),
      spot: exit ? spotDescription(exit, reference, jumprunDeg) : null,
      reference,
      hasWind,
      averageWind: averageWind(ideal, corrected)
    };
  }, [active, params, target.target, winds, interpolateWind, altitudeUnit]);
}
