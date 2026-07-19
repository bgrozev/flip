import { useMemo } from 'react';

import { FlightPath, FlightPoint, LatLng, Target } from '../types';
import {
  CanopySolution,
  FlockingParams,
  FlockingVectors,
  JumprunLine,
  SpotDescription,
  bestExitAlongMi,
  flockingDurationS,
  flockingVectors,
  intoWindDirection,
  jumprunLineOrigin,
  makeFlockingPath,
  pointAlongJumprun,
  reachableJumprunSegment,
  solveCanopyFlight,
  spotDescription,
  windDriftVector
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
  /** The current into-wind direction (for quick-set), always resolved. */
  intoWindDeg: number;
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
  /** The pinned jumprun line, or null in auto mode. */
  jumprunLine: JumprunLine | null;
  /** Reachable exit interval along the pinned line (signed mi), or null. */
  reachableSegment: { tMinMi: number; tMaxMi: number } | null;
  /** Solved canopy flight for the chosen exit (pinned mode only). */
  canopy: CanopySolution | null;
  /** Resolved exit position along the pinned line (signed mi). */
  exitAlongMi: number | null;
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
  intoWindDeg: 0,
  vectors: null,
  spot: null,
  reference: { lat: 0, lng: 0 },
  hasWind: false,
  averageWind: {},
  jumprunLine: null,
  reachableSegment: null,
  canopy: null,
  exitAlongMi: null
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
 * The flocking derive pipeline.
 *
 * Auto mode: the jumprun direction is the canopy flight direction
 * (into-wind resolved from the winds); the descent path is built, positioned
 * at the target and wind-corrected, and its wind-blown last point is the
 * exit spot.
 *
 * Pinned mode: the jumprun is a fixed line (direction + lateral offset from
 * the Spot Reference); the exit is a chosen position on it. The wind drift W
 * over the window is fixed, so the canopy must cover D = target − exit − W
 * through the air; the required heading/speed and the target's reachability
 * are solved, and the rendered path is anchored at the pinned exit. Memoized
 * on its inputs; inert when the mode is not active.
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

    if (params.jumprun.mode === 'pinned') {
      return derivePinned({
        params,
        jumprun: params.jumprun,
        target: target.target,
        reference,
        winds,
        interpolateWind,
        pomIntervalFt,
        hasWind,
        intoWindDeg
      });
    }

    // Auto mode: jumprun == canopy flight direction.
    const jumprunDeg = params.direction === 'into-wind' ? intoWindDeg : params.direction;

    const raw = makeFlockingPath({
      windowTopFt: params.windowTopFt,
      windowBottomFt: params.windowBottomFt,
      descentRateMph: params.descentRateMph,
      horizontalSpeedMph: params.horizontalSpeedMph,
      directionDeg: jumprunDeg,
      pomIntervalFt
    });

    const ideal = translate(raw, latLngToPoint(target.target));
    const corrected = addWind(ideal, winds, interpolateWind);

    const exitPoint = corrected.length > 1 ? corrected[corrected.length - 1] : null;
    const exit = exitPoint ? pointToLatLng(exitPoint) : null;

    return {
      ideal,
      corrected,
      exit,
      jumprunDeg,
      intoWindDeg,
      vectors: flockingVectors(ideal, corrected),
      spot: exit ? spotDescription(exit, reference, jumprunDeg) : null,
      reference,
      hasWind,
      averageWind: averageWind(ideal, corrected),
      jumprunLine: null,
      reachableSegment: null,
      canopy: null,
      exitAlongMi: null
    };
  }, [active, params, target.target, winds, interpolateWind, altitudeUnit]);
}

interface DerivePinnedArgs {
  params: FlockingParams;
  jumprun: Extract<FlockingParams['jumprun'], { mode: 'pinned' }>;
  target: LatLng;
  reference: LatLng;
  winds: WindProfile;
  interpolateWind: boolean;
  pomIntervalFt: number;
  hasWind: boolean;
  intoWindDeg: number;
}

function derivePinned({
  params, jumprun, target, reference, winds, interpolateWind, pomIntervalFt, hasWind, intoWindDeg
}: DerivePinnedArgs): FlockingDerived {
  const line: JumprunLine = {
    origin: jumprunLineOrigin(reference, jumprun.directionDeg, jumprun.offsetMi),
    directionDeg: jumprun.directionDeg
  };

  const drift = windDriftVector(
    winds, params.windowTopFt, params.windowBottomFt, params.descentRateMph, interpolateWind
  );
  const durationS = flockingDurationS(
    params.windowTopFt, params.windowBottomFt, params.descentRateMph
  );

  const reachableSegment = reachableJumprunSegment(
    line, target, drift, durationS, params.horizontalSpeedMph, params.targetRadiusMi
  );

  // Chosen exit: the user's position, or the best (min-speed) point.
  const exitAlongMi = jumprun.exitAlongMi ?? bestExitAlongMi(line, target, drift);
  const exit = pointAlongJumprun(line, exitAlongMi);

  const canopy = solveCanopyFlight(
    exit, target, drift, durationS, params.horizontalSpeedMph, params.targetRadiusMi
  );

  // Render the canopy flight from the exit at the solved heading, using the
  // required speed when reachable (ends at the target centre) or max speed
  // when not (falls short). Build at the target, wind-correct, then shift so
  // the exit lands exactly on the pinned position.
  const renderSpeed = canopy.reachable ? canopy.requiredSpeedMph : params.horizontalSpeedMph;
  const raw = makeFlockingPath({
    windowTopFt: params.windowTopFt,
    windowBottomFt: params.windowBottomFt,
    descentRateMph: params.descentRateMph,
    horizontalSpeedMph: renderSpeed,
    directionDeg: canopy.headingDeg,
    pomIntervalFt
  });

  const idealAtTarget = translate(raw, latLngToPoint(target));
  const correctedAtTarget = addWind(idealAtTarget, winds, interpolateWind);
  const last = correctedAtTarget[correctedAtTarget.length - 1];
  const dLng = last ? exit.lng - last.geometry.coordinates[0] : 0;
  const dLat = last ? exit.lat - last.geometry.coordinates[1] : 0;

  const ideal = shiftPath(idealAtTarget, dLng, dLat);
  const corrected = shiftPath(correctedAtTarget, dLng, dLat);

  return {
    ideal,
    corrected,
    exit,
    jumprunDeg: jumprun.directionDeg,
    intoWindDeg,
    vectors: flockingVectors(ideal, corrected),
    spot: spotDescription(exit, reference, jumprun.directionDeg),
    reference,
    hasWind,
    averageWind: averageWind(ideal, corrected),
    jumprunLine: line,
    reachableSegment,
    canopy,
    exitAlongMi
  };
}
