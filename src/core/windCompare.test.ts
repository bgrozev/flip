import { describe, expect, it } from 'vitest';

import { createWindProfile, createWindRow } from './wind';
import {
  COMPARISON_STEP_FT,
  DIRECTION_DISAGREEMENT_DEG,
  DIRECTION_MIN_SPEED_KTS,
  SPEED_DISAGREEMENT_KTS,
  compareProfiles,
  comparisonAltitudes,
  sampleProfileAt
} from './windCompare';

function profile(rows: [number, number, number][]) {
  return createWindProfile(rows.map(([alt, dir, spd]) => createWindRow(alt, dir, spd)));
}

describe('comparisonAltitudes', () => {
  it('builds a 0..limit ladder in 500 ft steps', () => {
    expect(comparisonAltitudes(3000)).toEqual([0, 500, 1000, 1500, 2000, 2500, 3000]);
    expect(comparisonAltitudes(1000)).toEqual([0, 500, 1000]);
  });

  it('always yields at least two rungs', () => {
    expect(comparisonAltitudes(0)).toEqual([0, COMPARISON_STEP_FT]);
    expect(comparisonAltitudes(300)).toEqual([0, COMPARISON_STEP_FT]);
  });
});

describe('sampleProfileAt', () => {
  const p = profile([[100, 90, 10], [1100, 90, 20]]);

  it('interpolates between rows', () => {
    expect(sampleProfileAt(p, 600)).toEqual({ direction: 90, speedKts: 15 });
  });

  it('uses the lowest row below the profile (the ground band)', () => {
    expect(sampleProfileAt(p, 0)).toEqual({ direction: 90, speedKts: 10 });
  });

  it('does not extrapolate above the highest row', () => {
    expect(sampleProfileAt(p, 1101)).toBeNull();
  });

  it('is null for an empty profile', () => {
    expect(sampleProfileAt(createWindProfile([]), 0)).toBeNull();
  });
});

describe('compareProfiles', () => {
  it('flags direction disagreement past the threshold', () => {
    const bands = compareProfiles(
      [profile([[0, 90, 10]]), profile([[0, 90 + DIRECTION_DISAGREEMENT_DEG + 1, 10]])],
      [0]
    );

    expect(bands[0].directionSpreadDeg).toBeCloseTo(DIRECTION_DISAGREEMENT_DEG + 1, 6);
    expect(bands[0].directionDisagree).toBe(true);
    expect(bands[0].speedDisagree).toBe(false);
    expect(bands[0].disagree).toBe(true);
  });

  it('does not flag direction spread at the threshold', () => {
    const bands = compareProfiles(
      [profile([[0, 90, 10]]), profile([[0, 90 + DIRECTION_DISAGREEMENT_DEG, 10]])],
      [0]
    );

    expect(bands[0].directionDisagree).toBe(false);
  });

  it('measures direction spread across north', () => {
    const bands = compareProfiles(
      [profile([[0, 350, 10]]), profile([[0, 10, 10]])],
      [0]
    );

    expect(bands[0].directionSpreadDeg).toBeCloseTo(20, 6);
    expect(bands[0].directionDisagree).toBe(true);
  });

  it('flags speed disagreement past the threshold', () => {
    const bands = compareProfiles(
      [profile([[0, 90, 5]]), profile([[0, 90, 5 + SPEED_DISAGREEMENT_KTS + 1]])],
      [0]
    );

    expect(bands[0].speedSpreadKts).toBeCloseTo(SPEED_DISAGREEMENT_KTS + 1, 6);
    expect(bands[0].speedDisagree).toBe(true);
    expect(bands[0].directionDisagree).toBe(false);
  });

  it('ignores directions of near-calm winds', () => {
    // 2 kts @ 270 vs 10 kts @ 90: opposite directions, but the calm one
    // carries no planning value — only the speed difference counts.
    const calm = DIRECTION_MIN_SPEED_KTS - 1;
    const bands = compareProfiles(
      [profile([[0, 270, calm]]), profile([[0, 90, 10]])],
      [0]
    );

    expect(bands[0].directionSpreadDeg).toBe(0);
    expect(bands[0].directionDisagree).toBe(false);
    expect(bands[0].speedDisagree).toBe(true);
  });

  it('leaves null cells where a profile has no coverage', () => {
    // Second profile tops out at 1000 ft: no opinion at 2000 ft
    const bands = compareProfiles(
      [profile([[0, 90, 10], [3000, 100, 20]]), profile([[0, 92, 11], [1000, 95, 14]])],
      [0, 2000]
    );

    expect(bands[0].cells[1]).not.toBeNull();
    expect(bands[1].cells[1]).toBeNull();
    // A single present cell cannot disagree with anything
    expect(bands[1].disagree).toBe(false);
  });

  it('agreeing profiles produce no flags anywhere on the ladder', () => {
    const a = profile([[0, 90, 10], [3000, 100, 20]]);
    const b = profile([[0, 92, 11], [3000, 103, 22]]);
    const bands = compareProfiles([a, b], comparisonAltitudes(3000));

    expect(bands).toHaveLength(7);
    expect(bands.every(band => !band.disagree)).toBe(true);
  });

  it('tolerates unsorted rows (prepWind ordering)', () => {
    const messy = createWindProfile([
      createWindRow(1000, 90, 20),
      createWindRow(0, 90, 10),
      createWindRow(500, 90, 15)
    ]);
    // prepWind keeps 1000 (first) and drops the out-of-order rest… the
    // comparison must simply not crash and sample what survives.
    const bands = compareProfiles([messy], [0, 1000]);

    expect(bands[0].cells[0]).toEqual({ direction: 90, speedKts: 20 });
  });
});
