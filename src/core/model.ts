/**
 * Versioned document schemas: defaults + validating loaders for the
 * persisted documents (target, pattern params, manoeuvre config, settings,
 * presets, custom courses, custom locations, stored tracks).
 *
 * Every migrate*() function accepts unknown JSON and returns a valid
 * document, defaulting missing or invalid fields and clamping numeric
 * values into their limits. They never throw — old or corrupt localStorage
 * data must degrade gracefully, not crash the app.
 */
import {
  CourseParams,
  CourseType,
  CustomLocation,
  ManoeuvreConfig,
  ManoeuvreParams,
  ManoeuvreType,
  MAP_PROVIDERS,
  PatternLeg,
  PatternParams,
  PatternType,
  Preset,
  Settings,
  StoredTrack,
  Target
} from '../types';
import { DISTANCE_UNITS, FlockingParams } from './flocking';
import { migrateToFlightPath } from './migration';
import {
  AltitudeUnit,
  DEFAULT_UNIT_PREFERENCES,
  DescentRateUnit,
  PressureUnit,
  TemperatureUnit,
  UnitPreferences,
  WindSpeedUnit
} from './units';
import { LIMITS, NumericLimits, clampNumber, normalizeDirection } from './validation';
import {
  DEFAULT_WIND_MODEL,
  ForecastSource,
  OPEN_METEO_MODELS,
  SOURCE_DZ,
  SOURCE_MANUAL,
  SOURCE_OPEN_METEO,
  SOURCE_SOUNDING,
  WindProfile,
  WindProfileMeta,
  WindRow
} from './wind';

/** Schema version written with every persisted document. */
export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_TARGET: Target = {
  target: {
    lat: 28.21887,
    lng: -82.15122
  },
  finalHeading: 270
};

export const DEFAULT_PATTERN_PARAMS: PatternParams = {
  type: 'three-leg',
  descentRateMph: 9,
  glideRatio: 3.0,
  legs: [
    { altitude: 300, direction: 0 },
    { altitude: 300, direction: 270 },
    { altitude: 300, direction: 270 }
  ]
};

export const DEFAULT_MANOEUVRE_CONFIG: ManoeuvreConfig = { type: 'none' };

export const DEFAULT_MANOEUVRE_PARAMS: ManoeuvreParams = {
  offsetXFt: 300,
  offsetYFt: 150,
  altitudeFt: 900,
  duration: 8,
  left: true
};

// FWC's defaults: 12k -> 4k ft, the "Flow" preset, jumprun into wind
export const DEFAULT_FLOCKING_PARAMS: FlockingParams = {
  windowTopFt: 12000,
  windowBottomFt: 4000,
  descentRateMph: 21,
  horizontalSpeedMph: 50,
  direction: 'into-wind',
  distanceUnit: 'mi',
  referencePoint: null
};

