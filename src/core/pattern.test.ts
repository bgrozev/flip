import {
  PATTERN_NONE,
  PATTERN_ONE_LEG,
  PATTERN_THREE_LEG,
  PATTERN_TWO_LEG,
  booleanToDirection,
  flipPatternSides,
  getPatternLegCount,
  isLeftTurn,
  makePattern,
  makePatternByType,
  setPatternSide,
  withFullPattern
} from './pattern';

describe('Pattern type constants', () => {
  it('defines all pattern types', () => {
    expect(PATTERN_NONE).toBe('none');
    expect(PATTERN_ONE_LEG).toBe('one-leg');
    expect(PATTERN_TWO_LEG).toBe('two-leg');
    expect(PATTERN_THREE_LEG).toBe('three-leg');
  });
});

describe('getPatternLegCount', () => {
  it('returns 0 for PATTERN_NONE', () => {
    expect(getPatternLegCount(PATTERN_NONE)).toBe(0);
  });

  it('returns 1 for PATTERN_ONE_LEG', () => {
    expect(getPatternLegCount(PATTERN_ONE_LEG)).toBe(1);
  });

  it('returns 2 for PATTERN_TWO_LEG', () => {
    expect(getPatternLegCount(PATTERN_TWO_LEG)).toBe(2);
  });

  it('returns 3 for PATTERN_THREE_LEG', () => {
    expect(getPatternLegCount(PATTERN_THREE_LEG)).toBe(3);
  });

  it('returns 0 for unknown type', () => {
    expect(getPatternLegCount('unknown' as any)).toBe(0);
    expect(getPatternLegCount(null as any)).toBe(0);
    expect(getPatternLegCount(undefined as any)).toBe(0);
  });
});

describe('makePatternByType', () => {
  const baseParams = {
    descentRateMph: 12,
    glideRatio: 2.6,
    legs: [
      { altitude: 300, direction: 0 },
      { altitude: 300, direction: 270 },
      { altitude: 300, direction: 270 }
    ]
  };

  it('returns empty pattern for PATTERN_NONE', () => {
    const result = makePatternByType({ ...baseParams, type: PATTERN_NONE });
    expect(result).toEqual([]);
  });

  it('uses only first leg for PATTERN_ONE_LEG', () => {
    const result = makePatternByType({ ...baseParams, type: PATTERN_ONE_LEG });
    const lastPoint = result[result.length - 1];
    expect(lastPoint.properties.alt).toBeCloseTo(300, 0);
  });

  it('uses first two legs for PATTERN_TWO_LEG', () => {
    const result = makePatternByType({ ...baseParams, type: PATTERN_TWO_LEG });
    const lastPoint = result[result.length - 1];
    expect(lastPoint.properties.alt).toBeCloseTo(600, 0);
  });

  it('uses all three legs for PATTERN_THREE_LEG', () => {
    const result = makePatternByType({ ...baseParams, type: PATTERN_THREE_LEG });
    const lastPoint = result[result.length - 1];
    expect(lastPoint.properties.alt).toBeCloseTo(900, 0);
  });
});

describe('withFullPattern', () => {
  const baseParams = {
    descentRateMph: 12,
    glideRatio: 2.6,
    legs: [
      { altitude: 300, direction: 0 },
      { altitude: 600, direction: 270 },
      { altitude: 900, direction: 270 }
    ]
  };

  it('promotes every shorter type to the full three-leg pattern', () => {
    for (const type of [PATTERN_NONE, PATTERN_ONE_LEG, PATTERN_TWO_LEG]) {
      expect(withFullPattern({ ...baseParams, type }).type).toBe(PATTERN_THREE_LEG);
    }
  });

  it('leaves everything else untouched', () => {
    const params = { ...baseParams, type: PATTERN_TWO_LEG };
    const full = withFullPattern(params);

    expect(full).toEqual({ ...params, type: PATTERN_THREE_LEG });
    // The caller's object is not mutated: the stored two-leg choice survives
    expect(params.type).toBe(PATTERN_TWO_LEG);
  });

  it('is identity for a three-leg pattern', () => {
    const params = { ...baseParams, type: PATTERN_THREE_LEG };

    expect(withFullPattern(params)).toBe(params);
  });

  it('actually flies three legs where the stored type flies two', () => {
    const stored = { ...baseParams, type: PATTERN_TWO_LEG };

    const asStored = makePatternByType(stored);
    const asFlown = makePatternByType(withFullPattern(stored));

    expect(asFlown.length).toBeGreaterThan(asStored.length);
    // Leg altitudes are per-leg heights, so the top of the pattern is their
    // sum: 300+600 flown as two legs, 300+600+900 as three.
    const top = (path: typeof asFlown) => Math.max(...path.map(p => p.properties.alt));

    expect(top(asStored)).toBeCloseTo(900, 6);
    expect(top(asFlown)).toBeCloseTo(1800, 6);
  });
});

