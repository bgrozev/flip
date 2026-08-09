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
  LatLng,
  ManoeuvreConfig,
  ManoeuvreParams,
  TurnDirection,
  ManoeuvreType,
  MAP_PROVIDERS,
  PatternLeg,
  PatternParams,
  PatternType,
  PlaceTargets,
  Preset,
  Settings,
  StoredTrack,
  Target
} from '../types';
import {
  FLOCKING_MODES,
  FlockingParams,
  JumprunConfig,
  SolveCorridorParams
} from './flocking';
import { migrateToFlightPath } from './migration';
import {
  AltitudeUnit,
  DEFAULT_UNIT_PREFERENCES,
  DISTANCE_UNITS,
  displayToMiles,
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

// A left 90. The initiation altitude is deliberately high for a 90 — it
// makes the manoeuvre obvious on the map on a first run, rather than a
// detail the user has to go looking for.
export const DEFAULT_MANOEUVRE_PARAMS: ManoeuvreParams = {
  turnDirection: 'left',
  rotationDeg: 90,
  altitudeFt: 900,
  depthFt: 300,
  offsetFt: 150,
  duration: 8
};

// Carries its params: a 'parameters' config without them describes no turn
// at all, and now that this is the DEFAULT type (rather than the retired
// 'none') that would mean a fresh setup silently flies no manoeuvre.
export const DEFAULT_MANOEUVRE_CONFIG: ManoeuvreConfig = {
  type: 'parameters',
  params: DEFAULT_MANOEUVRE_PARAMS
};

// FWC's defaults: classic mode, 12k -> 4k ft, the "Flow" preset, into wind
export const DEFAULT_FLOCKING_PARAMS: FlockingParams = {
  mode: 'classic',
  windowTopFt: 12000,
  windowBottomFt: 4000,
  descentRateMph: 21,
  horizontalSpeedMph: 50,
  direction: 'into-wind',
  canopyDirection: 'follow-jumprun',
  referencePoint: null,
  jumprun: { directionDeg: 'into-wind', offsetMi: 0 },
  exitAlongMi: 0,
  // Rings default to 0.25 nm / 0.5 nm (stored, like every distance, in
  // statute miles)
  targetRadiusMi: displayToMiles(0.25, 'nm'),
  yellowRadiusMi: displayToMiles(0.5, 'nm'),
  // The ZHills-flavored default: run north or south
  solveCorridors: [
    {
      name: 'North', enabled: true, directionDeg: 0,
      offsetMinMi: -1, offsetMaxMi: 1, alongMinMi: -5, alongMaxMi: 3, canopyToleranceDeg: 15
    },
    {
      name: 'South', enabled: true, directionDeg: 180,
      offsetMinMi: -1, offsetMaxMi: 1, alongMinMi: -5, alongMaxMi: 3, canopyToleranceDeg: 15
    }
  ],
  showGrid: false
};

export const DEFAULT_SETTINGS: Settings = {
  showPoms: true,
  showPomAltitudes: true,
  showPomTooltips: true,
  showPreWind: true,
  displayWindSummary: true,
  displayMapWinds: true,
  showMapLabels: false,
  showManoeuvreHint: true,
  showFinalApproachLine: true,
  interpolateWind: true,
  correctPatternHeading: true,
  straightenLegs: true,
  useDzGroundWind: true,
  windAloftSource: 'forecast',
  windModel: DEFAULT_WIND_MODEL,
  mapProvider: 'google',
  showPresets: true,
  highlightCorrespondingPoints: true,
  showCrabArrow: true,
  // Off for everyone, including upgrades: the everyday UI is the default.
  nerd: false,
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

/**
 * Per-mode targets, keyed by mode id. Each mode plans against its own
 * landing/end point (a swoop target and a flocking target are rarely the
 * same place). Unknown/garbage entries are dropped; a mode with no entry
 * falls back to the shared legacy `flip.target` (see useAppState).
 */
export function migrateTargetsByMode(raw: unknown): Record<string, Target> {
  if (!isRecord(raw)) {
    return {};
  }

  const targets: Record<string, Target> = {};

  Object.entries(raw).forEach(([modeId, value]) => {
    if (modeId !== '' && isRecord(value)) {
      targets[modeId] = migrateTarget(value);
    }
  });

  return targets;
}

/** A coordinate pair clamped to the globe, or null if unusable. */
function latLngOrNull(raw: unknown): LatLng | null {
  if (
    isRecord(raw) &&
    typeof raw.lat === 'number' && Number.isFinite(raw.lat) &&
    typeof raw.lng === 'number' && Number.isFinite(raw.lng)
  ) {
    return {
      lat: clampNumber(raw.lat, -90, 90),
      lng: clampNumber(raw.lng, -180, 180)
    };
  }

  return null;
}

/**
 * Validating loader for the per-place target memory (`flip.targets.byPlace`).
 * Entries whose place no longer exists are harmless — they are only ever read
 * by place id, so a removed dropzone's entry simply never matches.
 */
export function migrateTargetsByPlace(raw: unknown): Record<string, PlaceTargets> {
  if (!isRecord(raw)) {
    return {};
  }

  const places: Record<string, PlaceTargets> = {};

  Object.entries(raw).forEach(([placeId, value]) => {
    if (placeId !== '' && isRecord(value)) {
      places[placeId] = {
        shared: migrateTarget(value.shared),
        byMode: migrateTargetsByMode(value.byMode),
        flockingReference: latLngOrNull(value.flockingReference),
        // Absent (rather than the default pair) means "this place has no
        // corridors of its own" — the current ones simply stay in force.
        ...(Array.isArray(value.flockingCorridors)
          ? { flockingCorridors: migrateSolveCorridors(value.flockingCorridors) }
          : {})
      };
    }
  });

  return places;
}

/**
 * Validating loader for the per-mode pattern params (`flip.pattern.byMode`).
 * A mode with no entry falls back to the shared legacy value, so dropping a
 * broken one is safe.
 */
export function migratePatternParamsByMode(raw: unknown): Record<string, PatternParams> {
  if (!isRecord(raw)) {
    return {};
  }

  const params: Record<string, PatternParams> = {};

  Object.entries(raw).forEach(([modeId, value]) => {
    if (modeId !== '' && isRecord(value)) {
      params[modeId] = migratePatternParams(value);
    }
  });

  return params;
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

const TURN_DIRECTIONS: readonly TurnDirection[] = ['left', 'right'];

/**
 * Validating loader for the turn parameters.
 *
 * The old offsetX/offsetY/left model is NOT migrated: its `left` flag named
 * the side the target was on rather than the way you turned, and its offsets
 * were measured against local axes rather than the final heading, so there
 * is no sound reading of a stored value. Anything unrecognized falls back to
 * the default turn, which is what an unset field does here anyway.
 */
export function migrateManoeuvreParams(raw: unknown): ManoeuvreParams {
  const r = isRecord(raw) ? raw : {};

  return {
    turnDirection: oneOf(r.turnDirection, TURN_DIRECTIONS, DEFAULT_MANOEUVRE_PARAMS.turnDirection),
    rotationDeg: limitedNumber(r.rotationDeg, DEFAULT_MANOEUVRE_PARAMS.rotationDeg, LIMITS.manoeuvreRotationDeg),
    altitudeFt: limitedNumber(r.altitudeFt, DEFAULT_MANOEUVRE_PARAMS.altitudeFt, LIMITS.manoeuvreAltitudeFt),
    depthFt: limitedNumber(r.depthFt, DEFAULT_MANOEUVRE_PARAMS.depthFt, LIMITS.manoeuvreDepthFt),
    offsetFt: limitedNumber(r.offsetFt, DEFAULT_MANOEUVRE_PARAMS.offsetFt, LIMITS.manoeuvreOffsetFt),
    duration: limitedNumber(r.duration, DEFAULT_MANOEUVRE_PARAMS.duration, LIMITS.manoeuvreDurationS)
  };
}

const MANOEUVRE_TYPES: readonly ManoeuvreType[] = ['parameters', 'track', 'samples'];

export function migrateManoeuvreConfig(raw: unknown): ManoeuvreConfig {
  const r = isRecord(raw) ? raw : {};
  const config: ManoeuvreConfig = {
    type: oneOf(r.type, MANOEUVRE_TYPES, DEFAULT_MANOEUVRE_CONFIG.type)
  };

  // Always present for a parameters config, defaulted field by field: the
  // path derivation has nothing to build from otherwise.
  if (config.type === 'parameters' || r.params !== undefined) {
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

  let canopyDirection: FlockingParams['canopyDirection'];

  if (typeof r.canopyDirection === 'number' && Number.isFinite(r.canopyDirection)) {
    canopyDirection = normalizeDirection(r.canopyDirection);
  } else {
    canopyDirection = 'follow-jumprun';
  }

  const referencePoint: FlockingParams['referencePoint'] = latLngOrNull(r.referencePoint);

  return {
    windowTopFt: limitedNumber(r.windowTopFt, d.windowTopFt, LIMITS.flockingAltitudeFt),
    windowBottomFt: limitedNumber(r.windowBottomFt, d.windowBottomFt, LIMITS.flockingAltitudeFt),
    descentRateMph: limitedNumber(r.descentRateMph, d.descentRateMph, LIMITS.flockingDescentRateMph),
    horizontalSpeedMph:
      limitedNumber(r.horizontalSpeedMph, d.horizontalSpeedMph, LIMITS.flockingHorizontalSpeedMph),
    mode: oneOf(r.mode, FLOCKING_MODES, d.mode),
    direction,
    canopyDirection,
    referencePoint,
    jumprun: migrateJumprunConfig(r.jumprun),
    exitAlongMi: limitedNumber(r.exitAlongMi, d.exitAlongMi, LIMITS.flockingExitAlongMi),
    targetRadiusMi: limitedNumber(r.targetRadiusMi, d.targetRadiusMi, LIMITS.flockingTargetRadiusMi),
    yellowRadiusMi: limitedNumber(r.yellowRadiusMi, d.yellowRadiusMi, LIMITS.flockingYellowRadiusMi),
    solveCorridors: migrateSolveCorridors(r.solveCorridors),
    showGrid: booleanOr(r.showGrid, d.showGrid)
  };
}

/**
 * Corridors: keep valid entries (clamped, ranges normalized so min <= max);
 * a missing/garbage list falls back to the default N-or-S pair. An
 * explicitly empty list is kept (the panel invites adding one).
 */
function migrateSolveCorridors(raw: unknown): SolveCorridorParams[] {
  if (!Array.isArray(raw)) {
    return DEFAULT_FLOCKING_PARAMS.solveCorridors.map(c => ({ ...c }));
  }

  const corridors: SolveCorridorParams[] = [];

  raw.forEach(entry => {
    if (!isRecord(entry)) {
      return;
    }

    const offA = limitedNumber(entry.offsetMinMi, -1, LIMITS.flockingJumprunOffsetMi);
    const offB = limitedNumber(entry.offsetMaxMi, 1, LIMITS.flockingJumprunOffsetMi);
    const alongA = limitedNumber(entry.alongMinMi, -5, LIMITS.flockingExitAlongMi);
    const alongB = limitedNumber(entry.alongMaxMi, 3, LIMITS.flockingExitAlongMi);

    corridors.push({
      name: stringOr(entry.name, ''),
      enabled: booleanOr(entry.enabled, true),
      directionDeg: normalizeDirection(finiteNumber(entry.directionDeg, 0)),
      offsetMinMi: Math.min(offA, offB),
      offsetMaxMi: Math.max(offA, offB),
      alongMinMi: Math.min(alongA, alongB),
      alongMaxMi: Math.max(alongA, alongB),
      canopyToleranceDeg:
        limitedNumber(entry.canopyToleranceDeg, 15, LIMITS.flockingCanopyToleranceDeg)
    });
  });

  return corridors;
}

/**
 * Accepts the current shape ({directionDeg, offsetMi}), the short-lived
 * auto/pinned shape ('auto' -> into-wind; 'pinned' keeps its line, the
 * manual exit choice is dropped — the exit is solver-picked now), and
 * garbage (-> into-wind, no offset).
 */
function migrateJumprunConfig(raw: unknown): JumprunConfig {
  const r = isRecord(raw) ? raw : {};

  if (r.mode === 'auto') {
    return { directionDeg: 'into-wind', offsetMi: 0 };
  }

  const directionDeg =
    r.directionDeg === 'into-wind' || typeof r.directionDeg !== 'number' ||
    !Number.isFinite(r.directionDeg)
      ? 'into-wind' as const
      : normalizeDirection(r.directionDeg);

  return {
    directionDeg,
    offsetMi: limitedNumber(r.offsetMi, 0, LIMITS.flockingJumprunOffsetMi)
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
    pressure: oneOf(r.pressure, PRESSURE_UNITS, DEFAULT_UNIT_PREFERENCES.pressure),
    distance: oneOf(r.distance, DISTANCE_UNITS, DEFAULT_UNIT_PREFERENCES.distance)
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
    displayWindSummary: booleanOr(r.displayWindSummary, d.displayWindSummary),
    displayMapWinds: booleanOr(r.displayMapWinds, d.displayMapWinds),
    showMapLabels: booleanOr(r.showMapLabels, d.showMapLabels),
    showManoeuvreHint: booleanOr(r.showManoeuvreHint, d.showManoeuvreHint),
    showFinalApproachLine: booleanOr(r.showFinalApproachLine, d.showFinalApproachLine),
    interpolateWind: booleanOr(r.interpolateWind, d.interpolateWind),
    correctPatternHeading: booleanOr(r.correctPatternHeading, d.correctPatternHeading),
    straightenLegs: booleanOr(r.straightenLegs, d.straightenLegs),
    useDzGroundWind: booleanOr(r.useDzGroundWind, d.useDzGroundWind),
    windAloftSource: oneOf(r.windAloftSource, ['forecast', 'sounding'] as const, d.windAloftSource),
    windModel: oneOf(r.windModel, OPEN_METEO_MODELS.map(m => m.id), d.windModel),
    mapProvider: oneOf(r.mapProvider, MAP_PROVIDERS, d.mapProvider),
    showPresets: booleanOr(r.showPresets, d.showPresets),
    highlightCorrespondingPoints: booleanOr(r.highlightCorrespondingPoints, d.highlightCorrespondingPoints),
    showCrabArrow: booleanOr(r.showCrabArrow, d.showCrabArrow),
    nerd: booleanOr(r.nerd, d.nerd),
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
      // Null for presets saved before presets named a place, and for a setup
      // built on a geocoder hit — both mean "no place", which is exactly what
      // loading one restores.
      placeId: typeof entry.placeId === 'string' && entry.placeId !== '' ? entry.placeId : null,
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

    // Left absent for courses stored before they were dropzone-scoped: an
    // unassigned course is offered everywhere, which is lossless. Guessing a
    // dropzone from its coordinates would be a write we could not undo.
    if (typeof entry.placeId === 'string' && entry.placeId !== '') {
      course.placeId = entry.placeId;
    }

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

/**
 * Starred dropzones, stored as names rather than copies so that corrections
 * to the dropzone database reach them. Names that are no longer in the
 * database are not filtered here — `core/places.buildPlaces` drops them when
 * it resolves the list, which keeps this migrator free of that dependency
 * (and keeps a favorite alive across a temporary rename).
 */
export function migrateFavoriteDropzones(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const names = raw.filter((entry): entry is string => typeof entry === 'string' && entry !== '');

  return [...new Set(names)];
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
    if (typeof entry.humidityPct === 'number' && Number.isFinite(entry.humidityPct)) {
      row.humidityPct = entry.humidityPct;
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
    if (isRecord(m.stationLocation) &&
        typeof m.stationLocation.lat === 'number' && Number.isFinite(m.stationLocation.lat) &&
        typeof m.stationLocation.lng === 'number' && Number.isFinite(m.stationLocation.lng)) {
      meta.stationLocation = {
        lat: clampNumber(m.stationLocation.lat, -90, 90),
        lng: clampNumber(m.stationLocation.lng, -180, 180)
      };
    }
    if (typeof m.groundTempC === 'number' && Number.isFinite(m.groundTempC)) {
      meta.groundTempC = m.groundTempC;
    }
    if (typeof m.groundHumidityPct === 'number' && Number.isFinite(m.groundHumidityPct)) {
      meta.groundHumidityPct = m.groundHumidityPct;
    }

    profile.meta = meta;
  }

  return profile;
}

