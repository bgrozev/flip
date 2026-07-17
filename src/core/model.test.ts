/**
 * Tests for the validating loaders: garbage in, valid documents out.
 * The requirement is graceful degradation — old or corrupt localStorage
 * data must never crash the app.
 */
import { createVersionedCodec } from '../util/storage';

import {
  DEFAULT_MANOEUVRE_PARAMS,
  DEFAULT_PATTERN_PARAMS,
  DEFAULT_SETTINGS,
  DEFAULT_TARGET,
  SCHEMA_VERSION,
  migrateCustomCourses,
  migrateCustomLocations,
  migrateManoeuvreConfig,
  migrateManoeuvreParams,
  migratePatternParams,
  migratePresets,
  migrateSettings,
  migrateStoredTracks,
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

  it('accepts known wind models and defaults unknown ones', () => {
    expect(migrateSettings({ windModel: 'icon_seamless' }).windModel).toBe('icon_seamless');
    expect(migrateSettings({ windModel: 'skynet_9000' }).windModel).toBe('best_match');
    expect(migrateSettings({}).windModel).toBe('best_match');
  });

  it('defaults a missing or invalid map provider to google', () => {
    expect(migrateSettings({}).mapProvider).toBe('google');
    expect(migrateSettings({ mapProvider: 'openlayers' }).mapProvider).toBe('google');
    expect(migrateSettings({ mapProvider: 42 }).mapProvider).toBe('google');
    expect(migrateSettings({ mapProvider: 'maplibre' }).mapProvider).toBe('maplibre');
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

describe('migrateCustomLocations', () => {
  it.each(GARBAGE.filter(g => !Array.isArray(g)).map(g => [g]))('returns [] for %j', raw => {
    expect(migrateCustomLocations(raw)).toEqual([]);
  });

  it('drops non-object entries', () => {
    expect(migrateCustomLocations([1, 2, 3])).toEqual([]);
  });

  it('keeps valid locations and drops entries without a name or location', () => {
    const valid = { name: 'Home DZ', lat: 28.2, lng: -82.1, direction: 270 };

    const result = migrateCustomLocations([
      valid,
      { name: 'no location', direction: 90 },
      { name: 'bad location', lat: 'x', lng: null },
      { lat: 1, lng: 2, direction: 0 },
      { name: '', lat: 1, lng: 2 },
      'garbage',
      null
    ]);

    expect(result).toEqual([valid]);
  });

  it('clamps coordinates, normalizes direction and defaults a missing one', () => {
    const result = migrateCustomLocations([
      { name: 'clamp', lat: 1234, lng: -999, direction: -90 },
      { name: 'no direction', lat: 10, lng: 20 }
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'clamp', lat: 90, lng: -180, direction: 270 });
    expect(result[1].direction).toBe(0);
  });

  it('migrates a legacy bare array through the versioned codec', () => {
    const codec = createVersionedCodec(SCHEMA_VERSION, migrateCustomLocations);
    const legacy = [{ name: 'Legacy', lat: 28.2, lng: -82.1, direction: 270 }];

    expect(codec.parse(JSON.stringify(legacy))).toEqual(legacy);
    expect(codec.parse(codec.stringify(legacy))).toEqual(legacy);
    expect(JSON.parse(codec.stringify(legacy))).toEqual({
      schemaVersion: SCHEMA_VERSION,
      doc: legacy
    });
  });

  it('never throws on corrupt stored values', () => {
    const codec = createVersionedCodec(SCHEMA_VERSION, migrateCustomLocations);

    expect(codec.parse('garbage')).toEqual([]);
    expect(codec.parse('{"doc":123}')).toEqual([]);
    expect(codec.parse('null')).toEqual([]);
  });
});

describe('migrateStoredTracks', () => {
  const point = { lat: 28.2, lng: -82.1, alt: 500, time: 0, pom: 0 };

  it.each(GARBAGE.filter(g => !Array.isArray(g)).map(g => [g]))('returns [] for %j', raw => {
    expect(migrateStoredTracks(raw)).toEqual([]);
  });

  it('drops non-object entries', () => {
    expect(migrateStoredTracks([1, 2, 3])).toEqual([]);
  });

  it('keeps a valid track and converts a legacy point array', () => {
    const result = migrateStoredTracks([
      { name: 'My swoop', description: 'left 270', track: [point] }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('My swoop');
    expect(result[0].description).toBe('left 270');
    expect(result[0].track).toHaveLength(1);
    expect(result[0].track[0].geometry.coordinates).toEqual([point.lng, point.lat]);
    expect(result[0].track[0].properties.alt).toBe(point.alt);
  });

  it('round-trips a track already in FlightPath form', () => {
    const path = migrateStoredTracks([{ name: 'a', description: '', track: [point] }])[0].track;
    const result = migrateStoredTracks([{ name: 'a', description: '', track: path }]);

    expect(result).toEqual([{ name: 'a', description: '', track: path }]);
  });

  it('drops nameless and empty tracks, keeps the good ones', () => {
    const result = migrateStoredTracks([
      { name: 'good', description: '', track: [point] },
      { name: 'no track', description: 'x' },
      { name: 'empty track', track: [] },
      { name: 'junk track', track: 'nonsense' },
      { name: '', track: [point] },
      { description: 'no name', track: [point] },
      'garbage'
    ]);

    expect(result.map(t => t.name)).toEqual(['good']);
  });

  it('defaults a missing or wrong-typed description', () => {
    const result = migrateStoredTracks([{ name: 'a', description: 42, track: [point] }]);

    expect(result[0].description).toBe('');
  });

  it('migrates a legacy bare array through the versioned codec', () => {
    const codec = createVersionedCodec(SCHEMA_VERSION, migrateStoredTracks);
    const legacy = [{ name: 'Legacy', description: 'd', track: [point] }];
    const migrated = codec.parse(JSON.stringify(legacy));

    expect(migrated).toHaveLength(1);
    expect(migrated[0].track[0].geometry.coordinates).toEqual([point.lng, point.lat]);
    expect(codec.parse(codec.stringify(migrated))).toEqual(migrated);
    expect(JSON.parse(codec.stringify(migrated)).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('never throws on corrupt stored values', () => {
    const codec = createVersionedCodec(SCHEMA_VERSION, migrateStoredTracks);

    expect(codec.parse('garbage')).toEqual([]);
    expect(codec.parse('{"doc":123}')).toEqual([]);
    expect(codec.parse('null')).toEqual([]);
  });
});
