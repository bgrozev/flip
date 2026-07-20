import { useMemo } from 'react';

import { FlightPath, FlightPoint, LatLng, Target } from '../types';
import {
  FlockingParams,
  FlockingVectors,
  JumprunLine,
  SpotDescription,
  bestExitAlongMi,
  flockingVectors,
  intoWindDirection,
  jumprunLineOrigin,
  localMilesEN,
  makeFlockingPath,
  pointAlongJumprun,
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
  /** No-wind descent path (ghost), anchored at the solved exit. */
  ideal: FlightPath;
  /** Wind-corrected descent path: exit (last point) on the jumprun line. */
  corrected: FlightPath;
  /** The solver's exit: the point on the jumprun line whose flight ends closest to the target. */
  exit: LatLng | null;
  /** Where the flight ends (point[0] of the corrected path). */
  end: LatLng | null;
  /** Distance from the end to the target, miles. */
  missMi: number | null;
  /** Whether the end lands inside the target area. */
  onTarget: boolean;
  /** Resolved jumprun direction (into-wind resolved from the winds). */
  jumprunDeg: number;
  /** Resolved canopy flight direction. */
  canopyDeg: number;
  /** The current into-wind direction (for quick-set buttons). */
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
  /** The jumprun line. */
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
 * The flocking derive pipeline. The canopy flight and the jumprun are
 * independent:
 *
 * - The canopy flight is exactly what is configured: direction (into-wind
 *   resolves from the winds) at the configured horizontal/vertical speeds,
 *   with the wind applied. Its combined displacement Δ (exit → end) is
 *   therefore fixed.
 * - The jumprun is a line: its own direction + lateral offset from the
 *   Spot Reference. The solver picks the exit ON the line whose flight end
 *   (exit + Δ) lands closest to the target: the projection of (target − Δ)
 *   onto the line.
 * - When the end misses the target area, `onTarget` is false and `missMi`
 *   says by how much — the UI highlights it; the path still renders the
 *   real configured flight.
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

    const canopyDeg = params.direction === 'into-wind' ? intoWindDeg : params.direction;
    const jumprunDeg = params.jumprun.directionDeg === 'into-wind'
      ? intoWindDeg
      : params.jumprun.directionDeg;

    // The configured flight, first anchored end-at-target to obtain its
    // fixed combined displacement Δ = end − exit.
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

    const exitAtTarget = pointToLatLng(correctedAtTarget[correctedAtTarget.length - 1]);
    // Δ as an east/north miles vector: exit → end (the end sat at the target)
    const delta = localMilesEN(exitAtTarget, target.target);

    // Best exit on the jumprun line: projection of (target − Δ) onto it
    const jumprunLine: JumprunLine = {
      origin: jumprunLineOrigin(reference, jumprunDeg, params.jumprun.offsetMi),
      directionDeg: jumprunDeg
    };
    const exit = pointAlongJumprun(
      jumprunLine,
      bestExitAlongMi(jumprunLine, target.target, delta)
    );

    // Anchor the flight at the solved exit
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
      vectors: flockingVectors(ideal, corrected),
      spot: spotDescription(exit, reference, jumprunDeg),
      reference,
      hasWind,
      averageWind: averageWind(ideal, corrected),
      jumprunLine
    };
  }, [active, params, target.target, winds, interpolateWind, altitudeUnit]);
}
