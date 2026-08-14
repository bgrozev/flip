import { describe, it, expect } from 'vitest';

// Importing modes/ from a core test is deliberate: the property worth
// guarding is "no key is bound twice in any mode the app actually ships",
// which needs both tables. The runtime module (core/keymap) still imports
// nothing.
import { MODES } from '../modes';

import {
  SHORTCUTS,
  eventToCombo,
  groupShortcuts,
  matchShortcut,
  visibleShortcuts
} from './keymap';

describe('SHORTCUTS table', () => {
  it('gives every entry an id and a label', () => {
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.id).not.toBe('');
      expect(shortcut.label.trim()).toBe(shortcut.label);
      expect(shortcut.label).not.toBe('');
    }
  });

  it('has unique ids', () => {
    const ids = SHORTCUTS.map(s => s.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stores keys already normalized, so events can match them directly', () => {
    for (const shortcut of SHORTCUTS) {
      for (const key of shortcut.keys) {
        expect(key).toBe(key.toLowerCase());
        expect(key).not.toContain(' ');
      }
    }
  });

  it('describes gesture entries in words and binds no keys to them', () => {
    const gestures = SHORTCUTS.filter(s => s.category === 'gestures');

    expect(gestures.length).toBeGreaterThan(0);
    for (const gesture of gestures) {
      expect(gesture.keys).toEqual([]);
      expect(gesture.gestureText).toBeTruthy();
    }
  });

  it('documents shift-click to move the target', () => {
    const jump = SHORTCUTS.find(s => s.id === 'gesture.jumpTarget');

    expect(jump?.gestureText).toMatch(/shift-click/i);
  });
});

describe('no mode binds the same key twice', () => {
  it.each(MODES.map(mode => [mode.id, mode] as const))('%s', (_id, mode) => {
    const visible = visibleShortcuts({
      navPanels: mode.nav,
      features: mode.features,
      headingRelevant: mode.id !== 'flocking'
    });

    const seen = new Map<string, string>();

    for (const shortcut of visible) {
      for (const key of shortcut.keys) {
        expect(
          seen.has(key),
          `"${key}" is bound to both ${seen.get(key)} and ${shortcut.id} in ${mode.id}`
        ).toBe(false);
        seen.set(key, shortcut.id);
      }
    }
  });
});

describe('visibleShortcuts', () => {
  const patternMode = {
    navPanels: ['pattern', 'target', 'wind', 'settings', 'about'] as const,
    features: ['presets', 'export'],
    headingRelevant: true
  };

  it('drops panels the mode does not have', () => {
    const ids = visibleShortcuts({ ...patternMode, navPanels: patternMode.navPanels }).map(s => s.id);

    expect(ids).toContain('panel.pattern');
    expect(ids).not.toContain('panel.manoeuvre');
    expect(ids).not.toContain('panel.courses');
    expect(ids).not.toContain('panel.flocking');
  });

  it('drops features the mode does not have', () => {
    const ids = visibleShortcuts({ ...patternMode, features: [] }).map(s => s.id);

    expect(ids).not.toContain('app.presets');
    expect(ids).not.toContain('app.export');
    // ...but the ungated ones stay
    expect(ids).toContain('winds.refresh');
  });

  it('drops heading shortcuts where the heading does not apply', () => {
    const ids = visibleShortcuts({ ...patternMode, headingRelevant: false }).map(s => s.id);

    expect(ids).not.toContain('target.upwind');
    expect(ids).not.toContain('target.rotateLeft');
    expect(ids).not.toContain('gesture.rotateTarget');
    // nudging still works — it has nothing to do with the heading
    expect(ids).toContain('target.nudge');
  });
});

describe('eventToCombo', () => {
  it('ignores anything the browser or OS owns', () => {
    expect(eventToCombo({ key: 'p', metaKey: true })).toBeNull();
    expect(eventToCombo({ key: 'r', ctrlKey: true })).toBeNull();
    expect(eventToCombo({ key: 'w', altKey: true })).toBeNull();
  });

  // This used to fold Shift+P onto P. It no longer does: a shifted letter is
  // its own combo, which is what "X flips the pattern, Shift+X mirrors the
  // turn" needs. The cost is that Shift+P no longer opens the Pattern panel.
  it('keeps a shifted letter distinct from the plain one', () => {
    expect(eventToCombo({ key: 'p' })).toBe('p');
    expect(eventToCombo({ key: 'P', shiftKey: true })).toBe('shift+p');
  });

  it('matches printable keys by character, not physical key', () => {
    // '?' and '<' arrive with shift held; the character already says so, and
    // where the layout puts them is not our business.
    expect(eventToCombo({ key: '?', shiftKey: true })).toBe('?');
    expect(eventToCombo({ key: '<', shiftKey: true })).toBe('<');
    expect(eventToCombo({ key: ',' })).toBe(',');
  });

  it('keeps shift on named keys', () => {
    expect(eventToCombo({ key: 'ArrowLeft' })).toBe('arrowleft');
    expect(eventToCombo({ key: 'ArrowLeft', shiftKey: true })).toBe('shift+arrowleft');
    expect(eventToCombo({ key: 'Escape' })).toBe('escape');
  });
});