export const DEFAULT_SETTINGS: Settings = {
  showPoms: true,
  showPomAltitudes: true,
  showPomTooltips: true,
  showPreWind: true,
  displayWindArrow: false,
  displayWindSummary: true,
  interpolateWind: true,
  correctPatternHeading: true,
  straightenLegs: true,
  useDzGroundWind: true,
  limitWind: 3000,
  windAloftSource: 'forecast',
  windModel: DEFAULT_WIND_MODEL,
  mapProvider: 'google',
  showPresets: true,
  showMeasureTool: false,
  highlightCorrespondingPoints: true,
  showCrabArrow: true,
  units: DEFAULT_UNIT_PREFERENCES
};

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function limitedNumber(value: unknown, fallback: number, limits: NumericLimits): number {
  return clampNumber(finiteNumber(value, fallback), limits.min, limits.max);
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

// ---------------------------------------------------------------------------
// Migrations (validate unknown JSON -> valid document)
// ---------------------------------------------------------------------------

export function migrateTarget(raw: unknown): Target {
  const r = isRecord(raw) ? raw : {};
  const location = isRecord(r.target) ? r.target : {};

  return {
    target: {
      lat: clampNumber(finiteNumber(location.lat, DEFAULT_TARGET.target.lat), -90, 90),
      lng: clampNumber(finiteNumber(location.lng, DEFAULT_TARGET.target.lng), -180, 180)
    },
    finalHeading: normalizeDirection(finiteNumber(r.finalHeading, DEFAULT_TARGET.finalHeading))
  };
}

const PATTERN_TYPES: readonly PatternType[] = ['none', 'one-leg', 'two-leg', 'three-leg'];

export function migratePatternParams(raw: unknown): PatternParams {
  const r = isRecord(raw) ? raw : {};
  const rawLegs = Array.isArray(r.legs) ? r.legs : [];

  // Always produce exactly 3 legs — the UI addresses legs[0..2] directly
  const legs: PatternLeg[] = DEFAULT_PATTERN_PARAMS.legs.map((fallback, i) => {
    const leg = isRecord(rawLegs[i]) ? rawLegs[i] as Record<string, unknown> : {};

    return {
      altitude: limitedNumber(leg.altitude, fallback.altitude, LIMITS.patternLegAltitudeFt),
      direction: normalizeDirection(finiteNumber(leg.direction, fallback.direction))
    };
  });

  return {
    type: oneOf(r.type, PATTERN_TYPES, DEFAULT_PATTERN_PARAMS.type),
    descentRateMph: limitedNumber(r.descentRateMph, DEFAULT_PATTERN_PARAMS.descentRateMph, LIMITS.descentRateMph),
    glideRatio: limitedNumber(r.glideRatio, DEFAULT_PATTERN_PARAMS.glideRatio, LIMITS.glideRatio),
    legs
  };
}

export function migrateManoeuvreParams(raw: unknown): ManoeuvreParams {
  const r = isRecord(raw) ? raw : {};

  return {
    offsetXFt: limitedNumber(r.offsetXFt, DEFAULT_MANOEUVRE_PARAMS.offsetXFt, LIMITS.manoeuvreOffsetXFt),
    offsetYFt: limitedNumber(r.offsetYFt, DEFAULT_MANOEUVRE_PARAMS.offsetYFt, LIMITS.manoeuvreOffsetYFt),
    altitudeFt: limitedNumber(r.altitudeFt, DEFAULT_MANOEUVRE_PARAMS.altitudeFt, LIMITS.manoeuvreAltitudeFt),
    duration: limitedNumber(r.duration, DEFAULT_MANOEUVRE_PARAMS.duration, LIMITS.manoeuvreDurationS),
    left: booleanOr(r.left, DEFAULT_MANOEUVRE_PARAMS.left)
  };
}

const MANOEUVRE_TYPES: readonly ManoeuvreType[] = ['none', 'parameters', 'track', 'samples'];

export function migrateManoeuvreConfig(raw: unknown): ManoeuvreConfig {
  const r = isRecord(raw) ? raw : {};
  const config: ManoeuvreConfig = {
    type: oneOf(r.type, MANOEUVRE_TYPES, DEFAULT_MANOEUVRE_CONFIG.type)
  };

  if (r.params !== undefined) {
    config.params = migrateManoeuvreParams(r.params);
  }
  if (typeof r.trackName === 'string') {
    config.trackName = r.trackName;
  }
  if (r.trackData !== undefined) {
    // Accepts current FlightPath or the legacy {lat, lng, ...} point format;
    // anything else becomes an empty path (degrades to "no manoeuvre").
    const path = migrateToFlightPath(r.trackData);

    if (path.length > 0) {
      config.trackData = path;
    }
  }
  if (typeof r.sampleIndex === 'number' && Number.isInteger(r.sampleIndex) && r.sampleIndex >= 0) {
    config.sampleIndex = r.sampleIndex;
  }
  if (typeof r.sampleLeft === 'boolean') {
    config.sampleLeft = r.sampleLeft;
  }
  if (typeof r.initiationAltitudeOffset === 'number' && Number.isFinite(r.initiationAltitudeOffset)) {
    config.initiationAltitudeOffset = r.initiationAltitudeOffset;
  }

  return config;
}

export function migrateFlockingParams(raw: unknown): FlockingParams {
  const r = isRecord(raw) ? raw : {};
  const d = DEFAULT_FLOCKING_PARAMS;

  let direction: FlockingParams['direction'];

  if (r.direction === 'into-wind') {
    direction = 'into-wind';
  } else if (typeof r.direction === 'number' && Number.isFinite(r.direction)) {
    direction = normalizeDirection(r.direction);
  } else {
    direction = d.direction;
  }

  let referencePoint: FlockingParams['referencePoint'] = null;

  if (isRecord(r.referencePoint) &&
      typeof r.referencePoint.lat === 'number' && Number.isFinite(r.referencePoint.lat) &&
      typeof r.referencePoint.lng === 'number' && Number.isFinite(r.referencePoint.lng)) {
    referencePoint = {
      lat: clampNumber(r.referencePoint.lat, -90, 90),
      lng: clampNumber(r.referencePoint.lng, -180, 180)
    };
  }

  return {
    windowTopFt: limitedNumber(r.windowTopFt, d.windowTopFt, LIMITS.flockingAltitudeFt),
    windowBottomFt: limitedNumber(r.windowBottomFt, d.windowBottomFt, LIMITS.flockingAltitudeFt),
    descentRateMph: limitedNumber(r.descentRateMph, d.descentRateMph, LIMITS.flockingDescentRateMph),
    horizontalSpeedMph:
      limitedNumber(r.horizontalSpeedMph, d.horizontalSpeedMph, LIMITS.flockingHorizontalSpeedMph),
    direction,
    distanceUnit: oneOf(r.distanceUnit, DISTANCE_UNITS, d.distanceUnit),
    referencePoint
  };
}

const ALTITUDE_UNITS: readonly AltitudeUnit[] = ['ft', 'm'];
const WIND_SPEED_UNITS: readonly WindSpeedUnit[] = ['kts', 'mps', 'mph'];
const DESCENT_RATE_UNITS: readonly DescentRateUnit[] = ['mph', 'kph', 'mps'];
const TEMPERATURE_UNITS: readonly TemperatureUnit[] = ['c', 'f'];
const PRESSURE_UNITS: readonly PressureUnit[] = ['hpa', 'pa', 'mmhg', 'inhg'];

function migrateUnits(raw: unknown): UnitPreferences {
  const r = isRecord(raw) ? raw : {};

  return {
    altitude: oneOf(r.altitude, ALTITUDE_UNITS, DEFAULT_UNIT_PREFERENCES.altitude),
    windSpeed: oneOf(r.windSpeed, WIND_SPEED_UNITS, DEFAULT_UNIT_PREFERENCES.windSpeed),
    descentRate: oneOf(r.descentRate, DESCENT_RATE_UNITS, DEFAULT_UNIT_PREFERENCES.descentRate),
    temperature: oneOf(r.temperature, TEMPERATURE_UNITS, DEFAULT_UNIT_PREFERENCES.temperature),
    pressure: oneOf(r.pressure, PRESSURE_UNITS, DEFAULT_UNIT_PREFERENCES.pressure)
  };
}

export function migrateSettings(raw: unknown): Settings {
  const r = isRecord(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;

  return {
    showPoms: booleanOr(r.showPoms, d.showPoms),
    showPomAltitudes: booleanOr(r.showPomAltitudes, d.showPomAltitudes),
    showPomTooltips: booleanOr(r.showPomTooltips, d.showPomTooltips),
    showPreWind: booleanOr(r.showPreWind, d.showPreWind),
    displayWindArrow: booleanOr(r.displayWindArrow, d.displayWindArrow),
    displayWindSummary: booleanOr(r.displayWindSummary, d.displayWindSummary),
    interpolateWind: booleanOr(r.interpolateWind, d.interpolateWind),
    correctPatternHeading: booleanOr(r.correctPatternHeading, d.correctPatternHeading),
    straightenLegs: booleanOr(r.straightenLegs, d.straightenLegs),
    useDzGroundWind: booleanOr(r.useDzGroundWind, d.useDzGroundWind),
    limitWind: limitedNumber(r.limitWind, d.limitWind, LIMITS.windAltFt),
    windAloftSource: oneOf(r.windAloftSource, ['forecast', 'sounding'] as const, d.windAloftSource),
    windModel: oneOf(r.windModel, OPEN_METEO_MODELS.map(m => m.id), d.windModel),
    mapProvider: oneOf(r.mapProvider, MAP_PROVIDERS, d.mapProvider),
    showPresets: booleanOr(r.showPresets, d.showPresets),
    showMeasureTool: booleanOr(r.showMeasureTool, d.showMeasureTool),
    highlightCorrespondingPoints: booleanOr(r.highlightCorrespondingPoints, d.highlightCorrespondingPoints),
    showCrabArrow: booleanOr(r.showCrabArrow, d.showCrabArrow),
    units: migrateUnits(r.units)
  };
}

/**
 * The list of Settings keys the user has explicitly changed ("touched").
 * Touched keys always keep the user's stored value; untouched keys may be
 * overridden by mode defaults (see modes/applyModeDefaults).
 */
export function migrateTouchedSettings(raw: unknown): (keyof Settings)[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const valid = Object.keys(DEFAULT_SETTINGS);

  return raw.filter(
    (key): key is keyof Settings => typeof key === 'string' && valid.includes(key)
  );
}

/**
 * Seed the touched list for users from before touch tracking existed: any
 * key whose stored value differs from the global default was necessarily
 * changed by the user. Preserves the pre-tracking resolution behavior
 * exactly.
 */
export function seedTouchedSettings(settings: Settings): (keyof Settings)[] {
  return (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).filter(
    key => JSON.stringify(settings[key]) !== JSON.stringify(DEFAULT_SETTINGS[key])
  );
}

export function migratePresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const presets: Preset[] = [];

  raw.forEach((entry, i) => {
    if (!isRecord(entry)) {
      return; // drop garbage entries
    }

    presets.push({
      id: typeof entry.id === 'string' && entry.id !== '' ? entry.id : `preset_migrated_${i}`,
      name: stringOr(entry.name, 'Unnamed'),
      target: migrateTarget(entry.target),
      patternParams: migratePatternParams(entry.patternParams),
      manoeuvre: migrateManoeuvreConfig(entry.manoeuvre),
      selectedCourseId: typeof entry.selectedCourseId === 'string' ? entry.selectedCourseId : null,
      createdAt: finiteNumber(entry.createdAt, 0)
    });
  });

  return presets;
}

const COURSE_TYPES: readonly CourseType[] = ['distance', 'zone-accuracy', 'speed'];

export function migrateCustomCourses(raw: unknown): CourseParams[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const courses: CourseParams[] = [];

  raw.forEach(entry => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id === '') {
      return; // drop garbage entries
    }

    // A course without a valid location is meaningless — drop it
    if (typeof entry.lat !== 'number' || !Number.isFinite(entry.lat) ||
        typeof entry.lng !== 'number' || !Number.isFinite(entry.lng)) {
      return;
    }

    const course: CourseParams = {
      id: entry.id,
      name: stringOr(entry.name, 'Unnamed course'),
      type: oneOf(entry.type, COURSE_TYPES, 'distance'),
      lat: clampNumber(entry.lat, -90, 90),
      lng: clampNumber(entry.lng, -180, 180),
      direction: normalizeDirection(finiteNumber(entry.direction, 0))
    };

    if (entry.carveDirection === 'left' || entry.carveDirection === 'right') {
      course.carveDirection = entry.carveDirection;
    }

    courses.push(course);
  });

  return courses;
}

