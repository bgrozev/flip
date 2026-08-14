import { FlightPath } from '../types';
import { LegacyFlipPoint } from '../core/migration';

export interface Sample {
  name: string;
  description: string;
  path: LegacyFlipPoint[];
}

export interface SampleWithPath {
  name: string;
  description: string;
  path: FlightPath;
}
