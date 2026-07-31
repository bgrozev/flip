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
  /**
   * How far back the initiation point sits from the landing point (ft),
   * along the final heading. Signed: negative rolls out past the target.
   */
  manoeuvreDepthFt: { min: -3000, max: 3000 },
  /**
   * How far to the side the initiation point sits (ft), measured on the side
   * the turn happens. Signed: a negative offset starts on the far side of
   * the final line, which the illustration absorbs by flying straight for
   * longer before it turns (see core/manoeuvre).
   */
  manoeuvreOffsetFt: { min: -3000, max: 3000 },
  /**
   * Degrees rotated onto final. Excludes 0 and 360, where the entry heading
   * equals the final heading and the turn has no radius to solve for.
   */
  manoeuvreRotationDeg: { min: 15, max: 540 },
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
  /** Solve-mode amber ring radius (mi) */
  flockingYellowRadiusMi: { min: 0.1, max: 10 },
  /** Solve-mode canopy deviation tolerance from the run (deg) */
  flockingCanopyToleranceDeg: { min: 0, max: 90 },
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
 * Normalize a *relative* angle to (-180, 180] — the form a person reads as
 * "how far off, and which way". A difference between two headings taken
 * plainly can land anywhere in (-360, 360): the Courses panel's approach
 * angle used to show -270° for what is really +90° to the right.
 */
export function normalizeRelativeAngle(deg: number): number {
  const wrapped = normalizeDirection(deg);

  return wrapped > 180 ? wrapped - 360 : wrapped;
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
