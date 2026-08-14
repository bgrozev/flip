import {
  SOURCE_DZ,
  SOURCE_OPEN_METEO,
  WindProfile,
  beaufortColor,
  composeWinds,
  copyProfile,
  copyWindRow,
  createWindProfile,
  createWindRow,
  forecastHourOffset,
  sampleWindBands,
  getWindAt,
  prepWind,
  setGroundWind,
  windBandAltitudesFt,
  windRowSourceKind
} from './wind';

describe('createWindRow', () => {
  it('creates a wind row with numeric values', () => {
    const row = createWindRow(1000, 270, 15);

    expect(row.altFt).toBe(1000);
    expect(row.direction).toBe(270);
    expect(row.speedKts).toBe(15);
  });

  it('converts string values to numbers', () => {
    const row = createWindRow('2000' as any, '180' as any, '25' as any);

    expect(row.altFt).toBe(2000);
    expect(row.direction).toBe(180);
    expect(row.speedKts).toBe(25);
  });
});

describe('copyWindRow', () => {
  it('creates an independent copy', () => {
    const original = createWindRow(1000, 270, 15);
    const copy = copyWindRow(original);

    expect(copy).toEqual(original);

    // Modify original, copy should be unaffected
    original.altFt = 5000;
    expect(copy.altFt).toBe(1000);
  });
});

describe('createWindProfile', () => {
  it('creates a profile with a default empty row and manual sources', () => {
    const profile = createWindProfile();

    expect(profile.winds).toHaveLength(1);
    expect(profile.winds[0]).toEqual({ altFt: 0, direction: 0, speedKts: 0 });
    expect(profile.groundSource).toBe('manual');
    expect(profile.aloftSource).toBe('manual');
  });

  it('creates a profile with provided rows', () => {
    const profile = createWindProfile([
      createWindRow(0, 90, 5),
      createWindRow(1000, 180, 10)
    ]);

    expect(profile.winds).toHaveLength(2);
  });

  it('stores center location', () => {
    const center = { lat: 33.5, lng: -112.0 };
    const profile = createWindProfile([], center);

    expect(profile.center).toEqual(center);
  });
});

describe('copyProfile', () => {
  it('creates an independent copy', () => {
    const original: WindProfile = {
      winds: [createWindRow(0, 90, 5), createWindRow(1000, 180, 10)],
      groundSource: SOURCE_OPEN_METEO,
      aloftSource: SOURCE_OPEN_METEO
    };

    const copy = copyProfile(original);

    expect(copy.winds).toHaveLength(2);
    expect(copy.groundSource).toBe('open-meteo');
    expect(copy.aloftSource).toBe('open-meteo');

    // Modify original, copy should be unaffected
    original.winds[0].speedKts = 999;
    expect(copy.winds[0].speedKts).toBe(5);
  });
});

describe('setGroundWind', () => {
  it('replaces the first row when winds exist', () => {
    const profile = createWindProfile([
      createWindRow(0, 90, 5),
      createWindRow(1000, 180, 10)
    ]);

    const updated = setGroundWind(profile, createWindRow(0, 270, 8));

    expect(updated.winds[0].direction).toBe(270);
    expect(updated.winds[0].speedKts).toBe(8);
    expect(updated.winds).toHaveLength(2);
    // Pure: the input profile is unchanged
    expect(profile.winds[0].direction).toBe(90);
  });

  it('adds a row when winds array is empty', () => {
    const profile = createWindProfile([]);
    const updated = setGroundWind(profile, createWindRow(0, 270, 8));

    expect(updated.winds).toHaveLength(1);
    expect(updated.winds[0].direction).toBe(270);
  });
});

describe('composeWinds', () => {
  it('injects the observed ground row and marks its source', () => {
    const forecast: WindProfile = {
      winds: [createWindRow(0, 90, 5), createWindRow(1000, 180, 10)],
      groundSource: SOURCE_OPEN_METEO,
      aloftSource: SOURCE_OPEN_METEO
    };

    const effective = composeWinds(forecast, createWindRow(0, 300, 12));

    expect(effective.winds[0]).toEqual({ altFt: 0, direction: 300, speedKts: 12 });
    expect(effective.winds[1]).toEqual(forecast.winds[1]);
    expect(effective.groundSource).toBe(SOURCE_DZ);
    expect(effective.aloftSource).toBe(SOURCE_OPEN_METEO);
    // Pure: the forecast profile is unchanged
    expect(forecast.winds[0].direction).toBe(90);
    expect(forecast.groundSource).toBe(SOURCE_OPEN_METEO);
  });
});

