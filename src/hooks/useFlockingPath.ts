import { useMemo } from 'react';

import { FlightPath, FlightPoint, LatLng, Target } from '../types';
import {
  CANOPY_DEVIATION_WARN_DEG,
  FlockingParams,
  FlockingVectors,
  JumprunLine,
  SpotDescription,
  flockingDurationS,
  flockingVectors,
  intoWindDirection,
  jumprunLineOrigin,
  localMilesEN,
  makeFlockingPath,
  pointAlongJumprun,
  spotDescription,
  windDriftVector
} from '../core/flocking';
import {
  SolveResult,
  SolveSolution,
  SolveTier,
  solveFlockingSpot,
  tierFor
} from '../core/flockingSolve';
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
  /**
   * Which ring the miss falls in (green/yellow/red). Null in classic,
   * where the flight ends on the target by construction.
   */
  tier: SolveTier | null;
  /** Resolved jumprun direction. */
  jumprunDeg: number;
  /** Resolved canopy flight direction. */
  canopyDeg: number;
  /** The current into-wind direction (for quick-set buttons). */
  intoWindDeg: number;
  /** Angle between the canopy flight and the jumprun, degrees (0-180). */
  canopyDeviationDeg: number;
  /** Whether that deviation exceeds CANOPY_DEVIATION_WARN_DEG. */
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
  /** Solve mode: the solver result (best carries the ORIGINAL corridor index). */
  solve: SolveResult | null;
  /**
   * Solve mode: each configured corridor's solution, aligned to
   * params.solveCorridors; null where the corridor is disabled.
   */
  corridorSolutions: (SolveSolution | null)[];
  /** Solve mode: exit-rectangle outlines of the ENABLED corridors. */
  corridorOutlines: LatLng[][];
  /** Solve mode: name labels for the ENABLED, named corridors (map overlay). */
  corridorLabels: { position: LatLng; text: string }[];
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
  tier: null,
  jumprunDeg: 0,
  canopyDeg: 0,
  intoWindDeg: 0,
  canopyDeviationDeg: 0,
  canopyDeviationWarning: false,
  vectors: null,
  spot: null,
  reference: { lat: 0, lng: 0 },
  hasWind: false,
  averageWind: {},
  jumprunLine: null,
  solve: null,
  corridorSolutions: [],
  corridorOutlines: [],
  corridorLabels: []
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

    if (params.mode === 'solve') {
      return deriveSolve({
        params,
        target: target.target,
        reference,
        winds,
        interpolateWind,
        pomIntervalFt,
        hasWind,
        intoWindDeg
      });
    }

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
        tier: null,
        jumprunDeg,
        canopyDeg,
        intoWindDeg,
        canopyDeviationDeg: 0,
        canopyDeviationWarning: false,
        vectors: flockingVectors(idealAtTarget, correctedAtTarget),
        spot: spotDescription(exit, reference, jumprunDeg),
        reference,
        hasWind,
        averageWind: averageWind(idealAtTarget, correctedAtTarget),
        jumprunLine: null,
        solve: null,
        corridorSolutions: [],
        corridorOutlines: [],
        corridorLabels: []
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
      tier: tierFor(missMi, {
        greenMi: params.targetRadiusMi,
        yellowMi: params.yellowRadiusMi
      }),
      jumprunDeg,
      canopyDeg,
      intoWindDeg,
      canopyDeviationDeg: driftAngle(canopyDeg, jumprunDeg),
      canopyDeviationWarning: driftAngle(canopyDeg, jumprunDeg) > CANOPY_DEVIATION_WARN_DEG,
      vectors: flockingVectors(ideal, corrected),
      spot: spotDescription(exit, reference, jumprunDeg),
      reference,
      hasWind,
      averageWind: averageWind(ideal, corrected),
      jumprunLine,
      solve: null,
      corridorSolutions: [],
      corridorOutlines: [],
      corridorLabels: []
    };
  }, [active, params, target.target, winds, interpolateWind, altitudeUnit]);
}

interface DeriveSolveArgs {
  params: FlockingParams;
  target: LatLng;
  reference: LatLng;
  winds: WindProfile;
  interpolateWind: boolean;
  pomIntervalFt: number;
  hasWind: boolean;
  intoWindDeg: number;
}

/** A corridor's exit rectangle as a closed LatLng loop. */
function corridorOutline(
  reference: LatLng,
  corridor: FlockingParams['solveCorridors'][number]
): LatLng[] {
  const corner = (tMi: number, dMi: number): LatLng =>
    pointAlongJumprun(
      {
        origin: jumprunLineOrigin(reference, corridor.directionDeg, dMi),
        directionDeg: corridor.directionDeg
      },
      tMi
    );
  const a = corner(corridor.alongMinMi, corridor.offsetMinMi);
  const b = corner(corridor.alongMaxMi, corridor.offsetMinMi);
  const c = corner(corridor.alongMaxMi, corridor.offsetMaxMi);
  const d = corner(corridor.alongMinMi, corridor.offsetMaxMi);

  return [a, b, c, d, a];
}

/**
 * Where a corridor's name label sits: the midpoint of the far short edge
 * (the alongMax end of the run, loop corners b–c). Keeps the label on an
 * edge, away from the target/POM tooltips clustered near the centre.
 */
