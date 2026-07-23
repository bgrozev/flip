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

  it('ships pattern, swoop and flocking, all enabled', () => {
    expect(ENABLED_MODES.map(m => m.id)).toEqual(['pattern', 'swoop', 'flocking']);
    expect(MODES.every(m => m.enabled)).toBe(true);
  });

  it('flocking mode exposes its panel and layer, no pattern/manoeuvre', () => {
    const flocking = getMode('flocking');

    expect(flocking.nav).toContain('flocking');
    expect(flocking.nav).not.toContain('pattern');
    expect(flocking.nav).not.toContain('manoeuvre');
    expect(hasLayer(flocking, 'flocking')).toBe(true);
    expect(hasLayer(flocking, 'flightPaths')).toBe(false);
    expect(hasFeature(flocking, 'manoeuvre')).toBe(false);
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

    // swoop is "everything" except the flocking-specific panel/layer
    expect([...swoop.nav].sort()).toEqual(PANEL_IDS.filter(p => p !== 'flocking').sort());
    expect([...swoop.mapLayers].sort()).toEqual(MAP_LAYER_IDS.filter(l => l !== 'flocking').sort());
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
    expect(migrateModeId('flocking')).toBe('flocking');
  });

  it('rejects retired mode ids', () => {
    // 'explore' was a stub that shipped disabled and has since been removed
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
  // Synthetic mode exercising both a boolean and a string default
  const testMode = {
    ...pattern,
    defaults: { displayMapWinds: false, windModel: 'gfs_seamless' }
  };

  it('applies mode defaults to untouched settings', () => {
    expect(DEFAULT_SETTINGS.displayMapWinds).toBe(true); // sanity: they differ
    const resolved = applyModeDefaults(DEFAULT_SETTINGS, testMode, []);

    expect(resolved.displayMapWinds).toBe(false);
    expect(resolved.windModel).toBe('gfs_seamless');
  });

  it('preserves touched values', () => {
    const custom: Settings = {
      ...DEFAULT_SETTINGS,
      windModel: 'icon_seamless' // user-set, differs from global and mode default
    };
    const resolved = applyModeDefaults(custom, testMode, ['windModel']);

    expect(resolved.windModel).toBe('icon_seamless');
    expect(resolved.displayMapWinds).toBe(false); // untouched setting still gets mode default
  });

  it('lets a touched setting hold the global default against a mode default', () => {
    // The trap the old equals-global-default heuristic could not handle:
    // the user explicitly turns the map winds on (the global default) in a
    // mode whose default is off — their choice must win.
    const resolved = applyModeDefaults(DEFAULT_SETTINGS, testMode, ['displayMapWinds']);

    expect(resolved.displayMapWinds).toBe(true);
    expect(resolved.windModel).toBe('gfs_seamless'); // untouched key still overridden
  });

  it('leaves settings without a mode default alone', () => {
    const custom: Settings = { ...DEFAULT_SETTINGS, showPoms: false };
    const resolved = applyModeDefaults(custom, testMode, []);

    expect(resolved.showPoms).toBe(false);
  });

  it('is a no-op for modes without defaults', () => {
    const swoop = getMode('swoop');
    const custom: Settings = { ...DEFAULT_SETTINGS, showPoms: false };

    expect(applyModeDefaults(custom, swoop, [])).toEqual(custom);
  });

  it('does not mutate the input', () => {
    const input: Settings = { ...DEFAULT_SETTINGS };

    applyModeDefaults(input, pattern, []);
    expect(input).toEqual(DEFAULT_SETTINGS);
  });
});