export function migrateCustomLocations(raw: unknown): CustomLocation[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const locations: CustomLocation[] = [];

  raw.forEach(entry => {
    // The name is the identity: the UI keys and selects locations by it, so a
    // nameless entry can never be picked — drop it
    if (!isRecord(entry) || typeof entry.name !== 'string' || entry.name === '') {
      return;
    }

    // A location without a valid position is meaningless — drop it
    if (typeof entry.lat !== 'number' || !Number.isFinite(entry.lat) ||
        typeof entry.lng !== 'number' || !Number.isFinite(entry.lng)) {
      return;
    }

    locations.push({
      name: entry.name,
      lat: clampNumber(entry.lat, -90, 90),
      lng: clampNumber(entry.lng, -180, 180),
      direction: normalizeDirection(finiteNumber(entry.direction, 0))
    });
  });

  return locations;
}

export function migrateStoredTracks(raw: unknown): StoredTrack[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const tracks: StoredTrack[] = [];

  raw.forEach(entry => {
    // The name is the identity, as for custom locations — drop nameless entries
    if (!isRecord(entry) || typeof entry.name !== 'string' || entry.name === '') {
      return;
    }

    // Accepts current FlightPath or the legacy {lat, lng, ...} point format.
    // A track with no points draws nothing — drop it rather than keep a
    // selectable entry that silently does nothing.
    const track = migrateToFlightPath(entry.track);

    if (track.length === 0) {
      return;
    }

    tracks.push({
      name: entry.name,
      description: stringOr(entry.description, ''),
      track
    });
  });

  return tracks;
}

