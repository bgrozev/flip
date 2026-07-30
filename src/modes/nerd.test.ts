import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS } from '../core/model';
import { Settings } from '../types';

import { FEATURE_IDS, MODES, getMode, hasFeature } from './index';
import {
  NERD_FEATURES,
  NERD_OFF_OVERRIDES,
  NERD_SETTING_KEYS,
  applyNerdGate,
  withNerd
} from './nerd';

describe('nerd feature table integrity', () => {
  it('references only real feature ids', () => {
    for (const feature of NERD_FEATURES) {
      expect(FEATURE_IDS).toContain(feature);
    }
  });

  it('references only real Settings keys', () => {
    const settingKeys = Object.keys(DEFAULT_SETTINGS);

    for (const key of NERD_SETTING_KEYS) {
      expect(settingKeys).toContain(key);
    }
  });

  it('is not granted by any mode on its own', () => {
    // The whole gate leaks if a mode also lists a nerd feature: nerd off
    // would still expose it there.
    for (const mode of MODES) {
      for (const feature of NERD_FEATURES) {
        expect(mode.features).not.toContain(feature);
      }
    }
  });

  it('does not gate a setting the mode defaults also touch', () => {
    // Both would write the same key with different rules (nerd ignores
    // "touched", mode defaults respect it) — order would decide silently.
    for (const mode of MODES) {
      for (const key of Object.keys(mode.defaults)) {
        expect(NERD_SETTING_KEYS).not.toContain(key);
      }
    }
  });
});

describe('withNerd', () => {
  it('leaves the mode untouched when off', () => {
    for (const mode of MODES) {
      expect(withNerd(mode, false)).toBe(mode);
    }
  });

  it('grants every nerd feature in every mode when on', () => {
    for (const mode of MODES) {
      const nerdMode = withNerd(mode, true);

      for (const feature of NERD_FEATURES) {
        expect(hasFeature(mode, feature)).toBe(false);
        expect(hasFeature(nerdMode, feature)).toBe(true);
      }
    }
  });

  it('preserves identity, nav and map layers', () => {
    // Per-mode storage (targets, pattern params) keys off the id, and nerd
    // must not change what the mode itself decided to show.
    for (const mode of MODES) {
      const nerdMode = withNerd(mode, true);

      expect(nerdMode.id).toBe(mode.id);
      expect(nerdMode.mapLayers).toEqual(mode.mapLayers);
      expect(nerdMode.nav).toEqual(expect.arrayContaining([...mode.nav]));
    }
  });

  it('keeps the mode\'s own features', () => {
    const swoop = withNerd(getMode('swoop'), true);

    expect(hasFeature(swoop, 'manoeuvre')).toBe(true);
    expect(hasFeature(swoop, 'courses')).toBe(true);
    expect(hasFeature(swoop, 'patternLegCount')).toBe(true);
  });

  it('never duplicates a feature it already has', () => {
    const twice = withNerd(withNerd(getMode('pattern'), true), true);

    expect(new Set(twice.features).size).toBe(twice.features.length);
  });
});

describe('applyNerdGate', () => {
  const touchedOn: Settings = {
    ...DEFAULT_SETTINGS,
    showPomTooltips: true,
    highlightCorrespondingPoints: true
  };

  it('passes settings straight through when nerd is on', () => {
    expect(applyNerdGate(touchedOn, true)).toBe(touchedOn);
  });

  it('forces the everyday value for the tooltip settings when nerd is off', () => {
    const gated = applyNerdGate(touchedOn, false);

    expect(gated.showPomTooltips).toBe(false);
    expect(gated.highlightCorrespondingPoints).toBe(false);
  });

  it('overrides a value the user explicitly chose', () => {
    // Deliberately unlike mode defaults: with nerd off the control is not
    // even rendered, so an old "touched" choice must not survive it.
    const gated = applyNerdGate({ ...DEFAULT_SETTINGS, showPomTooltips: true }, false);

    expect(gated.showPomTooltips).toBe(false);
  });

  it('leaves every other setting alone', () => {
    const gated = applyNerdGate(DEFAULT_SETTINGS, false);

    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      if (!NERD_SETTING_KEYS.includes(key)) {
        expect(gated[key]).toEqual(DEFAULT_SETTINGS[key]);
      }
    }
  });

  it('does not mutate its input', () => {
    const before = { ...touchedOn };

    applyNerdGate(touchedOn, false);

    expect(touchedOn).toEqual(before);
  });

  it('never silently changes path math', () => {
    // These are gated, but hiding a control must not alter how the plan is
    // computed: their everyday value is the app default, so a user who
    // leaves nerd mode gets the same paths as one who never entered it.
    // They must therefore never appear in the overrides table.
    const gated = applyNerdGate({
      ...DEFAULT_SETTINGS,
      interpolateWind: false,
      straightenLegs: false,
      correctPatternHeading: false
    }, false);

    expect(gated.interpolateWind).toBe(DEFAULT_SETTINGS.interpolateWind);
    expect(gated.straightenLegs).toBe(DEFAULT_SETTINGS.straightenLegs);
    expect(gated.correctPatternHeading).toBe(DEFAULT_SETTINGS.correctPatternHeading);

    for (const key of ['interpolateWind', 'straightenLegs', 'correctPatternHeading']) {
      expect(NERD_OFF_OVERRIDES).not.toHaveProperty(key);
    }
  });

  it('reverts the gated settings to the defaults', () => {
    // "Otherwise the default settings apply."
    const gated = applyNerdGate({
      ...DEFAULT_SETTINGS,
      mapProvider: 'maplibre',
      useDzGroundWind: false,
      interpolateWind: false
    }, false);

    expect(gated.mapProvider).toBe(DEFAULT_SETTINGS.mapProvider);
    expect(gated.useDzGroundWind).toBe(DEFAULT_SETTINGS.useDzGroundWind);
    expect(gated.interpolateWind).toBe(DEFAULT_SETTINGS.interpolateWind);
  });

  it('leaves the wind source and model alone in every state', () => {
    // The comparison table lets ANY user pick the active source, so these
    // two must survive nerd being off — masking them would make that
    // click silently do nothing.
    const chosen: Settings = {
      ...DEFAULT_SETTINGS,
      windAloftSource: 'sounding',
      windModel: 'icon_seamless'
    };

    expect(applyNerdGate(chosen, false).windAloftSource).toBe('sounding');
    expect(applyNerdGate(chosen, false).windModel).toBe('icon_seamless');
    expect(NERD_SETTING_KEYS).not.toContain('windAloftSource');
    expect(NERD_SETTING_KEYS).not.toContain('windModel');
  });

  it('restores every gated value when nerd comes back', () => {
    const chosen: Settings = {
      ...DEFAULT_SETTINGS,
      windAloftSource: 'sounding',
      mapProvider: 'maplibre',
      showPomTooltips: false
    };

    // Nothing is written back, so the user's own values survive the trip.
    expect(applyNerdGate(chosen, true)).toEqual(chosen);
  });
});
