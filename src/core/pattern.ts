import * as turf from '@turf/turf';
import { FlightPath, FlightPoint, PatternParams, PatternType } from '../types';
import { mphToFps } from './units';

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
 * The params as a mode without the leg-count control sees them: the full
 * downwind-base-final pattern, whatever type is stored.
 *
 * Applied on read only — never written back — so that a swooper's stored
 * NONE/one-leg/two-leg choice survives a trip through Standard Pattern.
 */
export function withFullPattern<T extends { type: PatternType }>(params: T): T {
  return params.type === PATTERN_THREE_LEG ? params : { ...params, type: PATTERN_THREE_LEG };
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

/**
 * Set every turn (base, downwind) to the same side. Leg 0 (the final leg)
 * has no turn of its own — its `direction` is unused — so it is left
 * untouched.
 */
export function setPatternSide(params: PatternParams, left: boolean): PatternParams {
  const direction = booleanToDirection(left);

  return {
    ...params,
    legs: params.legs.map((leg, i) => (i === 0 ? leg : { ...leg, direction }))
  };
}

/**
 * Switch a pattern between left-hand and right-hand. A pattern with mixed
 * turns (a "Z" — one left, one right) is not a toggle between two states,
 * so there is no well-defined "opposite" to flip to; it resolves to
 * left-hand, same as every other non-all-left starting point. Only a
 * pattern that is already uniformly left or right toggles to its true
 * opposite.
 */
export function flipPatternSides(params: PatternParams): PatternParams {
  const allLeft = isLeftTurn(params.legs[1].direction) && isLeftTurn(params.legs[2].direction);

  return setPatternSide(params, !allLeft);
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