describe('isLeftTurn', () => {
  it('returns true for direction 90 (left turn)', () => {
    expect(isLeftTurn(90)).toBe(true);
  });

  it('returns false for direction 270 (right turn / default)', () => {
    expect(isLeftTurn(270)).toBe(false);
  });

  it('returns true for any non-270 value', () => {
    expect(isLeftTurn(0)).toBe(true);
    expect(isLeftTurn(180)).toBe(true);
    expect(isLeftTurn(-90)).toBe(true);
  });
});

describe('booleanToDirection', () => {
  it('returns 90 for true (left turn)', () => {
    expect(booleanToDirection(true)).toBe(90);
  });

  it('returns 270 for false (right turn)', () => {
    expect(booleanToDirection(false)).toBe(270);
  });
});

describe('setPatternSide', () => {
  const baseParams = {
    descentRateMph: 12,
    glideRatio: 2.6,
    type: PATTERN_THREE_LEG,
    legs: [
      { altitude: 300, direction: 0 },
      { altitude: 600, direction: 90 },
      { altitude: 900, direction: 270 }
    ]
  };

  it('sets both turns left', () => {
    const result = setPatternSide(baseParams, true);

    expect(result.legs[1].direction).toBe(90);
    expect(result.legs[2].direction).toBe(90);
  });

  it('sets both turns right', () => {
    const result = setPatternSide(baseParams, false);

    expect(result.legs[1].direction).toBe(270);
    expect(result.legs[2].direction).toBe(270);
  });

  it('leaves leg 0 (the final leg) untouched', () => {
    expect(setPatternSide(baseParams, true).legs[0]).toEqual(baseParams.legs[0]);
  });

  it('does not mutate the input', () => {
    const before = JSON.parse(JSON.stringify(baseParams));

    setPatternSide(baseParams, true);
    expect(baseParams).toEqual(before);
  });
});

describe('flipPatternSides', () => {
  const rightRight = {
    descentRateMph: 12,
    glideRatio: 2.6,
    type: PATTERN_THREE_LEG,
    legs: [
      { altitude: 300, direction: 0 },
      { altitude: 600, direction: 270 },
      { altitude: 900, direction: 270 }
    ]
  };
  const leftLeft = { ...rightRight, legs: [rightRight.legs[0], { ...rightRight.legs[1], direction: 90 }, { ...rightRight.legs[2], direction: 90 }] };
  const zLeftRight = { ...rightRight, legs: [rightRight.legs[0], { ...rightRight.legs[1], direction: 90 }, { ...rightRight.legs[2], direction: 270 }] };
  const zRightLeft = { ...rightRight, legs: [rightRight.legs[0], { ...rightRight.legs[1], direction: 270 }, { ...rightRight.legs[2], direction: 90 }] };

  it('turns two right turns into two left turns', () => {
    const flipped = flipPatternSides(rightRight);

    expect(isLeftTurn(flipped.legs[1].direction)).toBe(true);
    expect(isLeftTurn(flipped.legs[2].direction)).toBe(true);
  });

  it('turns two left turns into two right turns', () => {
    const flipped = flipPatternSides(leftLeft);

    expect(isLeftTurn(flipped.legs[1].direction)).toBe(false);
    expect(isLeftTurn(flipped.legs[2].direction)).toBe(false);
  });

  it('resolves a mixed (Z) pattern to left-hand, whichever leg was on which side', () => {
    for (const z of [zLeftRight, zRightLeft]) {
      const flipped = flipPatternSides(z);

      expect(isLeftTurn(flipped.legs[1].direction)).toBe(true);
      expect(isLeftTurn(flipped.legs[2].direction)).toBe(true);
    }
  });

  it('is a toggle only starting from a uniform pattern', () => {
    expect(flipPatternSides(flipPatternSides(rightRight))).toEqual(rightRight);
    expect(flipPatternSides(flipPatternSides(leftLeft))).toEqual(leftLeft);
  });

  it('leaves leg 0 (the final leg) untouched', () => {
    expect(flipPatternSides(rightRight).legs[0]).toEqual(rightRight.legs[0]);
  });

  it('leaves altitudes and other params untouched', () => {
    const flipped = flipPatternSides(rightRight);

    expect(flipped.legs.map(l => l.altitude)).toEqual(rightRight.legs.map(l => l.altitude));
    expect(flipped.descentRateMph).toBe(rightRight.descentRateMph);
    expect(flipped.type).toBe(rightRight.type);
  });

  it('does not mutate the input', () => {
    const before = JSON.parse(JSON.stringify(rightRight));

    flipPatternSides(rightRight);
    expect(rightRight).toEqual(before);
  });
});

