/**
 * The assumption-of-risk notice.
 *
 * Content is DATA, in one file, for the same reason `core/help` is: it is
 * shown in two places — the blocking first-run overlay and the Help topic —
 * and two copies of a legal notice that can drift apart is worse than none.
 * Pure: no React, no DOM.
 *
 * `RISK_TEXT_VERSION` is what makes an acceptance re-askable. An acceptance
 * records the version of the text it was given, so a MATERIAL rewrite can
 * bump this number and ask again; a typo fix should not. Nothing else in the
 * app reads it — see `hooks/useRiskAcceptance`.
 */

/** Bump only when the text changes materially enough to re-ask everyone. */
export const RISK_TEXT_VERSION = 1;

export const RISK_TITLE = 'Assumption of risk';

/** One line, for the Help topic list. */
export const RISK_SUMMARY = 'What FliP is not, and whose responsibility the jump is.';

export const RISK_INTRO =
  'FliP is a planning aid. It is not a safety device, not an aviation instrument, ' +
  'and not a substitute for training, a current weather briefing, your dropzone’s ' +
  'procedures, or your own judgement.';

export const RISK_POINTS: readonly string[] = [
  'Skydiving and canopy piloting are inherently dangerous. They can and do cause serious injury and death.',
  'Every decision on a jump is yours alone — the exit, the spot, the pattern, the turn and the landing — and so is the responsibility for it.',
  'The winds FliP shows are a forecast, or an observation from a third party. They can be wrong, out of date or missing, and the real conditions can differ from any model.',
  'Do not use FliP as the basis for any exit, spotting, canopy-flight or landing decision. Check it against what you can see and feel on the day, against your instructors, and against your dropzone’s rules.',
  'FliP is provided as-is, with no warranty of any kind. Its author accepts no liability for any loss, injury or death arising from its use.'
];

/** The sentence the checkbox agrees to. Kept short enough to actually read. */
export const RISK_AGREEMENT =
  'I have read and understood the above. I accept that skydiving is dangerous, ' +
  'that every decision on a jump is mine alone, and that I use FliP entirely at my own risk.';

/** The overlay's proceed button. */
export const RISK_ACCEPT_LABEL = 'I agree — continue';