// ---------------------------------------------------------------------------
// Persisted wind profile
// ---------------------------------------------------------------------------

/** Revive a JSON-round-tripped Date (ISO string / epoch ms); undefined if unusable. */
function dateOr(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);

    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  return undefined;
}

const FORECAST_SOURCES: readonly ForecastSource[] =
  [SOURCE_MANUAL, SOURCE_DZ, SOURCE_OPEN_METEO, SOURCE_SOUNDING];

/**
 * Validating loader for the persisted wind profile (`flip.winds`).
 *
 * Returns null (nothing usable stored) rather than an empty default, so the
 * consumer can distinguish "no persisted winds" from a real profile. Dates
 * (validTime, per-row validTime, meta.fetchedAt) round-trip through JSON as
 * ISO strings and are revived here; unusable values degrade to undefined,
 * unusable rows are dropped, and garbage input never throws.
 */
export function migrateStoredWinds(raw: unknown): WindProfile | null {
  if (!isRecord(raw) || !Array.isArray(raw.winds)) {
    return null;
  }

  const winds: WindRow[] = [];

  raw.winds.forEach(entry => {
    if (!isRecord(entry)) {
      return;
    }

    const row: WindRow = {
      altFt: limitedNumber(entry.altFt, 0, LIMITS.windAltFt),
      direction: normalizeDirection(finiteNumber(entry.direction, 0)),
      speedKts: limitedNumber(entry.speedKts, 0, LIMITS.windSpeedKts)
    };

    if (typeof entry.tempC === 'number' && Number.isFinite(entry.tempC)) {
      row.tempC = entry.tempC;
    }
    if (typeof entry.source === 'string' && entry.source !== '') {
      row.source = entry.source;
    }
    const rowValidTime = dateOr(entry.validTime);

    if (rowValidTime) {
      row.validTime = rowValidTime;
    }

    winds.push(row);
  });

  if (winds.length === 0) {
    return null;
  }

  const profile: WindProfile = {
    winds,
    groundSource: oneOf(raw.groundSource, FORECAST_SOURCES, SOURCE_MANUAL),
    aloftSource: oneOf(raw.aloftSource, FORECAST_SOURCES, SOURCE_MANUAL)
  };

  if (isRecord(raw.center) &&
      typeof raw.center.lat === 'number' && Number.isFinite(raw.center.lat) &&
      typeof raw.center.lng === 'number' && Number.isFinite(raw.center.lng)) {
    profile.center = {
      lat: clampNumber(raw.center.lat, -90, 90),
      lng: clampNumber(raw.center.lng, -180, 180)
    };
  }

  const validTime = dateOr(raw.validTime);

  if (validTime) {
    profile.validTime = validTime;
  }

  if (isRecord(raw.meta)) {
    const m = raw.meta;
    const meta: WindProfileMeta = {};

    if (typeof m.model === 'string' && m.model !== '') {
      meta.model = m.model;
    }
    const fetchedAt = dateOr(m.fetchedAt);

    if (fetchedAt) {
      meta.fetchedAt = fetchedAt;
    }
    if (isRecord(m.location) &&
        typeof m.location.lat === 'number' && Number.isFinite(m.location.lat) &&
        typeof m.location.lng === 'number' && Number.isFinite(m.location.lng)) {
      meta.location = {
        lat: clampNumber(m.location.lat, -90, 90),
        lng: clampNumber(m.location.lng, -180, 180)
      };
    }
    if (typeof m.elevationFt === 'number' && Number.isFinite(m.elevationFt)) {
      meta.elevationFt = m.elevationFt;
    }
    if (typeof m.station === 'string' && m.station !== '') {
      meta.station = m.station;
    }
    if (typeof m.stationName === 'string' && m.stationName !== '') {
      meta.stationName = m.stationName;
    }
    if (typeof m.stationDistanceFt === 'number' && Number.isFinite(m.stationDistanceFt)) {
      meta.stationDistanceFt = m.stationDistanceFt;
    }

    profile.meta = meta;
  }

  return profile;
}