describe('matchShortcut', () => {
  const available = visibleShortcuts({
    navPanels: ['pattern', 'target', 'wind', 'settings'],
    features: ['presets', 'export'],
    headingRelevant: true
  });

  it('finds the action for a combo', () => {
    expect(matchShortcut('r', available)?.shortcut.id).toBe('winds.refresh');
    expect(matchShortcut('?', available)?.shortcut.id).toBe('app.help');
    expect(matchShortcut('shift+arrowup', available)?.shortcut.id).toBe('target.nudgeFar');
  });

  it('returns null for an unbound key or a null combo', () => {
    expect(matchShortcut('q', available)).toBeNull();
    expect(matchShortcut(null, available)).toBeNull();
  });

  it('never matches a gesture', () => {
    expect(matchShortcut('', available)).toBeNull();
  });
});

describe('groupShortcuts', () => {
  it('groups in display order and drops empty groups', () => {
    const grouped = groupShortcuts(visibleShortcuts({
      navPanels: ['target'],
      features: [],
      headingRelevant: false
    }));
    const categories = grouped.map(([category]) => category);

    expect(categories).toEqual(['panels', 'winds', 'target', 'gestures', 'app']);
    expect(grouped.every(([, entries]) => entries.length > 0)).toBe(true);
  });
});

describe('shifted letters', () => {
  // "X flips the pattern, Shift+X mirrors the turn" is only expressible if a
  // shifted letter is its own combo; the map used to fold case, so both
  // produced "x".
  it('reads a shifted letter as its own combo', () => {
    expect(eventToCombo({ key: 'X', shiftKey: true })).toBe('shift+x');
    expect(eventToCombo({ key: 'x' })).toBe('x');
  });

  it('still folds caps lock to the plain binding', () => {
    // Caps lock types an upper-case character with no shift held: that is
    // the same key, not a different one.
    expect(eventToCombo({ key: 'X', shiftKey: false })).toBe('x');
  });

  it('leaves shifted punctuation matching on its character', () => {
    expect(eventToCombo({ key: '?', shiftKey: true })).toBe('?');
    expect(eventToCombo({ key: '<', shiftKey: true })).toBe('<');
  });

  it('binds the mirror to Shift+X, leaving X to the pattern flip', () => {
    const mirror = SHORTCUTS.find(s => s.id === 'manoeuvre.mirror');

    expect(mirror?.keys).toEqual(['shift+x']);
    expect(matchShortcut('shift+x', SHORTCUTS)?.shortcut.id).toBe('manoeuvre.mirror');
    expect(matchShortcut('x', SHORTCUTS)?.shortcut.id).toBe('pattern.flipSides');
    expect(matchShortcut('z', SHORTCUTS)).toBeNull();
  });

  it('offers the mirror only where there is a manoeuvre', () => {
    const withTurn = visibleShortcuts({
      navPanels: ['manoeuvre'], features: ['manoeuvre'], headingRelevant: true
    });
    const without = visibleShortcuts({
      navPanels: ['pattern'], features: [], headingRelevant: true
    });

    expect(withTurn.some(s => s.id === 'manoeuvre.mirror')).toBe(true);
    expect(without.some(s => s.id === 'manoeuvre.mirror')).toBe(false);
  });
});

// The final heading has no input field any more, so these ARE the interface.
describe('the heading bindings', () => {
  const keysFor = (id: string) => SHORTCUTS.find(shortcut => shortcut.id === id)?.keys;

  it('has a coarse and a fine step, in both directions', () => {
    expect(keysFor('target.rotateLeft')).toEqual(['<']);
    expect(keysFor('target.rotateRight')).toEqual(['>']);
    expect(keysFor('target.rotateLeftFine')).toEqual([',']);
    expect(keysFor('target.rotateRightFine')).toEqual(['.']);
  });

  it('still lands into wind on one key', () => {
    expect(keysFor('target.upwind')).toEqual(['u']);
  });

  // `,` used to open Settings; the fine step took it, so Settings moved.
  it('leaves Settings somewhere that is not the fine step', () => {
    const settings = keysFor('panel.settings');

    expect(settings).toEqual(['shift+s']);
    expect(settings).not.toContain(',');
  });

  it('binds every heading key exactly once across the whole map', () => {
    const combos = SHORTCUTS.flatMap(shortcut => shortcut.keys);

    for (const key of [',', '.', '<', '>', 'u', 'shift+s']) {
      expect(combos.filter(combo => combo === key)).toHaveLength(1);
    }
  });

  // They belong to the target's heading, which flocking does not have.
  it('hides them where the final heading does not apply', () => {
    const visible = visibleShortcuts({
      navPanels: ['flocking', 'target'], features: [], headingRelevant: false
    });

    expect(visible.some(shortcut => shortcut.id.startsWith('target.rotate'))).toBe(false);
    expect(visible.some(shortcut => shortcut.id === 'target.upwind')).toBe(false);
  });
});
