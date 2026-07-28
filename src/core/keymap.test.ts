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

  it('folds letters to lower case, so Shift+P is still P', () => {
    expect(eventToCombo({ key: 'p' })).toBe('p');
    expect(eventToCombo({ key: 'P', shiftKey: true })).toBe('p');
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