describe('prepWind', () => {
  it('drops rows whose altitude is out of order', () => {
    const profile = createWindProfile([
      createWindRow(0, 90, 5),
      createWindRow(1000, 180, 10),
      createWindRow(500, 270, 20),
      createWindRow(2000, 300, 25)
    ]);

    const prepped = prepWind(profile);

    expect(prepped.winds.map(w => w.altFt)).toEqual([0, 1000, 2000]);
    // Pure: the input profile is unchanged
    expect(profile.winds).toHaveLength(4);
  });
});

describe('getWindAt', () => {
  let winds: WindProfile;

  beforeEach(() => {
    winds = createWindProfile([
      createWindRow(0, 90, 5),
      createWindRow(1000, 180, 10),
      createWindRow(3000, 270, 20)
    ]);
  });

  it('returns default wind for empty winds array', () => {
    const wind = getWindAt(createWindProfile([]), 500, false);

    expect(wind.altFt).toBe(0);
    expect(wind.direction).toBe(0);
    expect(wind.speedKts).toBe(0);
  });

  it('returns exact match without interpolation', () => {
    const wind = getWindAt(winds, 1000, false);

    expect(wind.altFt).toBe(1000);
    expect(wind.direction).toBe(180);
    expect(wind.speedKts).toBe(10);
  });

  it('returns lower bracket without interpolation', () => {
    const wind = getWindAt(winds, 2000, false);

    expect(wind.altFt).toBe(1000);
    expect(wind.direction).toBe(180);
    expect(wind.speedKts).toBe(10);
  });

  it('returns first wind when altitude is below all rows', () => {
    winds = createWindProfile([
      createWindRow(500, 90, 5),
      createWindRow(1000, 180, 10)
    ]);
    const wind = getWindAt(winds, 100, false);

    expect(wind.altFt).toBe(500);
  });

  it('returns highest wind when altitude is above all rows', () => {
    const wind = getWindAt(winds, 5000, false);

    expect(wind.altFt).toBe(3000);
    expect(wind.direction).toBe(270);
  });

  describe('interpolation', () => {
    // Interpolation blends the wind vector (u/v components), not
    // direction/speed independently: between 180°@10 and 270°@20 the
    // vectors sum to u=10, v=5 at the midpoint, giving a direction
    // biased toward the stronger wind and a speed below the linear
    // average (the perpendicular components partially cancel).
    it('interpolates the wind vector at midpoint', () => {
      const wind = getWindAt(winds, 2000, true);

      expect(wind.altFt).toBe(2000);
      expect(wind.direction).toBeCloseTo(243.43494882292202, 9);
      expect(wind.speedKts).toBeCloseTo(11.180339887498949, 9); // sqrt(125)
    });

    it('interpolates the wind vector at quarter point', () => {
      const wind = getWindAt(winds, 1500, true);

      expect(wind.altFt).toBe(1500);
      expect(wind.direction).toBeCloseTo(213.69006752597977, 9);
      expect(wind.speedKts).toBeCloseTo(9.013878188659973, 9); // sqrt(81.25)
    });

    it('interpolates speed linearly when directions are equal', () => {
      const testWinds = createWindProfile([
        createWindRow(0, 135, 5),
        createWindRow(1000, 135, 15)
      ]);
      const wind = getWindAt(testWinds, 500, true);

      expect(wind.direction).toBeCloseTo(135, 9);
      expect(wind.speedKts).toBeCloseTo(10, 9);
    });

    it('falls back to lower bracket when no higher bracket exists', () => {
      const wind = getWindAt(winds, 5000, true);

      expect(wind.altFt).toBe(3000);
      expect(wind.direction).toBe(270);
    });

    it('normalizes direction to 0-360 range', () => {
      const testWinds = createWindProfile([
        createWindRow(0, 350, 5),
        createWindRow(1000, 10, 10)
      ]);

      // This tests direction handling - should handle wrap-around
      const wind = getWindAt(testWinds, 500, true);

      expect(wind.direction).toBeGreaterThanOrEqual(0);
      expect(wind.direction).toBeLessThan(360);
    });

    /** Angular distance between two directions in degrees (0..180). */
    function angularDiff(a: number, b: number): number {
      return Math.abs(((a - b + 540) % 360) - 180);
    }

    it('wraps across north going 350 -> 10', () => {
      const testWinds = createWindProfile([
        createWindRow(0, 350, 5),
        createWindRow(1000, 10, 10)
      ]);
      const wind = getWindAt(testWinds, 500, true);

      // Shortest arc passes through 0, biased toward the stronger row
      expect(angularDiff(wind.direction, 0)).toBeLessThan(10);
      expect(wind.direction).toBeCloseTo(3.36, 1);
      // Slightly below the linear average of the speeds (7.5)
      expect(wind.speedKts).toBeCloseTo(7.4, 1);
      expect(wind.speedKts).toBeLessThan(7.5);
    });

    it('wraps across north going 10 -> 350', () => {
      const testWinds = createWindProfile([
        createWindRow(0, 10, 10),
        createWindRow(1000, 350, 10)
      ]);
      const wind = getWindAt(testWinds, 500, true);

      // Equal speeds: midpoint direction is due north
      expect(angularDiff(wind.direction, 0)).toBeCloseTo(0, 9);
      expect(wind.speedKts).toBeLessThan(10);
      expect(wind.speedKts).toBeGreaterThan(9.8);
    });

    it('partially cancels opposing winds (vector, not linear)', () => {
      const testWinds = createWindProfile([
        createWindRow(0, 0, 10),
        createWindRow(1000, 180, 20)
      ]);
      const wind = getWindAt(testWinds, 500, true);

      // 10 kts from 0 and 20 kts from 180 average to 5 kts from 180 —
      // far below the linear speed average (15). This cancellation is
      // correct and desired.
      expect(wind.direction).toBeCloseTo(180, 9);
      expect(wind.speedKts).toBeCloseTo(5, 9);
    });
  });
});

