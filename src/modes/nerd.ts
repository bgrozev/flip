/**
 * Nerd mode: a single global flag, orthogonal to the mode.
 *
 * A mode answers "what jump am I planning" (pattern / swoop / flocking).
 * Nerd answers "how much UI do I want" — and the two cross: manual wind
 * entry matters in flocking as much as under canopy. So this is a flag,
 * not a fourth Mode, and it is applied as a *transform over the active
 * mode*: everything that already gates on a Mode (nav, map layers,
 * `hasFeature`, the keymap) then gates on nerd for free, with no
 * `settings.nerd &&` scattered through the components.
 *
 * The rule for what belongs here: gate only what a jumper never needs on
 * the day they fly. Anything failing that test is a Settings-organisation
 * problem, not a Nerd one.
 */
import { DEFAULT_SETTINGS } from '../core/model';
import { PanelId, Settings } from '../types';

import { FeatureId, Mode } from './index';

/** Features that exist only under nerd mode. */
export const NERD_FEATURES: readonly FeatureId[] =
  ['export', 'manualWind', 'pointTooltips'];

/** Panels that exist only under nerd mode (none yet — the Export panel is next). */
export const NERD_PANELS: readonly PanelId[] = [];

/**
 * Settings whose control only appears in the Settings panel under nerd
 * mode. With nerd off each one reverts to its everyday value — the app
 * default, unless listed in NERD_OFF_OVERRIDES below.
 *
 * Most of these describe *how the plan is computed or sourced* rather
 * than clutter (wind source, model, interpolation, leg straightening),
 * which is why the everyday value is the default rather than `false`:
 * hiding a switch must never silently change the path math.
 */
export const NERD_SETTING_KEYS: readonly (keyof Settings)[] = [
  'showPomTooltips',
  'highlightCorrespondingPoints',
  'correctPatternHeading',
  'straightenLegs',
  'interpolateWind',
  'useDzGroundWind',
  'windAloftSource',
  'windModel',
  'mapProvider'
];

/**
 * The exceptions: nerd-gated settings whose everyday value is *not* the
 * app default. Both of these default to `true` but belong to the
 * hover-tooltip machinery, which everyday users do not get at all (the
 * `pointTooltips` feature is the real gate — this only makes sure the
 * map cannot render them either way).
 */
export const NERD_OFF_OVERRIDES: Readonly<Partial<Settings>> = {
  showPomTooltips: false,
  highlightCorrespondingPoints: false
};

/**
 * The active mode as nerd mode leaves it. Identity (`id`) is preserved —
 * per-mode storage keys off it — so this only ever widens exposure.
 */
export function withNerd(mode: Mode, nerd: boolean): Mode {
  if (!nerd) {
    return mode;
  }

  return {
    ...mode,
    nav: [...mode.nav, ...NERD_PANELS.filter(p => !mode.nav.includes(p))],
    features: [...mode.features, ...NERD_FEATURES.filter(f => !mode.features.includes(f))]
  };
}

/**
 * Forces the nerd-only settings to their everyday values while nerd is off.
 *
 * Unlike mode defaults this ignores `flip.settings.touched` on purpose: a
 * "touched" value means the user chose it, but with nerd off they cannot
 * see the control at all, so an old choice must not quietly keep the
 * advanced behaviour alive. Turning nerd back on restores their value —
 * nothing is written back, only masked on read.
 */
export function applyNerdGate(settings: Settings, nerd: boolean): Settings {
  if (nerd) {
    return settings;
  }

  const gated = { ...settings } as Record<keyof Settings, unknown>;

  for (const key of NERD_SETTING_KEYS) {
    gated[key] = key in NERD_OFF_OVERRIDES ? NERD_OFF_OVERRIDES[key] : DEFAULT_SETTINGS[key];
  }

  return gated as Settings;
}