describe('makePattern', () => {
  it('returns empty array when legs is empty', () => {
    const result = makePattern({ descentRateMph: 12, glideRatio: 2.6, legs: [] });
    expect(result).toEqual([]);
  });

  it('returns empty array when descentRateMph is falsy', () => {
    const result = makePattern({ descentRateMph: 0, glideRatio: 2.6, legs: [{ altitude: 300, direction: 90 }] });
    expect(result).toEqual([]);
  });

  it('returns empty array when descentRateMph is not a number', () => {
    const result = makePattern({
      descentRateMph: 'twelve' as any,
      glideRatio: 2.6,
      legs: [{ altitude: 300, direction: 90 }]
    });
    expect(result).toEqual([]);
  });

  it('creates a pattern with single leg', () => {
    const result = makePattern({
      descentRateMph: 12,
      glideRatio: 2.6,
      legs: [{ altitude: 300, direction: 0 }]
    });

    expect(result.length).toBeGreaterThan(1);

    // First point should be at origin with alt 0, time 0
    expect(result[0].geometry.coordinates).toEqual([0, 0]);
    expect(result[0].properties.alt).toBe(0);
    expect(result[0].properties.time).toBe(0);
    expect(result[0].properties.pom).toBe(0);

    // Last point should have altitude equal to leg altitude
    const lastPoint = result[result.length - 1];
    expect(lastPoint.properties.alt).toBeCloseTo(300, 0);
    expect(lastPoint.properties.pom).toBe(1);
  });

  it('creates points with negative time (going backwards)', () => {
    const result = makePattern({
      descentRateMph: 12,
      glideRatio: 2.6,
      legs: [{ altitude: 300, direction: 0 }]
    });

    // All points after the first should have negative time
    for (let i = 1; i < result.length; i++) {
      expect(result[i].properties.time).toBeLessThan(0);
    }
  });

  it('increases altitude along the pattern', () => {
    const result = makePattern({
      descentRateMph: 12,
      glideRatio: 2.6,
      legs: [{ altitude: 300, direction: 0 }]
    });

    // Altitude should increase as we go through the pattern
    for (let i = 1; i < result.length; i++) {
      expect(result[i].properties.alt).toBeGreaterThanOrEqual(result[i - 1].properties.alt);
    }
  });

  it('creates pattern with multiple legs', () => {
    const result = makePattern({
      descentRateMph: 12,
      glideRatio: 2.6,
      legs: [
        { altitude: 300, direction: 90 },
        { altitude: 300, direction: 90 },
        { altitude: 300, direction: 90 }
      ]
    });

    // Total altitude should be sum of all legs
    const lastPoint = result[result.length - 1];
    expect(lastPoint.properties.alt).toBeCloseTo(900, 0);
  });

  it('marks points of manoeuvre (pom) at leg transitions', () => {
    const result = makePattern({
      descentRateMph: 12,
      glideRatio: 2.6,
      legs: [
        { altitude: 300, direction: 90 },
        { altitude: 300, direction: 90 }
      ]
    });

    // Count POM markers
    const poms = result.filter(p => p.properties.pom === 1);
    expect(poms.length).toBeGreaterThanOrEqual(2);
  });

  it('respects descent rate for time calculations', () => {
    const slowResult = makePattern({
      descentRateMph: 6,
      glideRatio: 2.6,
      legs: [{ altitude: 300, direction: 0 }]
    });

    const fastResult = makePattern({
      descentRateMph: 12,
      glideRatio: 2.6,
      legs: [{ altitude: 300, direction: 0 }]
    });

    // Slower descent should take more time (more negative)
    const slowTime = slowResult[slowResult.length - 1].properties.time;
    const fastTime = fastResult[fastResult.length - 1].properties.time;

    expect(slowTime).toBeLessThan(fastTime);
  });

  it('respects glide ratio for horizontal distance', () => {
    const lowGlideResult = makePattern({
      descentRateMph: 12,
      glideRatio: 2.0,
      legs: [{ altitude: 300, direction: 0 }]
    });

    const highGlideResult = makePattern({
      descentRateMph: 12,
      glideRatio: 3.0,
      legs: [{ altitude: 300, direction: 0 }]
    });

    // Higher glide ratio should result in longer horizontal distance
    const lowLat = lowGlideResult[lowGlideResult.length - 1].geometry.coordinates[1];
    const highLat = highGlideResult[highGlideResult.length - 1].geometry.coordinates[1];

    expect(highLat).toBeGreaterThan(lowLat);
  });

  it('handles leg direction changes', () => {
    const result = makePattern({
      descentRateMph: 12,
      glideRatio: 2.6,
      legs: [
        { altitude: 300, direction: 90 },
        { altitude: 300, direction: -90 }
      ]
    });

    expect(result.length).toBeGreaterThan(1);

    // Pattern should complete without error
    const lastPoint = result[result.length - 1];
    expect(lastPoint.properties.alt).toBeCloseTo(600, 0);
  });
});
