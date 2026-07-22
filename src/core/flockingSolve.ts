/**
 * Flocking solve mode: minimize the miss over a described set of jumprun
 * corridors.
 *
 * The problem collapses analytically — no brute force:
 * - The flight's combined displacement is Δ(φ) = W + L·u(φ): the wind
 *   drift W over the window is fixed, and the canopy leg is a fixed
 *   LENGTH L rotating with the canopy direction φ. (With flight profiles
 *   Δ(φ) stays a fixed vector rotating with the initial direction, so
 *   this structure survives.)
 * - For a fixed run direction θ, the allowed exits form a rectangle in
 *   run coordinates (along × offset). The best exit for a given φ is the
 *   CLAMPED PROJECTION of C(φ) = target − Δ(φ) onto that rectangle —
 *   closed form, and the miss is the leftover distance.
 * - φ ranges over [θ ± tolerance]: C(φ) traces a circular arc; sampling
 *   it at SOLVE_PHI_STEP_DEG bounds the error by L·sin(step/2) ≈ 0.016 mi
 *   for typical L — far below pilot precision.
 *
 * Everything works in flat east/north miles relative to the Spot
 * Reference (the corridors are anchored there).
 */
import { clampNumber } from './validation';
import { VectorEN, cardinalToDeg, vectorCardinalDirection } from './flocking';

const DEG_TO_RAD = Math.PI / 180;

/** Canopy-direction sampling step (see the error bound above). */
export const SOLVE_PHI_STEP_DEG = 0.5;

/**
 * One allowed jumprun corridor: a fixed run heading, the exit rectangle in
 * run coordinates (along the run × lateral offset, miles relative to the
 * Spot Reference) and how far the canopy flight may deviate from the run.
 */
export interface SolveCorridor {
  directionDeg: number;
  /** Allowed lateral offsets of the run, mi (+right of the run). */
  offsetMinMi: number;
  offsetMaxMi: number;
  /** Allowed exit positions along the run, signed mi from the offset point. */
  alongMinMi: number;
  alongMaxMi: number;
  /** Max |canopy − run| deviation, degrees. */
  canopyToleranceDeg: number;
}

/**
 * How good a solution's miss is, as concentric rings around the target:
 * green = inside the target area, yellow = close enough to be workable,
 * red = beyond that.
 */
export type SolveTier = 'green' | 'yellow' | 'red';

/** A solved configuration and its miss. */
export interface SolveSolution {
  corridorIndex: number;
  jumprunDeg: number;
  offsetMi: number;
  exitAlongMi: number;
  canopyDeg: number;
  missMi: number;
  tier: SolveTier;
  /** Angle between this run and the into-wind direction, degrees (0-180). */
  intoWindOffsetDeg: number;
}

export interface SolveResult {
  /** The overall best solution, or null when there are no corridors. */
  best: SolveSolution | null;
  /** The best solution within each corridor (same order as the input). */
  perCorridor: SolveSolution[];
  /** The into-wind direction the preference used, or null in calm air. */
  intoWindDeg: number | null;
}

/** Ring radii (miles) used to tier a miss. */
export interface SolveTiers {
  /** Inside this, the jump works: the target area itself. */
  greenMi: number;
  /** Beyond green but inside this: workable, but not the plan. */
  yellowMi: number;
}

