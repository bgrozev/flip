import { describe, it, expect } from 'vitest';

import { MODES } from '../modes';

import { DROPZONES, findClosestDropzone } from './dropzones';

describe('DROPZONES', () => {
  it('has no duplicate names', () => {
    const names = DROPZONES.map(dz => dz.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it('has no two entries at the same spot', () => {
    // Guards the bulk import: the same DZ under two spellings would show up
    // as two list rows a few metres apart.
    const keys = DROPZONES.map(dz => `${dz.lat.toFixed(2)},${dz.lng.toFixed(2)}`);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has plausible coordinates and headings', () => {
    DROPZONES.forEach(dz => {
      expect(dz.name.trim()).toBe(dz.name);
      expect(dz.lat).toBeGreaterThanOrEqual(-90);
      expect(dz.lat).toBeLessThanOrEqual(90);
      expect(dz.lng).toBeGreaterThanOrEqual(-180);
      expect(dz.lng).toBeLessThanOrEqual(180);
      // 0,0 is the FWC "CUSTOM" sentinel, not a dropzone
      expect(Math.abs(dz.lat) + Math.abs(dz.lng)).toBeGreaterThan(0);

      if (dz.direction !== undefined) {
        expect(dz.direction).toBeGreaterThanOrEqual(0);
        expect(dz.direction).toBeLessThan(360);
      }
    });
  });

  // `Dropzone.modes` is keyed by a plain string (types cannot import modes
  // without a cycle), so the keys are only as good as this check.
  it('keys per-mode config by a real mode id', () => {
    const modeIds = new Set(MODES.map(mode => mode.id));

    DROPZONES.forEach(dz => {
      Object.keys(dz.modes ?? {}).forEach(modeId => {
        expect(modeIds, `${dz.name} declares mode "${modeId}"`).toContain(modeId);
      });
    });
  });

  it('gives per-mode entries usable coordinates and headings', () => {
    DROPZONES.forEach(dz => {
      Object.values(dz.modes ?? {}).forEach(config => {
        // A position is both halves or neither — a lone lat is a typo
        expect(typeof config.lat).toBe(typeof config.lng);

        if (typeof config.lat === 'number' && typeof config.lng === 'number') {
          expect(Math.abs(config.lat)).toBeLessThanOrEqual(90);
          expect(Math.abs(config.lng)).toBeLessThanOrEqual(180);
        }
        if (config.direction !== undefined) {
          expect(config.direction).toBeGreaterThanOrEqual(0);
          expect(config.direction).toBeLessThan(360);
        }
      });
    });
  });

  it('has plausible websites', () => {
    DROPZONES.forEach(dz => {
      if (dz.website !== undefined) {
        expect(dz.website, dz.name).toMatch(/^https:\/\/[^\s]+$/);
      }
    });
  });

  it('says what country every dropzone is in', () => {
    // Country is the one location field filled in for every entry; town and
    // region are best-effort, so they are only checked for shape.
    DROPZONES.forEach(dz => {
      expect(dz.country, dz.name).toBeTruthy();
    });
  });

  it('has trimmed, non-empty location fields where set', () => {
    DROPZONES.forEach(dz => {
      [dz.town, dz.region, dz.country].forEach(value => {
        if (value !== undefined) {
          expect(value.trim(), dz.name).toBe(value);
          expect(value, dz.name).not.toBe('');
        }
      });
    });
  });

  it('is sorted for display', () => {
    const sorted = [...DROPZONES].sort((a, b) => a.name.localeCompare(b.name));

    expect(DROPZONES.map(dz => dz.name)).toEqual(sorted.map(dz => dz.name));
  });
});

describe('findClosestDropzone', () => {
  it('finds the dropzone nearest a point', () => {
    // A few miles north of ZHills
    expect(findClosestDropzone([-82.15, 28.28]).name).toBe('Skydive City (ZHills)');
  });

  it('picks the nearer of two dropzones in the same region', () => {
    // Between Spaceland Houston and San Marcos, closer to San Marcos
    expect(findClosestDropzone([-97.7, 29.8]).name).toBe(
      'Skydive Spaceland San Marcos'
    );
  });
});