describe('beaufortColor', () => {
  it('maps wind speeds to Beaufort-scale colors', () => {
    expect(beaufortColor(0)).toBe('#cccccc');
    expect(beaufortColor(2)).toBe('#aaddff');
    expect(beaufortColor(5)).toBe('#00cc88');
    expect(beaufortColor(8)).toBe('#44cc44');
    expect(beaufortColor(12)).toBe('#ffdd00');
    expect(beaufortColor(18)).toBe('#ff9900');
    expect(beaufortColor(25)).toBe('#ff4400');
    expect(beaufortColor(30)).toBe('#cc0000');
    expect(beaufortColor(40)).toBe('#880000');
  });
});

describe('windRowSourceKind', () => {
  it('classifies the known source constants', () => {
    expect(windRowSourceKind('open-meteo')).toBe('open-meteo');
    expect(windRowSourceKind('sounding')).toBe('sounding');
    expect(windRowSourceKind('manual')).toBe('manual');
  });

  it('treats a missing source as manual', () => {
    expect(windRowSourceKind(undefined)).toBe('manual');
    expect(windRowSourceKind('')).toBe('manual');
  });

  it('treats any other id as an observed station', () => {
    expect(windRowSourceKind('KZPH')).toBe('station');
    expect(windRowSourceKind('csc-wx')).toBe('station');
  });

  it('classifies rows produced by the composition helpers', () => {
    const composed = composeWinds(
      createWindProfile([createWindRow(0, 90, 5, { source: 'open-meteo' })]),
      createWindRow(0, 180, 8, { source: 'KABC' })
    );

    expect(windRowSourceKind(composed.winds[0].source)).toBe('station');
    // A manually edited row loses its provenance (createWindRow without
    // extras), which is exactly what marks it as manual in the UI.
    expect(windRowSourceKind(createWindRow(0, 0, 0).source)).toBe('manual');
  });
});

