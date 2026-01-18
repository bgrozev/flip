import { Feature, Point } from 'geojson';

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
  showPreWind: boolean;
  displayWindArrow: boolean;
  displayWindSummary: boolean;
  interpolateWind: boolean;
  correctPatternHeading: boolean;
  useDzGroundWind: boolean;
  limitWind: number;
}

// Dropzone type (fetchGroundWind returns WindRow which implements IWindRow)
export interface Dropzone {
  name: string;
  lat: number;
  lng: number;
  direction: number;
  fetchGroundWind?: () => Promise<IWindRow>;
}
