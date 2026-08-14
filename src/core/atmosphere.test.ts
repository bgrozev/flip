import {
  DA_CAUTION_FT,
  DA_WARNING_FT,
  TEMP_COLD_C,
  TEMP_HOT_C,
  TEMP_VERY_HOT_C,
  daSeverity,
  densityAltitudeFt,
  relativeHumidityPct,
  standardPressurePa,
  temperatureSeverity,
  tryDensityAltitudeFt
} from './atmosphere';

describe('standardPressurePa', () => {
  it('matches ISA sea-level pressure at 0 ft', () => {
    expect(standardPressurePa(0)).toBeCloseTo(101325, -1);
  });

  it('decreases with elevation', () => {
    expect(standardPressurePa(5000)).toBeLessThan(standardPressurePa(0));
  });
});

describe('densityAltitudeFt', () => {
  it('is ~0 at sea level under ISA standard-day conditions (15C, 0% RH)', () => {
    expect(densityAltitudeFt(0, 15, 0)).toBeCloseTo(0, -2);
  });

  it('matches the ~5000ft/30C/dry rule-of-thumb (~8000ft DA)', () => {
    expect(densityAltitudeFt(5000, 30, 0)).toBeCloseTo(7800, -3);
  });

  it('increases with temperature', () => {
    const cool = densityAltitudeFt(1000, 10, 20);
    const hot = densityAltitudeFt(1000, 35, 20);

    expect(hot).toBeGreaterThan(cool);
  });

  it('increases with humidity', () => {
    const dry = densityAltitudeFt(1000, 30, 10);
    const humid = densityAltitudeFt(1000, 30, 90);

    expect(humid).toBeGreaterThan(dry);
  });
});

describe('tryDensityAltitudeFt', () => {
  it('returns undefined when any input is missing', () => {
    expect(tryDensityAltitudeFt(undefined, 20, 50)).toBeUndefined();
    expect(tryDensityAltitudeFt(1000, undefined, 50)).toBeUndefined();
    expect(tryDensityAltitudeFt(1000, 20, undefined)).toBeUndefined();
  });

  it('computes when all inputs are present', () => {
    expect(tryDensityAltitudeFt(1000, 20, 50)).not.toBeUndefined();
  });
});

describe('relativeHumidityPct', () => {
  it('is 100% when dewpoint equals temperature', () => {
    expect(relativeHumidityPct(20, 20)).toBeCloseTo(100, 0);
  });

  it('is lower when dewpoint is well below temperature', () => {
    expect(relativeHumidityPct(30, 5)).toBeLessThan(50);
  });
});

describe('daSeverity', () => {
  it('is normal when DA is close to elevation', () => {
    expect(daSeverity(1000, 1000)).toBe('normal');
  });

  it('is caution at/above the caution threshold', () => {
    expect(daSeverity(1000 + DA_CAUTION_FT, 1000)).toBe('caution');
  });

  it('is warning at/above the warning threshold', () => {
    expect(daSeverity(1000 + DA_WARNING_FT, 1000)).toBe('warning');
  });

  it('is normal when inputs are unknown', () => {
    expect(daSeverity(undefined, 1000)).toBe('normal');
    expect(daSeverity(1000, undefined)).toBe('normal');
  });
});

describe('temperatureSeverity', () => {
  it('is normal in between the thresholds', () => {
    expect(temperatureSeverity(20)).toBe('normal');
  });

  it('is cold at/below the cold threshold', () => {
    expect(temperatureSeverity(TEMP_COLD_C)).toBe('cold');
    expect(temperatureSeverity(TEMP_COLD_C - 5)).toBe('cold');
  });

  it('is hot at/above the hot threshold', () => {
    expect(temperatureSeverity(TEMP_HOT_C)).toBe('hot');
  });

  it('is veryHot at/above the very-hot threshold', () => {
    expect(temperatureSeverity(TEMP_VERY_HOT_C)).toBe('veryHot');
  });

  it('is normal when temperature is unknown', () => {
    expect(temperatureSeverity(undefined)).toBe('normal');
  });
});
