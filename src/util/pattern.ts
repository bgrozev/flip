import * as turf from '@turf/turf';
import { FlightPath, FlightPoint, PatternType } from '../types';
import { mphToFps } from './geo';

// Pattern type constants
export const PATTERN_NONE: PatternType = 'none';
export const PATTERN_ONE_LEG: PatternType = 'one-leg';
export const PATTERN_TWO_LEG: PatternType = 'two-leg';
export const PATTERN_THREE_LEG: PatternType = 'three-leg';

// Map pattern type to leg count
const PATTERN_LEG_COUNT: Record<PatternType, number> = {
  [PATTERN_NONE]: 0,
  [PATTERN_ONE_LEG]: 1,
  [PATTERN_TWO_LEG]: 2,
  [PATTERN_THREE_LEG]: 3
};

export interface PatternLeg {
  altitude: number;
  direction: number;
}

export interface MakePatternParams {
  descentRateMph?: number;
  glideRatio?: number;
  legs: PatternLeg[];
}

export interface MakePatternByTypeParams extends MakePatternParams {
  type: PatternType;
}

/**
 * Get the number of legs for a pattern type.
 */
export function getPatternLegCount(patternType: PatternType): number {
  return PATTERN_LEG_COUNT[patternType] ?? 0;
}

/**
 * Create a pattern by type, automatically slicing legs array to the appropriate count.
 */
export function makePatternByType(params: MakePatternByTypeParams): FlightPath {
  const count = getPatternLegCount(params.type);

  return makePattern({
    ...params,
    legs: params.legs.slice(0, count)
  });
}

/**
 * Check if a leg direction represents a left turn (not default 270).
 */
export function isLeftTurn(direction: number): boolean {
  return direction !== 270;
}

/**
 * Convert a boolean to leg direction (90 for left/true, 270 for right/false).
 */
export function booleanToDirection(isLeft: boolean): number {
  return isLeft ? 90 : 270;
}

export function makePattern({
  descentRateMph = 12,
  glideRatio = 2.6,
  legs = []
}: MakePatternParams): FlightPath {
  const points: FlightPath = [];

  if (legs.length === 0 || !descentRateMph || !(typeof descentRateMph === 'number')) {
    return points;
  }

  const p0 = turf.point([0, 0], {
    alt: 0,
    time: 0,
    pom: 0
  }) as FlightPoint;

  points.push(p0);

  let heading = 0;

  for (let i = 0; i < legs.length; i++) {
    addLeg(points, descentRateMph, glideRatio, legs[i], heading);
    points[points.length - 1].properties.pom = 1;
    if (i < legs.length - 1) {
      heading = heading - legs[i + 1].direction;
    }
  }

  return points;
}

function addLeg(
  points: FlightPath,
  descentRateMph: number,
  glideRatio: number,
  leg: PatternLeg,
  heading: number
): void {
  const stepTms = 1000;
  const stepVft = descentRateMph * mphToFps * (stepTms / 1000);
  const stepHft = stepVft * glideRatio;

  let addedVft = 0;

  while (addedVft + stepVft <= leg.altitude) {
    const p = turf.clone(points[points.length - 1]) as FlightPoint;

    p.properties.pom = 0;
    p.properties.alt += stepVft;
    p.properties.time -= stepTms;
    addedVft += stepVft;

    points.push(
      turf.transformTranslate(p, stepHft, heading, { units: 'feet' }) as FlightPoint
    );
  }
  if (addedVft < leg.altitude) {
    const remVft = leg.altitude - addedVft;
    const remHft = remVft * glideRatio;
    const remTms = Math.round(1000 * (remVft / (descentRateMph * mphToFps)));
    const p = turf.clone(points[points.length - 1]) as FlightPoint;

    p.properties.alt += remVft;
    p.properties.time -= remTms;

    points.push(
      turf.transformTranslate(p, remHft, heading, { units: 'feet' }) as FlightPoint
    );
  }
}
