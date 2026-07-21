import { useMemo } from 'react';

import { FlightPath, FlightPoint, LatLng, Target } from '../types';
import {
  CANOPY_DEVIATION_WARN_DEG,
  FlockingParams,
  FlockingVectors,
  JumprunLine,
  SpotDescription,
  flockingVectors,
  intoWindDirection,
  jumprunLineOrigin,
  localMilesEN,
  makeFlockingPath,
  pointAlongJumprun,
  spotDescription
} from '../core/flocking';
import { driftAngle } from '../core/pathStats';
import { addWind, averageWind, translate } from '../core/geometry';
import { latLngToPoint } from '../core/coords';
import { AltitudeUnit } from '../core/units';
import { WindProfile } from '../core/wind';

/** POM label interval: 1000 ft, or ~250 m for metric users. */
const POM_INTERVAL_FT = 1000;
const POM_INTERVAL_METRIC_FT = 820.2; // 250 m

export interface FlockingDerived {
  /** No-wind descent path (ghost). */
  ideal: FlightPath;
  /** Wind-corrected descent path; last point = exit. */
  corrected: FlightPath;
  /** The exit spot. */
  exit: LatLng | null;
  /** Where the flight ends (point[0] of the corrected path). */
  end: LatLng | null;
  /** Distance from the end to the target, miles (free mode; null in classic). */
  missMi: number | null;
  /** Whether the end lands inside the target area (always true in classic). */
  onTarget: boolean;
  /** Resolved jumprun direction. */
  jumprunDeg: number;
  /** Resolved canopy flight direction. */
  canopyDeg: number;
  /** The current into-wind direction (for quick-set buttons). */
  intoWindDeg: number;
  /** Free mode: canopy deviates from the jumprun by more than the warn limit. */
  canopyDeviationWarning: boolean;
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
  /** The jumprun line (free mode; null in classic — the run ends at the exit). */
  jumprunLine: JumprunLine | null;
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
  end: null,
  missMi: null,
  onTarget: true,
  jumprunDeg: 0,
  canopyDeg: 0,
  intoWindDeg: 0,
  canopyDeviationWarning: false,
  vectors: null,
  spot: null,
  reference: { lat: 0, lng: 0 },
  hasWind: false,
  averageWind: {},
  jumprunLine: null
};

/** Rigidly shift every point of a path by a flat lng/lat delta. */
function shiftPath(path: FlightPath, dLng: number, dLat: number): FlightPath {
  if (dLng === 0 && dLat === 0) {
    return path;
  }

  return path.map(p => ({
    ...p,
    geometry: {
      ...p.geometry,
      coordinates: [p.geometry.coordinates[0] + dLng, p.geometry.coordinates[1] + dLat]
    }
  })) as FlightPath;
}

function pointToLatLng(p: FlightPoint): LatLng {
  return { lat: p.geometry.coordinates[1], lng: p.geometry.coordinates[0] };
}

/**
 * The flocking derive pipeline, per the panel sub-mode:
 *
 * - classic (FWC): the user picks the canopy flight direction; the jumprun
 *   IS that direction, leaving a unique exit — the wind-blown last point of
 *   the path anchored end-at-target. No miss (the end is the target by
 *   construction).
 * - free: the user owns the jumprun line (direction + offset), the exit
 *   position on it and the canopy direction (default: follow the jumprun).
 *   The configured flight is anchored at the chosen exit; the end, its
 *   distance to the target and the target-area verdict are reported.
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
    const pomIntervalFt = altitudeUnit === 'm' ? POM_INTERVAL_METRIC_FT : POM_INTERVAL_FT;
    const reference = params.referencePoint ?? target.target;
    const intoWindDeg = intoWindDirection(
      winds,
      params.windowTopFt,
      params.windowBottomFt,
      params.descentRateMph,
      interpolateWind
    );

    const free = params.mode === 'free';
    const jumprunDeg = free
      ? params.jumprun.directionDeg === 'into-wind'
        ? intoWindDeg
        : params.jumprun.directionDeg
      : params.direction === 'into-wind' ? intoWindDeg : params.direction;
    const canopyDeg = free
      ? params.canopyDirection === 'follow-jumprun' ? jumprunDeg : params.canopyDirection
      : jumprunDeg;

    const raw = makeFlockingPath({
      windowTopFt: params.windowTopFt,
      windowBottomFt: params.windowBottomFt,
      descentRateMph: params.descentRateMph,
      horizontalSpeedMph: params.horizontalSpeedMph,
      directionDeg: canopyDeg,
      pomIntervalFt
    });

    const idealAtTarget = translate(raw, latLngToPoint(target.target));
    const correctedAtTarget = addWind(idealAtTarget, winds, interpolateWind);

    if (correctedAtTarget.length < 2) {
      return { ...EMPTY, reference, hasWind, jumprunDeg, canopyDeg, intoWindDeg };
    }

    if (!free) {
      // Classic: unique solution, end at the target, exit wind-blown.
      const exit = pointToLatLng(correctedAtTarget[correctedAtTarget.length - 1]);

      return {
        ideal: idealAtTarget,
        corrected: correctedAtTarget,
        exit,
        end: target.target,
        missMi: null,
        onTarget: true,
        jumprunDeg,
        canopyDeg,
        intoWindDeg,
        canopyDeviationWarning: false,
        vectors: flockingVectors(idealAtTarget, correctedAtTarget),
        spot: spotDescription(exit, reference, jumprunDeg),
        reference,
        hasWind,
        averageWind: averageWind(idealAtTarget, correctedAtTarget),
        jumprunLine: null
      };
    }

    // Free: anchor the flight at the chosen exit on the jumprun line.
    const jumprunLine: JumprunLine = {
      origin: jumprunLineOrigin(reference, jumprunDeg, params.jumprun.offsetMi),
      directionDeg: jumprunDeg
    };
    const exit = pointAlongJumprun(jumprunLine, params.exitAlongMi);

    const exitAtTarget = pointToLatLng(correctedAtTarget[correctedAtTarget.length - 1]);
    const dLng = exit.lng - exitAtTarget.lng;
    const dLat = exit.lat - exitAtTarget.lat;
    const ideal = shiftPath(idealAtTarget, dLng, dLat);
    const corrected = shiftPath(correctedAtTarget, dLng, dLat);

    const end = pointToLatLng(corrected[0]);
    const missEN = localMilesEN(end, target.target);
    const missMi = Math.hypot(missEN.eastMi, missEN.northMi);

    return {
      ideal,
      corrected,
      exit,
      end,
      missMi,
      onTarget: missMi <= params.targetRadiusMi + 1e-9,
      jumprunDeg,
      canopyDeg,
      intoWindDeg,
      canopyDeviationWarning: driftAngle(canopyDeg, jumprunDeg) > CANOPY_DEVIATION_WARN_DEG,
      vectors: flockingVectors(ideal, corrected),
      spot: spotDescription(exit, reference, jumprunDeg),
      reference,
      hasWind,
      averageWind: averageWind(ideal, corrected),
      jumprunLine
    };
  }, [active, params, target.target, winds, interpolateWind, altitudeUnit]);
}
