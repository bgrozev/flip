/**
 * Tests for the validating loaders: garbage in, valid documents out.
 * The requirement is graceful degradation — old or corrupt localStorage
 * data must never crash the app.
 */
import {
  DEFAULT_MANOEUVRE_PARAMS,
  DEFAULT_PATTERN_PARAMS,
  DEFAULT_SETTINGS,
  DEFAULT_TARGET,
  migrateCustomCourses,
  migrateManoeuvreConfig,
  migrateManoeuvreParams,
  migratePatternParams,
  migratePresets,
  migrateSettings,
  migrateTarget
} from './model';

const GARBAGE: unknown[] = [
  undefined,
  null,
  42,
  'garbage',
  true,
  [],
  [1, 2, 3],
  {},
  { random: 'junk' }
];

describe('migrateTarget', () => {
  it.each(GARBAGE.map(g => [g]))('returns defaults for %j', raw => {
    expect(migrateTarget(raw)).toEqual(DEFAULT_TARGET);
  });

  it('keeps a valid target', () => {
    const target = { target: { lat: 40.1, lng: -74.5 }, finalHeading: 135 };

    expect(migrateTarget(target)).toEqual(target);
  });

  it('clamps out-of-range coordinates and normalizes heading', () => {
    const result = migrateTarget({
      target: { lat: 1234, lng: -999 },
      finalHeading: -90
    });

    expect(result.target.lat).toBe(90);
    expect(result.target.lng).toBe(-180);
    expect(result.finalHeading).toBe(270);
  });

  it('defaults non-numeric fields individually', () => {
    const result = migrateTarget({
      target: { lat: 'a', lng: 10 },
      finalHeading: 'x'
    });

    expect(result.target.lat).toBe(DEFAULT_TARGET.target.lat);
    expect(result.target.lng).toBe(10);
    expect(result.finalHeading).toBe(DEFAULT_TARGET.finalHeading);
  });
});

describe('migratePatternParams', () => {
  it.each(GARBAGE.map(g => [g]))('returns defaults for %j', raw => {
    expect(migratePatternParams(raw)).toEqual(DEFAULT_PATTERN_PARAMS);
  });

  it('keeps valid params', () => {
    const params = {
      type: 'two-leg',
      descentRateMph: 12,
      glideRatio: 2.5,
      legs: [
        { altitude: 400, direction: 0 },
        { altitude: 500, direction: 90 },
        { altitude: 600, direction: 270 }
      ]
    };

    expect(migratePatternParams(params)).toEqual(params);
  });

  it('clamps absurd altitudes and rates', () => {
    const result = migratePatternParams({
      ...DEFAULT_PATTERN_PARAMS,
      descentRateMph: 100000,
      legs: [{ altitude: 1e9, direction: 0 }]
    });

    expect(result.descentRateMph).toBe(60);
    expect(result.legs[0].altitude).toBe(3000);
  });

  it('always produces exactly 3 legs', () => {
    expect(migratePatternParams({ legs: [] }).legs).toHaveLength(3);
    expect(migratePatternParams({ legs: [{ altitude: 400, direction: 0 }] }).legs).toHaveLength(3);
    expect(
      migratePatternParams({ legs: Array(10).fill({ altitude: 400, direction: 0 }) }).legs
    ).toHaveLength(3);
  });

  it('rejects unknown pattern types', () => {
    expect(migratePatternParams({ type: 'five-leg' }).type).toBe('three-leg');
  });
});

describe('migrateManoeuvreConfig', () => {
  it.each(GARBAGE.map(g => [g]))('returns a "none" config for %j', raw => {
    expect(migrateManoeuvreConfig(raw)).toEqual({ type: 'none' });
  });

  it('keeps a valid parameters config', () => {
    const config = {
      type: 'parameters',
      params: { offsetXFt: 200, offsetYFt: 100, altitudeFt: 800, duration: 6, left: false }
    };

    expect(migrateManoeuvreConfig(config)).toEqual(config);
  });

  it('defaults invalid params fields', () => {
    const result = migrateManoeuvreConfig({
      type: 'parameters',
      params: { offsetXFt: 'x', offsetYFt: 1e9 }
    });

    expect(result.params).toEqual({
      ...DEFAULT_MANOEUVRE_PARAMS,
      offsetYFt: 3000
    });
  });

  it('accepts legacy {lat, lng} track data', () => {
    const result = migrateManoeuvreConfig({
      type: 'track',
      trackName: 'jump1',
      trackData: [
        { lat: 33.5, lng: -112.0, alt: 0, time: 0, pom: 1 },
        { lat: 33.6, lng: -112.1, alt: 500, time: -30000, pom: 0 }
      ]
    });

    expect(result.type).toBe('track');
    expect(result.trackName).toBe('jump1');
    expect(result.trackData).toHaveLength(2);
    expect(result.trackData![0].geometry.coordinates).toEqual([-112.0, 33.5]);
  });

  it('drops garbage track data (degrades to empty manoeuvre)', () => {
    const result = migrateManoeuvreConfig({ type: 'track', trackData: 'nonsense' });

    expect(result.type).toBe('track');
    expect(result.trackData).toBeUndefined();
  });

  it('validates sample fields', () => {
    expect(migrateManoeuvreConfig({ type: 'samples', sampleIndex: 2, sampleLeft: false }))
      .toEqual({ type: 'samples', sampleIndex: 2, sampleLeft: false });
    expect(migrateManoeuvreConfig({ type: 'samples', sampleIndex: -1 }).sampleIndex)
      .toBeUndefined();
    expect(migrateManoeuvreConfig({ type: 'samples', sampleIndex: 1.5 }).sampleIndex)
      .toBeUndefined();
  });
});

