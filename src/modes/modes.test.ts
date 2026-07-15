import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS } from '../core/model';
import { MAP_LAYER_IDS, PANEL_IDS, Settings } from '../types';

import {
  ENABLED_MODES,
  FALLBACK_MODE_ID,
  FEATURE_IDS,
  MODES,
  applyModeDefaults,
  getMode,
  hasFeature,
  hasLayer,
  migrateModeId
} from './index';

describe('mode definitions integrity', () => {
  it('has unique ids', () => {
    const ids = MODES.map(m => m.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('references only real panel ids in nav', () => {
    for (const mode of MODES) {
      for (const panel of mode.nav) {
        expect(PANEL_IDS).toContain(panel);
      }
    }
  });

  it('references only real map layer ids', () => {
    for (const mode of MODES) {
      for (const layer of mode.mapLayers) {
        expect(MAP_LAYER_IDS).toContain(layer);
      }
    }
  });

  it('references only real feature ids', () => {
    for (const mode of MODES) {
      for (const feature of mode.features) {
        expect(FEATURE_IDS).toContain(feature);
      }
    }
  });

  it('only uses real Settings keys in defaults', () => {
    const settingKeys = Object.keys(DEFAULT_SETTINGS);

    for (const mode of MODES) {
      for (const key of Object.keys(mode.defaults)) {
        expect(settingKeys).toContain(key);
      }
    }
  });

  it('ships pattern and swoop enabled; flocking and explore as stubs', () => {
    expect(ENABLED_MODES.map(m => m.id)).toEqual(['pattern', 'swoop']);
    expect(getMode('flocking').enabled).toBe(false);
    expect(getMode('explore').enabled).toBe(false);
  });

  it('pattern mode hides manoeuvre and courses; swoop has everything', () => {
    const pattern = getMode('pattern');

    expect(pattern.nav).not.toContain('manoeuvre');
    expect(pattern.nav).not.toContain('courses');
    expect(hasLayer(pattern, 'courses')).toBe(false);
    expect(hasLayer(pattern, 'courseEdit')).toBe(false);
    expect(hasFeature(pattern, 'manoeuvre')).toBe(false);
    expect(hasFeature(pattern, 'courses')).toBe(false);

    const swoop = getMode('swoop');

    expect([...swoop.nav].sort()).toEqual([...PANEL_IDS].sort());
    expect([...swoop.mapLayers].sort()).toEqual([...MAP_LAYER_IDS].sort());
    expect(hasFeature(swoop, 'manoeuvre')).toBe(true);
    expect(hasFeature(swoop, 'courses')).toBe(true);
  });

  it('every mode keeps settings reachable (nav contains settings)', () => {
    for (const mode of MODES) {
      expect(mode.nav).toContain('settings');
    }
  });

  it('falls back to a full-UI mode', () => {
    expect(FALLBACK_MODE_ID).toBe('swoop');
    expect(getMode(FALLBACK_MODE_ID).enabled).toBe(true);
  });
});

describe('migrateModeId (mode persistence codec)', () => {
  it('accepts enabled mode ids', () => {
    expect(migrateModeId('pattern')).toBe('pattern');
    expect(migrateModeId('swoop')).toBe('swoop');
  });

  it('rejects disabled (stub) mode ids', () => {
    expect(migrateModeId('flocking')).toBeNull();
    expect(migrateModeId('explore')).toBeNull();
  });

  it('rejects garbage', () => {
    expect(migrateModeId('bogus')).toBeNull();
    expect(migrateModeId('')).toBeNull();
    expect(migrateModeId(42)).toBeNull();
    expect(migrateModeId({ id: 'swoop' })).toBeNull();
    expect(migrateModeId(['swoop'])).toBeNull();
    expect(migrateModeId(null)).toBeNull();
    expect(migrateModeId(undefined)).toBeNull();
  });
});

describe('applyModeDefaults', () => {
  const pattern = getMode('pattern');
  // Synthetic mode exercising both a boolean and a numeric default
  const testMode = { ...pattern, defaults: { displayWindArrow: true, limitWind: 500 } };

  it('applies mode defaults where the user is at the global default', () => {
    expect(DEFAULT_SETTINGS.displayWindArrow).toBe(false); // sanity: they differ
    const resolved = applyModeDefaults(DEFAULT_SETTINGS, testMode);

    expect(resolved.displayWindArrow).toBe(true);
    expect(resolved.limitWind).toBe(500);
  });

  it('preserves user-customized values', () => {
    const custom: Settings = {
      ...DEFAULT_SETTINGS,
      limitWind: 1234 // user-set, differs from global default and mode default
    };
    const resolved = applyModeDefaults(custom, testMode);

    expect(resolved.limitWind).toBe(1234);
    expect(resolved.displayWindArrow).toBe(true); // untouched setting still gets mode default
  });

  it('leaves settings without a mode default alone', () => {
    const custom: Settings = { ...DEFAULT_SETTINGS, showPoms: false };
    const resolved = applyModeDefaults(custom, testMode);

    expect(resolved.showPoms).toBe(false);
  });

  it('is a no-op for modes without defaults', () => {
    const swoop = getMode('swoop');
    const custom: Settings = { ...DEFAULT_SETTINGS, showPoms: false };

    expect(applyModeDefaults(custom, swoop)).toEqual(custom);
  });

  it('does not mutate the input', () => {
    const input: Settings = { ...DEFAULT_SETTINGS };

    applyModeDefaults(input, pattern);
    expect(input).toEqual(DEFAULT_SETTINGS);
  });
});
