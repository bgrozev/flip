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
import { PanelId, Settings } from '../types';

import { FeatureId, Mode } from './index';

/** Features that exist only under nerd mode. */
export const NERD_FEATURES: readonly FeatureId[] = ['export', 'manualWind'];

/** Panels that exist only under nerd mode (none yet — the Export panel is next). */
export const NERD_PANELS: readonly PanelId[] = [];

/**
 * Settings whose *control* is hidden when nerd is off, together with the
 * value that applies while it is.
 *
 * Deliberately an explicit table rather than "force false" or "fall back
 * to DEFAULT_SETTINGS": several settings that could be gated here (e.g.
 * `interpolateWind`) default to `true` and should stay true for everyday
 * users — hiding a control must not silently change the path math. Each
 * entry states the everyday value outright.
 */
export const NERD_OFF_SETTINGS: Readonly<Partial<Settings>> = {
  showPomTooltips: false,
  highlightCorrespondingPoints: false
};

/** Settings keys that only appear in the Settings panel under nerd mode. */
export const NERD_SETTING_KEYS: readonly (keyof Settings)[] =
  Object.keys(NERD_OFF_SETTINGS) as (keyof Settings)[];

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

  return { ...settings, ...NERD_OFF_SETTINGS };
}