describe('migrateSettings', () => {
  it.each(GARBAGE.map(g => [g]))('returns defaults for %j', raw => {
    expect(migrateSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });

  it('preserves valid overrides and defaults invalid fields', () => {
    const result = migrateSettings({
      showPoms: false,
      interpolateWind: 'yes', // invalid
      limitWind: 1e12, // clamped
      units: { altitude: 'm', windSpeed: 'furlongs' } // partly invalid
    });

    expect(result.showPoms).toBe(false);
    expect(result.interpolateWind).toBe(DEFAULT_SETTINGS.interpolateWind);
    expect(result.limitWind).toBe(60000);
    expect(result.units.altitude).toBe('m');
    expect(result.units.windSpeed).toBe('kts');
  });
});

describe('migratePresets', () => {
  it.each(GARBAGE.filter(g => !Array.isArray(g)).map(g => [g]))('returns [] for %j', raw => {
    expect(migratePresets(raw)).toEqual([]);
  });

  it('drops non-object entries and repairs the rest', () => {
    const result = migratePresets([
      'garbage',
      42,
      null,
      {
        id: 'preset_1',
        name: 'Main',
        target: { target: { lat: 1, lng: 2 }, finalHeading: 90 },
        patternParams: DEFAULT_PATTERN_PARAMS,
        manoeuvre: { type: 'none' },
        selectedCourseId: null,
        createdAt: 123
      },
      { name: 'no id or content' }
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('preset_1');
    expect(result[0].name).toBe('Main');
    expect(result[0].target.finalHeading).toBe(90);
    // Second entry gets defaults for everything missing
    expect(result[1].id).toBe('preset_migrated_4');
    expect(result[1].name).toBe('no id or content');
    expect(result[1].target).toEqual(DEFAULT_TARGET);
    expect(result[1].patternParams).toEqual(DEFAULT_PATTERN_PARAMS);
    expect(result[1].manoeuvre).toEqual({ type: 'none' });
  });
});

describe('migrateCustomCourses', () => {
  it.each(GARBAGE.filter(g => !Array.isArray(g)).map(g => [g]))('returns [] for %j', raw => {
    expect(migrateCustomCourses(raw)).toEqual([]);
  });

  it('keeps valid courses and drops entries without id or location', () => {
    const valid = {
      id: 'custom-1',
      name: 'My course',
      type: 'speed',
      lat: 33.5,
      lng: -112.0,
      direction: 45,
      carveDirection: 'left'
    };

    const result = migrateCustomCourses([
      valid,
      { id: 'custom-2', name: 'no location', type: 'distance' },
      { name: 'no id', lat: 1, lng: 2 },
      'garbage'
    ]);

    expect(result).toEqual([valid]);
  });

  it('defaults invalid type and carveDirection', () => {
    const result = migrateCustomCourses([
      { id: 'c1', lat: 1, lng: 2, type: 'bogus', carveDirection: 'up', direction: 'x' }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('distance');
    expect(result[0].carveDirection).toBeUndefined();
    expect(result[0].direction).toBe(0);
    expect(result[0].name).toBe('Unnamed course');
  });
});

describe('migrateManoeuvreParams', () => {
  it('returns defaults for garbage', () => {
    expect(migrateManoeuvreParams(null)).toEqual(DEFAULT_MANOEUVRE_PARAMS);
    expect(migrateManoeuvreParams('x')).toEqual(DEFAULT_MANOEUVRE_PARAMS);
  });

  it('allows zero and negative depth offsets', () => {
    expect(migrateManoeuvreParams({ ...DEFAULT_MANOEUVRE_PARAMS, offsetXFt: 0 }).offsetXFt).toBe(0);
    expect(migrateManoeuvreParams({ ...DEFAULT_MANOEUVRE_PARAMS, offsetXFt: -500 }).offsetXFt).toBe(-500);
  });
});
