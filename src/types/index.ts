import { Feature, Point } from 'geojson';

import { DaSeverity } from '../core/atmosphere';
import { SolveCorridorParams } from '../core/flocking';
import { UnitPreferences } from '../core/units';

// Flight point properties
export interface FlightPointProperties {
  alt: number;
  time: number;
  pom: number | boolean;
  phase?: 'manoeuvre' | 'pattern';
}

// Main types
export type FlightPoint = Feature<Point, FlightPointProperties>;
export type FlightPath = FlightPoint[];

// For Google Maps interop
export interface LatLng {
  lat: number;
  lng: number;
}

// Target (landing point + heading)
export interface Target {
  target: LatLng;
  finalHeading: number;
}

/**
 * The target state remembered for one place: the place's own target plus the
 * per-mode overrides made while there. A dropzone's stored coordinates are
 * only a starting point — the landing spot a user shift-clicks to is the one
 * they mean, so returning to a place restores it rather than snapping back.
 */
export interface PlaceTargets {
  shared: Target;
  byMode: Record<string, Target>;
  /**
   * Flocking's pinned Spot Reference ("C"). The only other absolute
   * coordinate in the app: everything else in the flocking params is a
   * heading or a distance, so this is the one that turns into a spot
   * thousands of miles out if it follows you to another dropzone.
   */
  flockingReference?: LatLng | null;
  /** The jumprun corridors in force here (flocking solve mode). */
  flockingCorridors?: SolveCorridorParams[];
}

/**
 * A dropzone's starting configuration for one mode. Anything omitted falls
 * back to the dropzone's own coordinates and heading, so an entry only has
 * to say what differs — a swoop pond away from the student LZ, a flocking
 * end point out in the big field.
 */
export interface DropzoneModeConfig {
  lat?: number;
  lng?: number;
  /**
   * Landing heading. Meaningless for `flocking`, which has no final-heading
   * UI (its target is where the canopy flight ends, not a landing direction).
   */
  direction?: number;
  /**
   * Allowed jumprun corridors (`flocking` only) — the DZ's own airspace and
   * traffic restrictions, which is what makes them dropzone data rather than
   * group data. Speeds, window altitudes and the ring radii deliberately
   * stay out: those describe the flock, not the place.
   */
  solveCorridors?: SolveCorridorParams[];
  /**
   * The DZ's canonical Spot Reference (`flocking` only): the landmark a spot
   * is quoted against when talking to the pilot, who knows the airport but
   * not where this particular flock means to land. Pinned on arrival; absent
   * means the spot stays relative to the target, as it is today.
   */
  spotReference?: LatLng;
}

// Wind types
export interface IWindRow {
  altFt: number;
  direction: number;
  speedKts: number;
}

// Pattern types
export type PatternType = 'none' | 'one-leg' | 'two-leg' | 'three-leg';

export interface PatternLeg {
  altitude: number;
  direction: number;
}

export interface PatternParams {
  type: PatternType;
  descentRateMph: number;
  glideRatio: number;
  legs: PatternLeg[];
}

// Manoeuvre types
export interface ManoeuvreParams {
  offsetXFt: number;
  offsetYFt: number;
  altitudeFt: number;
  duration: number;
  left: boolean;
}

// Map providers (see src/map). The active provider renders the map and
// supplies concrete implementations of the adapter primitives.
export const MAP_PROVIDERS = ['google', 'maplibre'] as const;
export type MapProvider = typeof MAP_PROVIDERS[number];

// Settings types
export interface Settings {
  showPoms: boolean;
  showPomAltitudes: boolean;
  showPomTooltips: boolean;
  showPreWind: boolean;
  displayWindSummary: boolean;
  /** Show the compact winds indicator overlaid on the map corner. */
  displayMapWinds: boolean;
  interpolateWind: boolean;
  correctPatternHeading: boolean;
  straightenLegs: boolean;
  useDzGroundWind: boolean;
  /** Which winds-aloft source to use: 'forecast' (OpenMeteo) or 'sounding'. */
  windAloftSource: 'forecast' | 'sounding';
  /** OpenMeteo forecast model id (see core/wind OPEN_METEO_MODELS). */
  windModel: string;
  /** Which map provider renders the map: Google Maps or MapLibre GL. */
  mapProvider: MapProvider;
  showPresets: boolean;
  highlightCorrespondingPoints: boolean;
  showCrabArrow: boolean;
  /**
   * Nerd mode: exposes the tools an everyday jumper never needs on the day
   * they fly (manual wind entry, exports, extra map detail). Orthogonal to
   * the mode — it answers "how much UI", not "what jump" — so it is a
   * single global flag rather than a fourth Mode. See modes/nerd.ts.
   */
  nerd: boolean;
  units: UnitPreferences;
}

// Navigation panels. Each panel is a route (`/${id}`); modes expose a subset.
export const PANEL_IDS = [
  'pattern',
  'manoeuvre',
  'target',
  'wind',
  'courses',
  'flocking',
  'settings',
  'help'
] as const;
export type PanelId = typeof PANEL_IDS[number];

// Map layers (src/map/layers). Modes select which ones render.
export const MAP_LAYER_IDS = [
  'flightPaths',
  'courses',
  'stations',
  'targetEdit',
  'courseEdit',
  'flocking'
] as const;
export type MapLayerId = typeof MAP_LAYER_IDS[number];

// Wind summary for display
export interface WindSummaryData {
  average: { speedKts?: number; direction?: number };
  ground?: { direction: number; speedKts: number; observed?: boolean };
  forecastTime?: Date;
  /** Density altitude (ft) at the target's elevation, when computable. */
  densityAltitudeFt?: number;
  /** How far above field elevation the density altitude sits. */
  densityAltitudeSeverity?: DaSeverity;
  /** Field elevation (ft), shown alongside density altitude. */
  elevationFt?: number;
}