describe('sampleWindBands', () => {
  const profile = createWindProfile([
    createWindRow(0, 270, 8),
    createWindRow(1000, 280, 12),
    createWindRow(2000, 290, 16),
    createWindRow(5000, 300, 24)
  ]);

  it('starts with the profile ground row, flagged as ground', () => {
    const bands = sampleWindBands(profile, [1000, 2000], false);

    expect(bands[0]).toEqual({ altFt: 0, direction: 270, speedKts: 8, ground: true });
    expect(bands.slice(1).every(b => !b.ground)).toBe(true);
  });

  it('samples each requested band', () => {
    const bands = sampleWindBands(profile, [1000, 2000], false);

    expect(bands.map(b => b.altFt)).toEqual([0, 1000, 2000]);
    expect(bands[2].speedKts).toBe(16);
  });

  it('drops bands above the profile and duplicates of the ground row', () => {
    // 40000 is beyond the top level; 0 would repeat GND.
    const bands = sampleWindBands(profile, [0, 2000, 2000, 40000], false);

    expect(bands.map(b => b.altFt)).toEqual([0, 2000]);
  });

  it('sorts ascending regardless of the input order', () => {
    const bands = sampleWindBands(profile, [5000, 1000, 2000], false);

    expect(bands.map(b => b.altFt)).toEqual([0, 1000, 2000, 5000]);
  });

  it('interpolates between levels when asked', () => {
    const plain = sampleWindBands(profile, [1500], false);
    const smooth = sampleWindBands(profile, [1500], true);

    expect(smooth[1].speedKts).toBeGreaterThan(12);
    expect(smooth[1].speedKts).toBeLessThan(16);
    expect(smooth[1].speedKts).not.toBe(plain[1].speedKts);
  });

  it('returns nothing for an empty profile', () => {
    expect(sampleWindBands(createWindProfile([]), [1000], false)).toEqual([]);
  });
});

describe('forecastHourOffset', () => {
  const now = new Date('2026-07-29T12:00:00Z').getTime();

  it('is zero for no forecast time', () => {
    expect(forecastHourOffset(null, now)).toBe(0);
    expect(forecastHourOffset(undefined, now)).toBe(0);
  });

  it('counts whole hours forward', () => {
    expect(forecastHourOffset(new Date('2026-07-29T15:00:00Z'), now)).toBe(3);
    expect(forecastHourOffset(new Date('2026-07-29T15:20:00Z'), now)).toBe(3);
    expect(forecastHourOffset(new Date('2026-07-29T15:40:00Z'), now)).toBe(4);
  });

  it('never goes backwards', () => {
    expect(forecastHourOffset(new Date('2026-07-29T09:00:00Z'), now)).toBe(0);
  });

  it('counts from the current hour, not from the current minute', () => {
    // The offset indexes an hourly forecast whose row 0 is the CURRENT
    // HOUR, so it must be measured from that hour too. Measured from the
    // wall clock, asking for 13:00 at 11:55 rounds 1.08h to 1 and returns
    // the 12:00 forecast — off by one for most of every hour.
    const late = new Date('2026-07-29T11:55:00Z').getTime();

    expect(forecastHourOffset(new Date('2026-07-29T13:00:00Z'), late)).toBe(2);
    expect(forecastHourOffset(new Date('2026-07-29T12:00:00Z'), late)).toBe(1);
    // Still rounds to the NEAREST hourly row, so 11:59 belongs to 12:00.
    expect(forecastHourOffset(new Date('2026-07-29T11:59:00Z'), late)).toBe(1);
    expect(forecastHourOffset(new Date('2026-07-29T11:20:00Z'), late)).toBe(0);
  });
});

describe('windBandAltitudesFt', () => {
  it('returns empty for non-positive or non-finite ceilings', () => {
    expect(windBandAltitudesFt(0)).toEqual([]);
    expect(windBandAltitudesFt(-100)).toEqual([]);
    expect(windBandAltitudesFt(NaN)).toEqual([]);
  });

  it('steps by 500 up to a 3000 ft pattern ceiling', () => {
    expect(windBandAltitudesFt(3000)).toEqual([500, 1000, 1500, 2000, 2500, 3000]);
  });

  it('steps by 2000 up to a 12000 ft flocking ceiling', () => {
    expect(windBandAltitudesFt(12000)).toEqual([2000, 4000, 6000, 8000, 10000, 12000]);
  });

  it('always includes the exact ceiling as the top band', () => {
    const bands = windBandAltitudesFt(15000);
    expect(bands[bands.length - 1]).toBe(15000);
    expect(bands.length).toBeLessThanOrEqual(9);
  });
});
