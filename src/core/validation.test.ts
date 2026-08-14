import {
  LIMITS,
  clampNumber,
  getRangeErrorText,
  isNumberInRange,
  normalizeDirection,
  normalizeRelativeAngle
} from './validation';

describe('clampNumber', () => {
  it('returns the number when within bounds', () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
    expect(clampNumber(0, 0, 10)).toBe(0);
    expect(clampNumber(10, 0, 10)).toBe(10);
  });

  it('clamps to min and max', () => {
    expect(clampNumber(-5, 0, 10)).toBe(0);
    expect(clampNumber(1000000, 0, 10)).toBe(10);
  });

  it('supports negative bounds', () => {
    expect(clampNumber(-5000, -3000, 3000)).toBe(-3000);
    expect(clampNumber(-500, -3000, 3000)).toBe(-500);
  });

  it('works with only one bound', () => {
    expect(clampNumber(-5, 0, undefined)).toBe(0);
    expect(clampNumber(99, 0, undefined)).toBe(99);
    expect(clampNumber(99, undefined, 10)).toBe(10);
    expect(clampNumber(-99, undefined, 10)).toBe(-99);
  });

  it('returns the number unchanged without bounds', () => {
    expect(clampNumber(1e9)).toBe(1e9);
  });

  it('falls back to a bound for non-finite input', () => {
    expect(clampNumber(NaN, 0, 10)).toBe(0);
    expect(clampNumber(Infinity, 0, 10)).toBe(0);
    expect(clampNumber(-Infinity, undefined, 10)).toBe(10);
    expect(clampNumber(NaN)).toBe(0);
  });
});

describe('normalizeDirection', () => {
  it('keeps values already in range', () => {
    expect(normalizeDirection(0)).toBe(0);
    expect(normalizeDirection(359)).toBe(359);
  });

  it('wraps values at or above 360', () => {
    expect(normalizeDirection(360)).toBe(0);
    expect(normalizeDirection(725)).toBe(5);
  });

  it('wraps negative values, including below -360', () => {
    expect(normalizeDirection(-10)).toBe(350);
    expect(normalizeDirection(-370)).toBe(350);
    expect(normalizeDirection(-1000)).toBe(80);
  });

  it('returns 0 for non-finite input', () => {
    expect(normalizeDirection(NaN)).toBe(0);
    expect(normalizeDirection(Infinity)).toBe(0);
  });
});

describe('normalizeRelativeAngle', () => {
  it('keeps values already in range', () => {
    expect(normalizeRelativeAngle(0)).toBe(0);
    expect(normalizeRelativeAngle(90)).toBe(90);
    expect(normalizeRelativeAngle(-90)).toBe(-90);
  });

  // The Courses panel's approach angle: 0 - 270 read as -270 rather than +90.
  it('folds the long way round into the short one', () => {
    expect(normalizeRelativeAngle(-270)).toBe(90);
    expect(normalizeRelativeAngle(270)).toBe(-90);
    expect(normalizeRelativeAngle(-350)).toBe(10);
  });

  it('keeps 180 positive and never returns -180', () => {
    expect(normalizeRelativeAngle(180)).toBe(180);
    expect(normalizeRelativeAngle(-180)).toBe(180);
  });

  it('returns 0 for non-finite input', () => {
    expect(normalizeRelativeAngle(NaN)).toBe(0);
  });
});

describe('LIMITS', () => {
  it('defines a sane range for every limit', () => {
    for (const { min, max } of Object.values(LIMITS)) {
      expect(Number.isFinite(min)).toBe(true);
      expect(Number.isFinite(max)).toBe(true);
      expect(min).toBeLessThan(max);
    }
  });

  it('allows zero and negative manoeuvre depths', () => {
    expect(LIMITS.manoeuvreDepthFt.min).toBeLessThan(0);
    expect(clampNumber(0, LIMITS.manoeuvreDepthFt.min, LIMITS.manoeuvreDepthFt.max)).toBe(0);
  });

  it('allows a negative manoeuvre offset', () => {
    // A negative offset starts on the far side of the final line; the
    // illustration absorbs it by flying straight for longer before the turn
    // (see core/manoeuvre).
    expect(LIMITS.manoeuvreOffsetFt.min).toBeLessThan(0);
  });
});

describe('isNumberInRange', () => {
  describe('with both min and max', () => {
    it('returns true when number is within range', () => {
      expect(isNumberInRange(5, 0, 10)).toBe(true);
      expect(isNumberInRange(0, 0, 10)).toBe(true);
      expect(isNumberInRange(10, 0, 10)).toBe(true);
    });

    it('returns false when number is below min', () => {
      expect(isNumberInRange(-1, 0, 10)).toBe(false);
    });

    it('returns false when number is above max', () => {
      expect(isNumberInRange(11, 0, 10)).toBe(false);
    });
  });

  describe('with only min', () => {
    it('returns true when number is at or above min', () => {
      expect(isNumberInRange(5, 0, undefined)).toBe(true);
      expect(isNumberInRange(0, 0, undefined)).toBe(true);
      expect(isNumberInRange(1000, 0, undefined)).toBe(true);
    });

    it('returns false when number is below min', () => {
      expect(isNumberInRange(-1, 0, undefined)).toBe(false);
    });
  });

  describe('with only max', () => {
    it('returns true when number is at or below max', () => {
      expect(isNumberInRange(5, undefined, 10)).toBe(true);
      expect(isNumberInRange(10, undefined, 10)).toBe(true);
      expect(isNumberInRange(-100, undefined, 10)).toBe(true);
    });

    it('returns false when number is above max', () => {
      expect(isNumberInRange(11, undefined, 10)).toBe(false);
    });
  });

  describe('with no constraints', () => {
    it('returns true for any number', () => {
      expect(isNumberInRange(0, undefined, undefined)).toBe(true);
      expect(isNumberInRange(-1000, undefined, undefined)).toBe(true);
      expect(isNumberInRange(1000, undefined, undefined)).toBe(true);
    });
  });
});

describe('getRangeErrorText', () => {
  it('returns between message when both min and max are defined', () => {
    expect(getRangeErrorText(0, 10)).toBe('It must be between 0 and 10.');
    expect(getRangeErrorText(1, 100)).toBe('It must be between 1 and 100.');
  });

  it('returns at least message when only min is defined', () => {
    expect(getRangeErrorText(0, undefined)).toBe('It must be at least 0.');
    expect(getRangeErrorText(5, undefined)).toBe('It must be at least 5.');
  });

  it('returns at most message when only max is defined', () => {
    expect(getRangeErrorText(undefined, 10)).toBe('It must be at most 10.');
    expect(getRangeErrorText(undefined, 100)).toBe('It must be at most 100.');
  });

  it('returns invalid message when neither is defined', () => {
    expect(getRangeErrorText(undefined, undefined)).toBe('Invalid value.');
  });

  it('handles non-number values as undefined', () => {
    expect(getRangeErrorText(null as any, 10)).toBe('It must be at most 10.');
    expect(getRangeErrorText(5, null as any)).toBe('It must be at least 5.');
    expect(getRangeErrorText('foo' as any, 10)).toBe('It must be at most 10.');
  });
});
