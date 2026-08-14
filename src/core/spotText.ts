/**
 * The spot, in words — one formatter for every surface that says it.
 *
 * The spot IS flocking's output: it is what gets decided, read out and sent
 * to the pilot. It appears in the panel, in the top bar, on the map and on
 * the clipboard, and those must never disagree — two readouts rounding the
 * same distance differently is a bug report waiting to happen. So the
 * strings are built here, once, from the description and the unit, and each
 * surface only chooses how much of the result to draw.
 */
import { DISTANCE_UNIT_LABELS, DistanceUnit, milesToDisplay } from './units';

import { SpotDescription } from './flocking';
import { SolveTier } from './flockingSolve';

/**
 * Below this the offset is not worth saying: it is a rounding artefact of a
 * jumprun that is essentially over the reference, and "0.00 mi left" reads
 * as a real instruction. In display units, so the bar is the same wherever
 * the last digit shown is.
 */
const MIN_OFFSET_DISPLAY = 0.005;

/** Decimals for a distance. Two, matching the rest of the flocking panel. */
const DISTANCE_DECIMALS = 2;

export interface SpotText {
  /** "Jumprun 248˚" — the run direction, without the arrow glyph. */
  jumprun: string;
  /** "3.41 mi prior" / "3.41 mi PAST". */
  along: string;
  /** "0.42 mi left", or null when the exit is on the line. */
  offset: string | null;
  /**
   * How the flight ends up against the target: "On target (0.02 mi off)",
   * "CLOSE by 0.21 mi", "MISSES by 0.80 mi". Null in classic, which ends at
   * the target by construction and so has no verdict to give.
   */
  verdict: string | null;
  /**
   * The whole spot on one line: what goes to the clipboard and to the
   * pilot. Deliberately just the spot — jumprun, distance, offset — with
   * no dropzone, forecast time or corridor name: the reference point is
   * agreed offline, and the rest is FliP's business, not the aircraft's.
   */
  line: string;
}

/** "PAST" is shouted because it is the case that bites: you are late. */
const alongWord = (prior: boolean) => (prior ? 'prior' : 'PAST');

/** Whole degrees, never 360 (359.7 reads as 0). */
const roundDeg = (deg: number) => Math.round(deg) % 360;

export interface FormatSpotOptions {
  /** Distance from the flight's end to the target, miles; null in classic. */
  missMi?: number | null;
  /** Which ring that miss falls in — decides "CLOSE" vs "MISSES". */
  tier?: SolveTier | null;
}

export function formatSpot(
  spot: SpotDescription,
  unit: DistanceUnit,
  { missMi = null, tier = null }: FormatSpotOptions = {}
): SpotText {
  const unitLabel = DISTANCE_UNIT_LABELS[unit];
  const distance = (miles: number) =>
    `${milesToDisplay(miles, unit).toFixed(DISTANCE_DECIMALS)} ${unitLabel}`;

  const jumprun = `Jumprun ${roundDeg(spot.jumprunDeg)}˚`;
  const along = `${distance(spot.alongMi)} ${alongWord(spot.prior)}`;
  const offset = milesToDisplay(spot.offsetMi, unit) >= MIN_OFFSET_DISPLAY
    ? `${distance(spot.offsetMi)} ${spot.offsetLeft ? 'left' : 'right'}`
    : null;
  // The verdict belongs to the plan, not to the spot, so it is reported
  // next to it but never inside `line`: the pilot is being given a place to
  // fly to, and "MISSES by 0.8 mi" is a fact about the jumper's own setup.
  const verdict = missMi === null
    ? null
    : tier === 'green'
      ? `On target (${distance(missMi)} off)`
      : `${tier === 'yellow' ? 'CLOSE by' : 'MISSES by'} ${distance(missMi)}`;

  return {
    jumprun,
    along,
    offset,
    verdict,
    line: [jumprun, along, offset].filter(Boolean).join(' · ')
  };
}
