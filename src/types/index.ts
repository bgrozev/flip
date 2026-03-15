import { Feature, Point } from 'geojson';

import { UnitPreferences } from '../util/units';

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

// Settings types
export interface Settings {
  showPoms: boolean;
  showPomAltitudes: boolean;
  showPomTooltips: boolean;
  showPreWind: boolean;
  displayWindArrow: boolean;
  displayWindSummary: boolean;
  interpolateWind: boolean;
  correctPatternHeading: boolean;
  straightenLegs: boolean;
  useDzGroundWind: boolean;
  limitWind: number;
  showPresets: boolean;
  showMeasureTool: boolean;
  highlightCorrespondingPoints: boolean;
  units: UnitPreferences;
}

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
  direction: number;
  nearbyStations?: string[]; // ICAO station IDs not in NWS gridpoints (e.g. AWOS at small airports)
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
