import { FlightPath } from '../types';
import { legacyToFlightPath, LegacyFlipPoint } from '../util/migration';

import sample90Data from './sample90';
import sample270Data from './sample270';
import sample450Data from './sample450';
import sample630Data from './sample630';
import sample810Data from './sample810';

export interface Sample {
  name: string;
  description: string;
  getPath: () => FlightPath;
}

// Raw sample data from JS files has string for phase, cast to LegacyFlipPoint
interface RawSampleData {
  name: string;
  description: string;
  path: Array<{
    lat: number;
    lng: number;
    alt: number;
    time: number;
    pom: number | boolean;
    phase?: string;
  }>;
}

function createSample(data: RawSampleData): Sample {
  return {
    name: data.name,
    description: data.description,
    getPath: () => legacyToFlightPath(data.path as LegacyFlipPoint[])
  };
}

export const sample90: Sample = createSample(sample90Data);
export const sample270: Sample = createSample(sample270Data);
export const sample450: Sample = createSample(sample450Data);
export const sample630: Sample = createSample(sample630Data);
export const sample810: Sample = createSample(sample810Data);

export const samples: Sample[] = [sample90, sample270, sample450, sample630, sample810];

export default samples;
