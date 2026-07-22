/**
 * Tests for the validating loaders: garbage in, valid documents out.
 * The requirement is graceful degradation — old or corrupt localStorage
 * data must never crash the app.
 */
import { createVersionedCodec } from '../util/storage';

import {
  DEFAULT_FLOCKING_PARAMS,
  DEFAULT_MANOEUVRE_PARAMS,
  DEFAULT_PATTERN_PARAMS,
  DEFAULT_SETTINGS,
  DEFAULT_TARGET,
  SCHEMA_VERSION,
  migrateCustomCourses,
  migrateCustomLocations,
  migrateFlockingParams,
  migrateManoeuvreConfig,
  migrateManoeuvreParams,
  migratePatternParams,
  migratePresets,
  migrateSettings,
  migrateStoredTracks,
  migrateStoredWinds,
  migrateTarget,
  migrateTargetsByMode,
  migrateTouchedSettings,
  seedTouchedSettings
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

describe('migrateTargetsByMode', () => {
  it.each(GARBAGE.map(g => [g]))('returns an empty map for %j', raw => {
    expect(migrateTargetsByMode(raw)).toEqual({});
  });

  it('validates each mode entry and drops garbage ones', () => {
    const result = migrateTargetsByMode({
      pattern: { target: { lat: 40.1, lng: -74.5 }, finalHeading: 135 },
      flocking: { target: { lat: 1234, lng: -999 }, finalHeading: -90 },
      swoop: 'nonsense',
      '': { target: { lat: 1, lng: 2 }, finalHeading: 0 }
    });

    expect(Object.keys(result).sort()).toEqual(['flocking', 'pattern']);
    expect(result.pattern.finalHeading).toBe(135);
    // out-of-range values are clamped/normalized by migrateTarget
    expect(result.flocking.target.lat).toBe(90);
    expect(result.flocking.finalHeading).toBe(270);
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

describe('migrateFlockingParams', () => {
  it.each(GARBAGE.map(g => [g]))('returns defaults for %j', raw => {
    expect(migrateFlockingParams(raw)).toEqual(DEFAULT_FLOCKING_PARAMS);
  });

  it('keeps valid params', () => {
    const params = {
      mode: 'free',
      windowTopFt: 14000,
      windowBottomFt: 5000,
      descentRateMph: 40,
      horizontalSpeedMph: 70,
      direction: 145,
      canopyDirection: 200,
      referencePoint: { lat: 28.2, lng: -82.15 },
      jumprun: { directionDeg: 180, offsetMi: 1.5 },
      exitAlongMi: -2,
      targetRadiusMi: 0.5,
      solveCorridors: [
        {
          directionDeg: 90,
          offsetMinMi: -0.5,
          offsetMaxMi: 0.5,
          alongMinMi: -3,
          alongMaxMi: 1,
          canopyToleranceDeg: 10
        }
      ],
      showGrid: true
    };

    expect(migrateFlockingParams(params)).toEqual(params);
  });

  it('defaults the newer fields on legacy params', () => {
    // A pre-decoupling stored doc has none of the new fields
    const migrated = migrateFlockingParams({
      windowTopFt: 12000,
      windowBottomFt: 4000,
      descentRateMph: 21,
      horizontalSpeedMph: 50,
      direction: 'into-wind',
      distanceUnit: 'mi',
      referencePoint: null
    });

    expect(migrated.mode).toBe('classic');
    expect(migrated.canopyDirection).toBe('follow-jumprun');
    expect(migrated.jumprun).toEqual({ directionDeg: 'into-wind', offsetMi: 0 });
    expect(migrated.exitAlongMi).toBe(0);
    expect(migrated.targetRadiusMi).toBe(0.25);
    expect(migrated.showGrid).toBe(false);
  });

  it('validates the mode and the free-mode fields', () => {
    expect(migrateFlockingParams({ mode: 'free' }).mode).toBe('free');
    expect(migrateFlockingParams({ mode: 'solve' }).mode).toBe('solve');
    expect(migrateFlockingParams({ mode: 'telepathy' }).mode).toBe('classic');
    expect(migrateFlockingParams({ canopyDirection: 400 }).canopyDirection).toBe(40);
    expect(migrateFlockingParams({ canopyDirection: 'weird' }).canopyDirection)
      .toBe('follow-jumprun');
    expect(migrateFlockingParams({ exitAlongMi: -99 }).exitAlongMi).toBe(-20);
  });

  it('validates and clamps a jumprun config', () => {
    expect(migrateFlockingParams({
      jumprun: { directionDeg: 400, offsetMi: 99 }
    }).jumprun).toEqual({ directionDeg: 40, offsetMi: 10 });
    expect(migrateFlockingParams({
      jumprun: { directionDeg: 'into-wind', offsetMi: -0.5 }
    }).jumprun).toEqual({ directionDeg: 'into-wind', offsetMi: -0.5 });
  });

  it('migrates the short-lived auto/pinned jumprun shapes', () => {
    expect(migrateFlockingParams({ jumprun: { mode: 'auto' } }).jumprun)
      .toEqual({ directionDeg: 'into-wind', offsetMi: 0 });
    expect(migrateFlockingParams({
      jumprun: { mode: 'pinned', directionDeg: 90, offsetMi: 1, exitAlongMi: -2 }
    }).jumprun).toEqual({ directionDeg: 90, offsetMi: 1 });
    expect(migrateFlockingParams({ jumprun: 'nonsense' }).jumprun)
      .toEqual({ directionDeg: 'into-wind', offsetMi: 0 });
  });

  it('keeps the into-wind direction and normalizes numeric ones', () => {
    expect(migrateFlockingParams({ direction: 'into-wind' }).direction).toBe('into-wind');
    expect(migrateFlockingParams({ direction: 370 }).direction).toBe(10);
    expect(migrateFlockingParams({ direction: -45 }).direction).toBe(315);
    // unknown strings and non-finite numbers fall back to the default
    expect(migrateFlockingParams({ direction: 'north' }).direction).toBe('into-wind');
    expect(migrateFlockingParams({ direction: NaN }).direction).toBe('into-wind');
  });

  it('clamps absurd window and speed values', () => {
    const migrated = migrateFlockingParams({
      windowTopFt: 1e9,
      windowBottomFt: -500,
      descentRateMph: 0,
      horizontalSpeedMph: 100000
    });

    expect(migrated.windowTopFt).toBe(30000);
    expect(migrated.windowBottomFt).toBe(0);
    expect(migrated.descentRateMph).toBe(1);
    expect(migrated.horizontalSpeedMph).toBe(150);
  });

  it('drops an invalid reference point and unknown distance units', () => {
    expect(migrateFlockingParams({ referencePoint: { lat: 'x', lng: 0 } }).referencePoint)
      .toBeNull();
    expect(migrateFlockingParams({ referencePoint: 42 }).referencePoint).toBeNull();
    // reference point coordinates are clamped
    expect(migrateFlockingParams({ referencePoint: { lat: 95, lng: -200 } }).referencePoint)
      .toEqual({ lat: 90, lng: -180 });
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
      units: { altitude: 'm', windSpeed: 'furlongs', distance: 'nm' } // partly invalid
    });

    expect(result.showPoms).toBe(false);
    expect(result.interpolateWind).toBe(DEFAULT_SETTINGS.interpolateWind);
    expect(result.limitWind).toBe(60000);
    expect(result.units.altitude).toBe('m');
    expect(result.units.windSpeed).toBe('kts');
    expect(result.units.distance).toBe('nm');
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

describe('migrateTouchedSettings', () => {
  it('keeps valid setting keys and drops unknown or non-string entries', () => {
    expect(
      migrateTouchedSettings(['limitWind', 'bogus', 42, null, 'displayWindArrow'])
    ).toEqual(['limitWind', 'displayWindArrow']);
  });

  it('returns an empty list for garbage', () => {
    expect(migrateTouchedSettings(undefined)).toEqual([]);
    expect(migrateTouchedSettings('limitWind')).toEqual([]);
    expect(migrateTouchedSettings({ limitWind: true })).toEqual([]);
  });
});

describe('seedTouchedSettings', () => {
  it('returns no keys for pristine default settings', () => {
    expect(seedTouchedSettings(DEFAULT_SETTINGS)).toEqual([]);
  });

  it('returns exactly the keys that differ from the global default', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      limitWind: 1234,
      showPoms: !DEFAULT_SETTINGS.showPoms
    };

    expect(seedTouchedSettings(settings).sort()).toEqual(['limitWind', 'showPoms']);
  });

  it('compares nested objects by value', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      units: { ...DEFAULT_SETTINGS.units }
    };

    expect(seedTouchedSettings(settings)).toEqual([]);

    settings.units.altitude = settings.units.altitude === 'ft' ? 'm' : 'ft';
    expect(seedTouchedSettings(settings)).toEqual(['units']);
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

describe('migrateStoredWinds', () => {
  const fetchedIso = '2026-07-16T15:00:00.000Z';
  const validIso = '2026-07-16T18:00:00.000Z';

  it('round-trips a fetched profile, reviving Dates from ISO strings', () => {
    const stored = JSON.parse(JSON.stringify({
      winds: [
        { altFt: 0, direction: 260, speedKts: 4.1, source: 'KZPH', validTime: validIso },
        { altFt: 1000, direction: 280, speedKts: 12.5, tempC: 21, source: 'open-meteo' }
      ],
      groundSource: 'dropzone-specific',
      aloftSource: 'open-meteo',
      validTime: validIso,
      center: { lat: 28.2, lng: -82.1 },
      meta: {
        model: 'best_match',
        fetchedAt: fetchedIso,
        location: { lat: 28.2, lng: -82.1 },
        elevationFt: 90
      }
    }));

    const profile = migrateStoredWinds(stored);

    expect(profile).not.toBeNull();
    expect(profile!.winds).toHaveLength(2);
    expect(profile!.winds[0].source).toBe('KZPH');
    expect(profile!.winds[0].validTime).toBeInstanceOf(Date);
    expect(profile!.winds[0].validTime!.toISOString()).toBe(validIso);
    expect(profile!.winds[1].tempC).toBe(21);
    expect(profile!.groundSource).toBe('dropzone-specific');
    expect(profile!.aloftSource).toBe('open-meteo');
    expect(profile!.validTime).toBeInstanceOf(Date);
    expect(profile!.meta?.fetchedAt).toBeInstanceOf(Date);
    expect(profile!.meta?.fetchedAt!.toISOString()).toBe(fetchedIso);
    expect(profile!.meta?.model).toBe('best_match');
    expect(profile!.meta?.elevationFt).toBe(90);
    expect(profile!.center).toEqual({ lat: 28.2, lng: -82.1 });
  });

  it('round-trips a manual profile', () => {
    const stored = JSON.parse(JSON.stringify({
      winds: [{ altFt: 0, direction: 90, speedKts: 10 }],
      groundSource: 'manual',
      aloftSource: 'manual'
    }));
    const profile = migrateStoredWinds(stored);

    expect(profile).toEqual({
      winds: [{ altFt: 0, direction: 90, speedKts: 10 }],
      groundSource: 'manual',
      aloftSource: 'manual'
    });
  });

  it('returns null for garbage and empty input', () => {
    expect(migrateStoredWinds(undefined)).toBeNull();
    expect(migrateStoredWinds(null)).toBeNull();
    expect(migrateStoredWinds('gibberish')).toBeNull();
    expect(migrateStoredWinds(42)).toBeNull();
    expect(migrateStoredWinds({})).toBeNull();
    expect(migrateStoredWinds({ winds: 'nope' })).toBeNull();
    expect(migrateStoredWinds({ winds: [] })).toBeNull();
    expect(migrateStoredWinds({ winds: [1, 'two', null] })).toBeNull();
  });

  it('degrades invalid fields without throwing', () => {
    const profile = migrateStoredWinds({
      winds: [
        { altFt: 'high', direction: 725, speedKts: 1e9 },
        null,
        { altFt: 500, direction: 90, speedKts: 8, validTime: 'not-a-date' }
      ],
      groundSource: 'mystery-source',
      aloftSource: 7,
      validTime: 'also-not-a-date',
      center: { lat: 'x', lng: 0 },
      meta: { fetchedAt: {}, model: 5 }
    });

    expect(profile).not.toBeNull();
    expect(profile!.winds).toHaveLength(2);
    expect(profile!.winds[0].altFt).toBe(0);
    expect(profile!.winds[0].direction).toBe(5); // 725 normalized
    expect(profile!.winds[1].validTime).toBeUndefined();
    expect(profile!.groundSource).toBe('manual');
    expect(profile!.aloftSource).toBe('manual');
    expect(profile!.validTime).toBeUndefined();
    expect(profile!.center).toBeUndefined();
    expect(profile!.meta?.fetchedAt).toBeUndefined();
    expect(profile!.meta?.model).toBeUndefined();
  });

  it('works through the versioned codec (parse of stringified envelope)', () => {
    const codec = createVersionedCodec<ReturnType<typeof migrateStoredWinds>>(
      SCHEMA_VERSION, migrateStoredWinds
    );
    const profile = migrateStoredWinds({
      winds: [{ altFt: 0, direction: 180, speedKts: 6, validTime: validIso }],
      groundSource: 'manual',
      aloftSource: 'open-meteo',
      meta: { fetchedAt: fetchedIso }
    });

    const restored = codec.parse(codec.stringify(profile));

    expect(restored).toEqual(profile);
    expect(restored!.winds[0].validTime).toBeInstanceOf(Date);
    expect(codec.parse('garbage')).toBeNull();
    expect(codec.parse('{"schemaVersion":1,"doc":{"winds":[]}}')).toBeNull();
  });
});
