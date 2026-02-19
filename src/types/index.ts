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
  highlightCorrespondingPoints: boolean;
  units: UnitPreferences;
}

// Wind summary for display
export interface WindSummaryData {
  average: { speedKts?: number; direction?: number };
  ground?: { direction: number; speedKts: number; observed?: boolean };
}

// CSV parsing types (note: d3 csvParse returns strings, but JS coerces to number in arithmetic)
export interface CsvRow {
  lat: string;
  lon: string;
  time: string;
  pom?: string | boolean;
  hMSL: string | number;
}

// Dropzone type (fetchGroundWind returns WindRow which implements IWindRow)
export interface Dropzone {
  name: string;
  lat: number;
  lng: number;
  direction: number;
  fetchGroundWind?: () => Promise<IWindRow>;
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
}

export interface Preset {
  id: string;
  name: string;
  target: Target;
  patternParams: PatternParams;
  manoeuvre: ManoeuvreConfig;
  createdAt: number;
}
