import { Feature, Point } from 'geojson';

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
  'about'
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
