import { describe, expect, it } from 'vitest';

import { VectorEN, cardinalToDeg } from './flocking';
import {
  SolveCorridor,
  solveFlockingSpot
} from './flockingSolve';

const DEG = Math.PI / 180;

function unitEN(cardinalDeg: number): VectorEN {
  const psi = cardinalToDeg(cardinalDeg) * DEG;

  return { eastMi: Math.cos(psi), northMi: Math.sin(psi) };
}

function corridor(over: Partial<SolveCorridor> = {}): SolveCorridor {
  return {
    directionDeg: 0,
    offsetMinMi: -1,
    offsetMaxMi: 1,
    alongMinMi: -5,
    alongMaxMi: 3,
    canopyToleranceDeg: 15,
    ...over
  };
}

/**
 * Brute-force oracle: grid every free variable and return the best miss.
 * Deliberately dumb and independent of the solver's math.
 */
function bruteForce(
  corridors: readonly SolveCorridor[],
  targetEN: VectorEN,
  windEN: VectorEN,
  lengthMi: number
): number {
  let best = Infinity;

  for (const c of corridors) {
    const along = unitEN(c.directionDeg);
    const across = unitEN(c.directionDeg + 90);

    for (let phi = c.directionDeg - c.canopyToleranceDeg;
      phi <= c.directionDeg + c.canopyToleranceDeg + 1e-9; phi += 1) {
      const u = unitEN(phi);
      const endBaseE = windEN.eastMi + lengthMi * u.eastMi;
      const endBaseN = windEN.northMi + lengthMi * u.northMi;

      for (let t = c.alongMinMi; t <= c.alongMaxMi + 1e-9; t += 0.05) {
        for (let d = c.offsetMinMi; d <= c.offsetMaxMi + 1e-9; d += 0.05) {
          const exitE = t * along.eastMi + d * across.eastMi;
          const exitN = t * along.northMi + d * across.northMi;
          const miss = Math.hypot(
            exitE + endBaseE - targetEN.eastMi,
            exitN + endBaseN - targetEN.northMi
          );

          best = Math.min(best, miss);
        }
      }
    }
  }

  return best;
}

describe('solveFlockingSpot', () => {
  const noWind: VectorEN = { eastMi: 0, northMi: 0 };

  it('returns null best for no corridors', () => {
    expect(solveFlockingSpot([], { eastMi: 0, northMi: 0 }, noWind, 3).best).toBeNull();
  });

  it('solves exactly when the target is reachable on the corridor axis', () => {
    // No wind, run north through the reference (= target position),
    // canopy 3 mi north: the exit 3 mi south (t = -3) lands exactly.
    const r = solveFlockingSpot([corridor()], { eastMi: 0, northMi: 0 }, noWind, 3);

    expect(r.best!.missMi).toBeLessThan(0.01);
    expect(r.best!.exitAlongMi).toBeCloseTo(-3, 1);
    expect(r.best!.canopyDeg).toBeCloseTo(0, 0);
  });

  it('uses the offset dimension when the target sits sideways', () => {
    // Target 0.5 mi east of the reference: within the ±1 mi offset range,
    // so a run offset 0.5 mi right solves it exactly.
    const r = solveFlockingSpot(
      [corridor()], { eastMi: 0.5, northMi: 0 }, noWind, 3
    );

    expect(r.best!.missMi).toBeLessThan(0.01);
    expect(r.best!.offsetMi).toBeCloseTo(0.5, 1);
  });

  it('clamps and reports the miss when the target is out of reach', () => {
    // Target 3 mi east: offset clamps at 1, canopy tolerance ±15° barely
    // helps; a real miss remains.
    const r = solveFlockingSpot(
      [corridor()], { eastMi: 3, northMi: 0 }, noWind, 3
    );

    expect(r.best!.missMi).toBeGreaterThan(0.5);
    expect(r.best!.offsetMi).toBe(1);
  });

  it('uses the canopy tolerance to close a lateral gap', () => {
    // Target 0.5 mi east with a ZERO offset range: only tilting the canopy
    // east of the run can close the gap; 3·sin(15°) ≈ 0.78 mi ≥ 0.5.
    const strict = corridor({ offsetMinMi: 0, offsetMaxMi: 0 });
    const r = solveFlockingSpot([strict], { eastMi: 0.5, northMi: 0 }, noWind, 3);

    expect(r.best!.missMi).toBeLessThan(0.02);
    expect(r.best!.canopyDeg).toBeGreaterThan(2);
    expect(r.best!.canopyDeg).toBeLessThanOrEqual(15.01);
  });

  it('picks the right corridor of several (the ZHills N-or-S case)', () => {
    // Wind drift pushes 2 mi south; a NORTH run flies the canopy into the
    // wind (good), a SOUTH run flies it downwind (bad unless the exit
    // range absorbs it). Target at the reference.
    const north = corridor({ directionDeg: 0 });
    const south = corridor({ directionDeg: 180 });
    const wind: VectorEN = { eastMi: 0, northMi: -2 };
    const r = solveFlockingSpot([north, south], { eastMi: 0, northMi: 0 }, wind, 3);

    expect(r.perCorridor).toHaveLength(2);
    // Both can solve it here (the exit range is generous); the point is
    // that both corridors report and the best is exact.
    expect(r.best!.missMi).toBeLessThan(0.01);

    // Restrict the along-range so only one corridor can reach:
    // north run needs exit at t = -(3-2) = -1; south run needs t = +5
    // (out of its range) — north must win.
    const northTight = corridor({ directionDeg: 0, alongMinMi: -2, alongMaxMi: 0 });
    const southTight = corridor({ directionDeg: 180, alongMinMi: -2, alongMaxMi: 0 });
    const r2 = solveFlockingSpot(
      [southTight, northTight], { eastMi: 0, northMi: 0 }, wind, 3
    );

    expect(r2.best!.corridorIndex).toBe(1);
    expect(r2.best!.missMi).toBeLessThan(0.01);
    expect(r2.perCorridor[0].missMi).toBeGreaterThan(r2.perCorridor[1].missMi);
  });

  it('agrees with the brute-force oracle on random scenarios', () => {
    // Deterministic pseudo-random scenarios
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;

      return seed / 2147483648;
    };

    for (let i = 0; i < 12; i++) {
      const corridors = [
        corridor({ directionDeg: Math.round(rand() * 360) }),
        corridor({
          directionDeg: Math.round(rand() * 360),
          offsetMinMi: -0.5,
          offsetMaxMi: 0.5,
          alongMinMi: -3,
          alongMaxMi: 1
        })
      ];
      const targetEN = { eastMi: (rand() - 0.5) * 8, northMi: (rand() - 0.5) * 8 };
      const windEN = { eastMi: (rand() - 0.5) * 4, northMi: (rand() - 0.5) * 4 };
      const lengthMi = 1 + rand() * 4;

      const solved = solveFlockingSpot(corridors, targetEN, windEN, lengthMi).best!.missMi;
      const oracle = bruteForce(corridors, targetEN, windEN, lengthMi);

      // The analytic solve must never be worse than the coarse grid by
      // more than the grid's own resolution
      expect(solved).toBeLessThanOrEqual(oracle + 0.001);
      expect(Math.abs(solved - oracle)).toBeLessThan(0.06);
    }
  });
});
