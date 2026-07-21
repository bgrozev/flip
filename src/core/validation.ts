export interface NumericLimits {
  min: number;
  max: number;
}

/**
 * Sensible limits for all numeric inputs, in the app's internal units
 * (feet, knots, mph, degrees, seconds). Values outside these ranges are
 * clamped before they reach the path math — absurd inputs (e.g. a
 * 1,000,000 ft pattern leg) effectively break the app.
 */
export const LIMITS = {
  /** Pattern leg altitude (ft) */
  patternLegAltitudeFt: { min: 100, max: 3000 },
  /** Pattern descent rate (mph) */
  descentRateMph: { min: 1, max: 60 },
  /** Pattern glide ratio */
  glideRatio: { min: 0.1, max: 10 },
  /** Manoeuvre depth offset (ft); negative offsets to the opposite side */
  manoeuvreOffsetXFt: { min: -3000, max: 3000 },
  /** Manoeuvre lateral offset (ft) */
  manoeuvreOffsetYFt: { min: 10, max: 3000 },
  /** Manoeuvre initiation altitude (ft) */
  manoeuvreAltitudeFt: { min: 100, max: 5000 },
  /** Manoeuvre duration (s) */
  manoeuvreDurationS: { min: 1, max: 60 },
  /** Flocking altitude window bounds (ft) */
  flockingAltitudeFt: { min: 0, max: 30000 },
  /** Flocking descent rate (mph); XRW reaches 40 */
  flockingDescentRateMph: { min: 1, max: 100 },
  /** Flocking horizontal speed (mph); XRW reaches 70 */
  flockingHorizontalSpeedMph: { min: 0, max: 150 },
  /** Flocking end-of-jump target area radius (mi) */
  flockingTargetRadiusMi: { min: 0.05, max: 2 },
  /** Pinned jumprun lateral offset from the Spot Reference (mi, +right) */
  flockingJumprunOffsetMi: { min: -10, max: 10 },
  /** Exit position along the jumprun line (signed mi, free mode) */
  flockingExitAlongMi: { min: -20, max: 20 },
  /** Wind row altitude (ft) */
  windAltFt: { min: 0, max: 60000 },
  /** Wind speed (kts) */
  windSpeedKts: { min: 0, max: 200 },
  /** Any compass direction (degrees) */
  directionDeg: { min: 0, max: 360 }
} as const satisfies Record<string, NumericLimits>;

/**
 * Clamp a number into optional min/max bounds. Non-finite input falls back
 * to min (or max, or 0) so garbage can never propagate into path math.
 */
export function clampNumber(num: number, min?: number, max?: number): number {
  if (!Number.isFinite(num)) {
    return min ?? max ?? 0;
  }
  if (typeof min === 'number' && num < min) {
    return min;
  }
  if (typeof max === 'number' && num > max) {
    return max;
  }

  return num;
}

/**
 * Normalize a direction to the [0, 360) range. Handles values below -360
 * (unlike the `(x + 360) % 360` idiom); non-finite input becomes 0.
 */
export function normalizeDirection(deg: number): number {
  if (!Number.isFinite(deg)) {
    return 0;
  }

  return ((deg % 360) + 360) % 360;
}

/**
 * Check if a number is within optional min/max bounds.
 */
export function isNumberInRange(num: number, min?: number, max?: number): boolean {
  const aboveMin = typeof min === 'undefined' || num >= min;
  const belowMax = typeof max === 'undefined' || num <= max;

  return aboveMin && belowMax;
}

/**
 * Generate a validation error message based on min/max constraints.
 */
export function getRangeErrorText(min?: number, max?: number): string {
  if (typeof min === 'number' && typeof max === 'number') {
    return `It must be between ${min} and ${max}.`;
  } else if (typeof min === 'number') {
    return `It must be at least ${min}.`;
  } else if (typeof max === 'number') {
    return `It must be at most ${max}.`;
  }

  return 'Invalid value.';
}
