/**
 * Wind profile comparison: sample several profiles (forecast models,
 * soundings) at a common ladder of altitudes and quantify where they
 * disagree. Pure math — the UI decides how to present it.
 *
 * Sampling ("matched/interpolated altitudes"): each profile is evaluated
 * with the same vector interpolation the app uses to fly the pattern
 * (`getWindAt(…, interpolate=true)`), after `prepWind` ordering. Below a
 * profile's lowest row the lowest row applies (exactly how wind application
 * treats the ground band); above its highest row the profile has no opinion
 * and the cell is null rather than an extrapolation — sources with sparse
 * levels (e.g. ECMWF's 5 pressure levels) therefore compare on equal,
 * physically-honest terms.
 */
import { WindProfile, getWindAt, prepWind } from './wind';

/** Direction spread beyond this flags a band as disagreeing (degrees). */
export const DIRECTION_DISAGREEMENT_DEG = 15;

/** Speed spread beyond this flags a band as disagreeing (knots). */
export const SPEED_DISAGREEMENT_KTS = 5;

/**
 * Directions of winds slower than this are treated as noise: they carry no
 * planning value, so they neither create nor suppress direction
 * disagreement.
 */
export const DIRECTION_MIN_SPEED_KTS = 3;

/** Ladder step for the comparison altitudes (feet). */
export const COMPARISON_STEP_FT = 500;

/** How high the source-comparison table goes (feet). Covers the flocking
 *  window without producing an unwieldy row count at 500 ft steps. */
export const COMPARISON_CEILING_FT = 18000;

/**
 * The comparison ladder: 0..limit in 500 ft steps.
 */
export function comparisonAltitudes(limitFt: number): number[] {
  const steps = Math.max(1, Math.floor(limitFt / COMPARISON_STEP_FT));

  return Array.from({ length: steps + 1 }, (_, i) => i * COMPARISON_STEP_FT);
}

/** One profile's wind at a comparison altitude. */
export interface ComparisonCell {
  direction: number;
  speedKts: number;
}

/** All profiles' winds at one altitude, plus the disagreement verdict. */
export interface ComparisonBand {
  altFt: number;
  /** One entry per input profile; null where the profile has no coverage. */
  cells: (ComparisonCell | null)[];
  /** Largest pairwise direction difference among non-noise cells (0–180). */
  directionSpreadDeg: number;
  /** Max minus min speed among present cells. */
  speedSpreadKts: number;
  directionDisagree: boolean;
  speedDisagree: boolean;
  /** Either kind of disagreement. */
  disagree: boolean;
}

/** Absolute angular difference folded into 0–180°. */
function angularDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Sample one profile at an altitude, or null when the profile is empty or
 * the altitude is above its highest row (no extrapolation upward).
 */
export function sampleProfileAt(profile: WindProfile, altFt: number): ComparisonCell | null {
  const rows = profile.winds;

  if (rows.length === 0 || altFt > rows[rows.length - 1].altFt) {
    return null;
  }

  const wind = getWindAt(profile, altFt, true);

  return { direction: wind.direction, speedKts: wind.speedKts };
}

/**
 * Compare profiles across the altitude ladder. Cell order follows the
 * input profile order. A band disagrees when present cells spread more
 * than DIRECTION_DISAGREEMENT_DEG (among cells at or above
 * DIRECTION_MIN_SPEED_KTS) or more than SPEED_DISAGREEMENT_KTS.
 */
export function compareProfiles(
  profiles: WindProfile[],
  altitudesFt: readonly number[]
): ComparisonBand[] {
  const prepped = profiles.map(prepWind);

  return altitudesFt.map(altFt => {
    const cells = prepped.map(p => sampleProfileAt(p, altFt));
    const present = cells.filter((c): c is ComparisonCell => c !== null);

    const speeds = present.map(c => c.speedKts);
    const speedSpreadKts = speeds.length >= 2
      ? Math.max(...speeds) - Math.min(...speeds)
      : 0;

    const meaningfulDirections = present
      .filter(c => c.speedKts >= DIRECTION_MIN_SPEED_KTS)
      .map(c => c.direction);
    let directionSpreadDeg = 0;

    for (let i = 0; i < meaningfulDirections.length; i++) {
      for (let j = i + 1; j < meaningfulDirections.length; j++) {
        directionSpreadDeg = Math.max(
          directionSpreadDeg,
          angularDiff(meaningfulDirections[i], meaningfulDirections[j])
        );
      }
    }

    const directionDisagree = directionSpreadDeg > DIRECTION_DISAGREEMENT_DEG;
    const speedDisagree = speedSpreadKts > SPEED_DISAGREEMENT_KTS;

    return {
      altFt,
      cells,
      directionSpreadDeg,
      speedSpreadKts,
      directionDisagree,
      speedDisagree,
      disagree: directionDisagree || speedDisagree
    };
  });
}