// CSV parsing types (note: d3 csvParse returns strings, but JS coerces to number in arithmetic)
export interface CsvRow {
  lat: string;
  lon: string;
  time: string;
  pom?: string | boolean;
  hMSL: string | number;
}

// Dropzone type
export interface Dropzone {
  name: string;
  lat: number;
  lng: number;
  /**
   * Usual landing heading, where it is known. Absent for the bulk-imported
   * entries (see `util/dropzones.ts`) — selecting one of those moves the
   * target but leaves the final heading as the user set it.
   */
  direction?: number;
  nearbyStations?: string[]; // ICAO station IDs not in NWS gridpoints (e.g. AWOS at small airports)
  /** The dropzone's own site, linked from the place picker. */
  website?: string;
  /**
   * Where it is, in words. Searchable and shown under the name in the
   * picker, so "eloy" or "az" finds Skydive Arizona and the four Spacelands
   * tell themselves apart. `region` is a state/province; short forms like
   * "AZ" come from `core/regions`, not from repeating them here.
   */
  town?: string;
  region?: string;
  country?: string;
  /**
   * Per-mode starting configuration, keyed by mode id (`pattern` / `swoop` /
   * `flocking` — a plain string key because `types` cannot import `modes`
   * without a cycle; `dropzones.test.ts` checks the keys against the real
   * mode list). A mode with no entry starts from the dropzone's own
   * coordinates, so this only has to record what actually differs.
   */
  modes?: Record<string, DropzoneModeConfig>;
}

/** A landing location saved by the user ("My Locations"); keyed by name. */
export interface CustomLocation {
  name: string;
  lat: number;
  lng: number;
  direction: number;
}

/**
 * How a place in the picker got there. `favorite` is a starred known
 * dropzone (stored as a name reference, so corrections to the dropzone data
 * reach it); `custom` is a position the user saved themselves.
 */
export type PlaceKind = 'dropzone' | 'favorite' | 'custom';

/**
 * A geocoder hit. Not a `Place`: its coordinates are only fetched when the
 * user picks it (`resolvePlaceSuggestion`), so it can't be used as a target
 * until it is resolved. `id` is provider-specific and opaque.
 */
export interface PlaceSuggestion {
  id: string;
  label: string;
  detail?: string;
}

/**
 * A selectable landing place: the known dropzones plus everything the user
 * saved, flattened into one list for the picker. Geocoder results are NOT
 * places — they have no coordinates until they are resolved.
 */
export interface Place {
  /** Stable across renders and unique within a list: `dz:<name>` / `custom:<name>`. */
  id: string;
  kind: PlaceKind;
  name: string;
  lat: number;
  lng: number;
  /** Usual landing heading, where known (see `Dropzone.direction`). */
  direction?: number;
  /** Per-mode starting config, for places that come from the DZ database. */
  modes?: Record<string, DropzoneModeConfig>;
  /** The dropzone's own site, where one is known. */
  website?: string;
  /** Where it is, in words (see `Dropzone`). */
  town?: string;
  region?: string;
  country?: string;
}

/** A manoeuvre track saved by the user ("My tracks"); keyed by name. */
export interface StoredTrack {
  name: string;
  description: string;
  track: FlightPath;
}

// Course types
export type CourseType = 'distance' | 'zone-accuracy' | 'speed';

export interface CourseParams {
  id: string;
  name: string;
  type: CourseType;
  lat: number;
  lng: number;
  direction: number;
  /** Speed courses only */
  carveDirection?: 'left' | 'right';
}

export interface CourseBuoy {
  type: 'buoy';
  lat: number;
  lng: number;
  color: string;
  label?: string;
}

export interface CourseLine {
  type: 'line';
  from: LatLng;
  to: LatLng;
  color: string;
  label?: string;
}

export interface CourseMarker {
  type: 'marker';
  lat: number;
  lng: number;
  color: string;
  label?: string;
}

export type CourseElement = CourseBuoy | CourseLine | CourseMarker;

export interface Course {
  id: string;
  name: string;
  elements: CourseElement[];
  center?: LatLng;
  direction?: number;
}

// Observed wind station (from NWS, CSC, Spaceland, etc.)
export interface ObservedWindStation {
  id: string;
  name: string;
  source: string;        // e.g. 'NWS', 'CSC', 'Spaceland'
  stationUrl?: string;   // link to external station page
  lat: number;
  lng: number;
  distanceFt: number;
  observedAt: Date;
  wind: {
    direction: number;
    speedKts: number;
    gustKts?: number;
  };
  // Display-only extras (not used in drift calculations)
  temperatureC?: number;
  dewpointC?: number;
  humidityPct?: number;
  pressureHpa?: number;       // station pressure
  seaLevelPressureHpa?: number;
  visibilityM?: number;
  windChillC?: number;
  heatIndexC?: number;
  cloudLayers?: Array<{ amount: string; baseM: number | null }>;
  textDescription?: string;
}

// Preset types
export type ManoeuvreType = 'none' | 'parameters' | 'track' | 'samples';

export interface ManoeuvreConfig {
  type: ManoeuvreType;
  // For 'parameters' mode
  params?: ManoeuvreParams;
  // For 'track' mode - save track name AND data for self-containment
  trackName?: string;
  trackData?: FlightPath;
  // For 'samples' mode
  sampleIndex?: number;
  sampleLeft?: boolean;
  // Offset in feet applied to the initiation altitude (track/samples only)
  initiationAltitudeOffset?: number;
}

export interface Preset {
  id: string;
  name: string;
  target: Target;
  patternParams: PatternParams;
  manoeuvre: ManoeuvreConfig;
  selectedCourseId?: string | null;
  createdAt: number;
}
