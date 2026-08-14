import { describe, expect, it } from 'vitest';

import { PANEL_IDS } from '../types';

import {
  MAP_PATH,
  isMapPathname,
  isPathnameAllowed,
  panelFromPathname,
  panelPath
} from './routing';

describe('panelPath / panelFromPathname', () => {
  it('round-trips every panel id', () => {
    for (const id of PANEL_IDS) {
      expect(panelFromPathname(panelPath(id))).toBe(id);
    }
  });

  it('returns null for the map and unknown paths', () => {
    expect(panelFromPathname('/')).toBeNull();
    expect(panelFromPathname('/map')).toBeNull();
    expect(panelFromPathname('/bogus')).toBeNull();
    expect(panelFromPathname('/wind/extra')).toBeNull();
    expect(panelFromPathname('')).toBeNull();
  });

  it('tolerates trailing slashes', () => {
    expect(panelFromPathname('/wind/')).toBe('wind');
    expect(isMapPathname('///')).toBe(true);
  });
});

describe('isMapPathname', () => {
  it('accepts root and the legacy /map alias', () => {
    expect(isMapPathname(MAP_PATH)).toBe(true);
    expect(isMapPathname('/map')).toBe(true);
    expect(isMapPathname('/wind')).toBe(false);
  });
});

describe('isPathnameAllowed (route guard)', () => {
  const allowed = ['pattern', 'target', 'wind', 'settings', 'about'] as const;

  it('always allows the map', () => {
    expect(isPathnameAllowed('/', allowed)).toBe(true);
    expect(isPathnameAllowed('/map', allowed)).toBe(true);
    expect(isPathnameAllowed('/', [])).toBe(true);
  });

  it('allows panels in the list', () => {
    expect(isPathnameAllowed('/pattern', allowed)).toBe(true);
    expect(isPathnameAllowed('/wind', allowed)).toBe(true);
  });

  it('rejects panels not in the list', () => {
    expect(isPathnameAllowed('/courses', allowed)).toBe(false);
    expect(isPathnameAllowed('/manoeuvre', allowed)).toBe(false);
  });

  it('rejects unknown paths', () => {
    expect(isPathnameAllowed('/bogus', allowed)).toBe(false);
    expect(isPathnameAllowed('/wind/rows', allowed)).toBe(false);
  });
});