/** Absolute angular difference on the compass circle (0-180). */
function angleDiffDeg(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

export function tierFor(missMi: number, tiers: SolveTiers): SolveTier {
  if (missMi <= tiers.greenMi + 1e-9) {
    return 'green';
  }

  return missMi <= tiers.yellowMi + 1e-9 ? 'yellow' : 'red';
}

const TIER_RANK: Record<SolveTier, number> = { green: 0, yellow: 1, red: 2 };

/**
 * Pick between two solved corridors.
 *
 * A better tier always wins. Among solutions that both land in the GREEN
 * ring the miss is no longer meaningful — every one of them puts the flock
 * on the target — so the tie is broken by which run is closest to flying
 * INTO the wind, which is what a DZ actually does and what keeps the
 * answer stable as the forecast drifts (it only flips when the wind
 * crosses the perpendicular between two runs, i.e. a real change). Outside
 * the green ring the miss is what matters, so it decides first.
 */
function isBetter(a: SolveSolution, b: SolveSolution): boolean {
  if (TIER_RANK[a.tier] !== TIER_RANK[b.tier]) {
    return TIER_RANK[a.tier] < TIER_RANK[b.tier];
  }

  if (a.tier === 'green') {
    if (Math.abs(a.intoWindOffsetDeg - b.intoWindOffsetDeg) > 1e-9) {
      return a.intoWindOffsetDeg < b.intoWindOffsetDeg;
    }

    return a.missMi < b.missMi;
  }

  if (Math.abs(a.missMi - b.missMi) > 1e-9) {
    return a.missMi < b.missMi;
  }

  return a.intoWindOffsetDeg < b.intoWindOffsetDeg;
}

/** Cardinal-degree unit vector in east/north coordinates. */
function unitEN(cardinalDeg: number): VectorEN {
  const psi = cardinalToDeg(cardinalDeg) * DEG_TO_RAD;

  return { eastMi: Math.cos(psi), northMi: Math.sin(psi) };
}

/**
 * Solve one corridor: sample the canopy direction over the allowed arc;
 * for each sample the best exit is the clamped projection of
 * C(φ) = target − W − L·u(φ) onto the corridor's exit rectangle.
 */
function solveCorridor(
  corridor: SolveCorridor,
  index: number,
  targetEN: VectorEN,
  windDriftEN: VectorEN,
  canopyLengthMi: number,
  tiers: SolveTiers,
  intoWindDeg: number | null
): SolveSolution {
  const theta = corridor.directionDeg;
  const along = unitEN(theta);
  const across = unitEN(theta + 90);
  const tol = Math.max(0, corridor.canopyToleranceDeg);

  // Sample the deviation CENTER-OUTWARD (0, ±step, ±2·step, ...): the
  // optimum is often a whole region (miss 0), and strict improvement
  // then keeps the solution with the least canopy deviation — the one a
  // pilot would actually brief.
  const deviations: number[] = [0];

  for (let d = SOLVE_PHI_STEP_DEG; d <= tol + 1e-9; d += SOLVE_PHI_STEP_DEG) {
    deviations.push(Math.min(d, tol), -Math.min(d, tol));
  }

  let best: SolveSolution | null = null;

  for (const dPhi of deviations) {
    const phi = theta + dPhi;
    const u = unitEN(phi);
    const cx = targetEN.eastMi - windDriftEN.eastMi - canopyLengthMi * u.eastMi;
    const cy = targetEN.northMi - windDriftEN.northMi - canopyLengthMi * u.northMi;

    // Run-frame coordinates of C, clamped into the exit rectangle
    const cAlong = cx * along.eastMi + cy * along.northMi;
    const cAcross = cx * across.eastMi + cy * across.northMi;
    const t = clampNumber(cAlong, corridor.alongMinMi, corridor.alongMaxMi);
    const d = clampNumber(cAcross, corridor.offsetMinMi, corridor.offsetMaxMi);
    const missMi = Math.hypot(cAlong - t, cAcross - d);

    // Strict improvement only: ties keep the earlier (less-deviating) φ
    if (!best || missMi < best.missMi - 1e-9) {
      const jumprunDeg = ((theta % 360) + 360) % 360;

      best = {
        corridorIndex: index,
        jumprunDeg,
        offsetMi: d,
        exitAlongMi: t,
        canopyDeg: ((phi % 360) + 360) % 360,
        missMi,
        tier: tierFor(missMi, tiers),
        intoWindOffsetDeg:
          intoWindDeg === null ? 0 : angleDiffDeg(jumprunDeg, intoWindDeg)
      };
    }
  }

  // tol >= 0 guarantees at least one sample
  return best as SolveSolution;
}

/** Below this drift there is no meaningful wind to align against. */
const CALM_DRIFT_MI = 0.05;

/**
 * Solve every corridor and pick between them. `targetEN` and `windDriftEN`
 * are east/north miles relative to the Spot Reference; `canopyLengthMi` is
 * the length of the canopy leg (horizontal speed × window duration).
 *
 * Selection is NOT plain miss minimization: see isBetter(). Corridors whose
 * solutions both reach the green ring are separated by which run is most
 * into the wind, so a drifting forecast stops flipping the answer between
 * two runs that both work.
 */
export function solveFlockingSpot(
  corridors: readonly SolveCorridor[],
  targetEN: VectorEN,
  windDriftEN: VectorEN,
  canopyLengthMi: number,
  // Fallback rings: 0.25 nm / 0.5 nm in statute miles (see model defaults)
  tiers: SolveTiers = { greenMi: 0.2877, yellowMi: 0.5754 }
): SolveResult {
  // Into the wind = the reciprocal of the drift the flock experiences.
  const driftMi = Math.hypot(windDriftEN.eastMi, windDriftEN.northMi);
  const intoWindDeg = driftMi > CALM_DRIFT_MI
    ? vectorCardinalDirection(-windDriftEN.eastMi, -windDriftEN.northMi)
    : null;

  const perCorridor = corridors.map((corridor, i) => solveCorridor(
    corridor, i, targetEN, windDriftEN, Math.max(0, canopyLengthMi), tiers, intoWindDeg
  ));

  let best: SolveSolution | null = null;

  for (const solution of perCorridor) {
    if (!best || isBetter(solution, best)) {
      best = solution;
    }
  }

  return { best, perCorridor, intoWindDeg };
}