function outlineLabelAnchor(loop: LatLng[]): LatLng {
  const [, b, c] = loop;
  return { lat: (b.lat + c.lat) / 2, lng: (b.lng + c.lng) / 2 };
}

/**
 * Solve mode: minimize the miss over the described corridors, then render
 * the winning configuration exactly like free mode would.
 */
function deriveSolve({
  params, target, reference, winds, interpolateWind, pomIntervalFt, hasWind, intoWindDeg
}: DeriveSolveArgs): FlockingDerived {
  // Disabled corridors stay configured but take no part in the solve and
  // are not drawn; results are remapped back onto the full list so the
  // panel can line each solution up with its corridor.
  const enabled = params.solveCorridors
    .map((corridor, index) => ({ corridor, index }))
    .filter(entry => entry.corridor.enabled);
  const corridorOutlines = enabled.map(e => corridorOutline(reference, e.corridor));
  // Name labels, placed at each rectangle's centroid. Unnamed corridors are
  // left unlabeled to keep the map uncluttered.
  const corridorLabels = enabled
    .map((e, k) => ({ name: e.corridor.name.trim(), loop: corridorOutlines[k] }))
    .filter(x => x.name !== '')
    .map(x => ({ position: outlineLabelAnchor(x.loop), text: x.name }));

  const drift = windDriftVector(
    winds, params.windowTopFt, params.windowBottomFt, params.descentRateMph, interpolateWind
  );
  const durationS = flockingDurationS(
    params.windowTopFt, params.windowBottomFt, params.descentRateMph
  );
  const canopyLengthMi = params.horizontalSpeedMph * (durationS / 3600);
  const targetEN = localMilesEN(reference, target);

  const rawSolve = solveFlockingSpot(
    enabled.map(e => e.corridor), targetEN, drift, canopyLengthMi,
    { greenMi: params.targetRadiusMi, yellowMi: params.yellowRadiusMi }
  );

  // Remap subset indices back to positions in params.solveCorridors
  const corridorSolutions: (SolveSolution | null)[] = params.solveCorridors.map(() => null);

  rawSolve.perCorridor.forEach((solution, k) => {
    corridorSolutions[enabled[k].index] = { ...solution, corridorIndex: enabled[k].index };
  });

  const solve: SolveResult = {
    ...rawSolve,
    best: rawSolve.best
      ? { ...rawSolve.best, corridorIndex: enabled[rawSolve.best.corridorIndex].index }
      : null
  };
  const best = solve.best;

  if (!best) {
    return {
      ...EMPTY,
      reference,
      hasWind,
      intoWindDeg,
      jumprunDeg: intoWindDeg,
      canopyDeg: intoWindDeg,
      solve,
      corridorSolutions,
      corridorOutlines,
      corridorLabels
    };
  }

  const jumprunLine: JumprunLine = {
    origin: jumprunLineOrigin(reference, best.jumprunDeg, best.offsetMi),
    directionDeg: best.jumprunDeg
  };
  const exit = pointAlongJumprun(jumprunLine, best.exitAlongMi);

  const raw = makeFlockingPath({
    windowTopFt: params.windowTopFt,
    windowBottomFt: params.windowBottomFt,
    descentRateMph: params.descentRateMph,
    horizontalSpeedMph: params.horizontalSpeedMph,
    directionDeg: best.canopyDeg,
    pomIntervalFt
  });
  const idealAtTarget = translate(raw, latLngToPoint(target));
  const correctedAtTarget = addWind(idealAtTarget, winds, interpolateWind);

  if (correctedAtTarget.length < 2) {
    return {
      ...EMPTY, reference, hasWind, intoWindDeg, solve, corridorSolutions,
      corridorOutlines, corridorLabels
    };
  }

  const exitAtTarget = pointToLatLng(correctedAtTarget[correctedAtTarget.length - 1]);
  const dLng = exit.lng - exitAtTarget.lng;
  const dLat = exit.lat - exitAtTarget.lat;
  const ideal = shiftPath(idealAtTarget, dLng, dLat);
  const corrected = shiftPath(correctedAtTarget, dLng, dLat);

  const end = pointToLatLng(corrected[0]);
  const missEN = localMilesEN(end, target);
  const missMi = Math.hypot(missEN.eastMi, missEN.northMi);

  return {
    ideal,
    corrected,
    exit,
    end,
    missMi,
    onTarget: missMi <= params.targetRadiusMi + 1e-9,
    tier: tierFor(missMi, {
      greenMi: params.targetRadiusMi,
      yellowMi: params.yellowRadiusMi
    }),
    jumprunDeg: best.jumprunDeg,
    canopyDeg: best.canopyDeg,
    intoWindDeg,
    canopyDeviationDeg: driftAngle(best.canopyDeg, best.jumprunDeg),
    canopyDeviationWarning:
      driftAngle(best.canopyDeg, best.jumprunDeg) > CANOPY_DEVIATION_WARN_DEG,
    vectors: flockingVectors(ideal, corrected),
    spot: spotDescription(exit, reference, best.jumprunDeg),
    reference,
    hasWind,
    averageWind: averageWind(ideal, corrected),
    jumprunLine,
    solve,
    corridorSolutions,
    corridorOutlines,
    corridorLabels
  };
}
