import { describe, it, expect } from 'vitest';

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
