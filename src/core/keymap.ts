/**
 * The keyboard map: one table that both the key handler and the shortcuts
 * overlay read, so the documentation cannot drift from the bindings.
 *
 * Pure — no DOM, no React. The handler lives in
 * `hooks/useKeyboardShortcuts`, the list in `components/ShortcutsOverlay`.
 *
 * Some entries are mouse gestures with no keys (shift-click to move the
 * target). They are here because the overlay is where someone looks to find
 * out what they can do, and "how do I move the target" is that question.
 */
import { PanelId } from '../types';

export type ShortcutCategory =
  'app' | 'panels' | 'pattern' | 'manoeuvre' | 'winds' | 'target' | 'gestures';

export const SHORTCUT_CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  app: 'App',
  panels: 'Panels',
  pattern: 'Pattern',
  manoeuvre: 'Manoeuvre',
  winds: 'Winds',
  target: 'Target',
  gestures: 'On the map'
};

export interface Shortcut {
  /** Stable action id; the handler dispatches on this. */
  id: string;
  /**
   * Combos that trigger it, already normalized (see `eventToCombo`). Empty
   * for gesture-only entries, which are documented but never bound.
   */
  keys: readonly string[];
  /** Shown in the overlay. Sentence case, verb first. */
  label: string;
  category: ShortcutCategory;
  /** Only bound/listed when this panel is in the mode's nav. */
  panel?: PanelId;
  /**
   * Only bound/listed when the mode has this feature. Typed as a string
   * rather than `FeatureId` so that `core/` keeps importing nothing —
   * `modes/` is above it in the dependency order.
   */
  feature?: string;
  /** Only where the final heading applies (i.e. not in flocking). */
  headingOnly?: boolean;
  /** Documented as a mouse gesture; `keys` describes it in words instead. */
  gestureText?: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  // App
  { id: 'app.help', keys: ['?'], label: 'Show this list', category: 'app' },
  { id: 'app.focusMap', keys: ['f'], label: 'Hide everything but the map', category: 'app' },
  { id: 'app.close', keys: ['escape'], label: 'Close panel, back to the map', category: 'app' },
  { id: 'app.mode.pattern', keys: ['1'], label: 'Standard pattern mode', category: 'app' },
  { id: 'app.mode.swoop', keys: ['2'], label: 'High performance landing mode', category: 'app' },
  { id: 'app.mode.flocking', keys: ['3'], label: 'Flocking mode', category: 'app' },
  { id: 'app.presets', keys: ['s'], label: 'Presets — then 1-9 to load one', category: 'app', feature: 'presets' },
  { id: 'app.export', keys: ['e'], label: 'Export', category: 'app', feature: 'export' },

  // Panels — pressing the key again closes the panel
  { id: 'panel.pattern', keys: ['p'], label: 'Pattern', category: 'panels', panel: 'pattern' },
  { id: 'panel.manoeuvre', keys: ['m'], label: 'Manoeuvre', category: 'panels', panel: 'manoeuvre' },
  { id: 'panel.target', keys: ['t'], label: 'Target', category: 'panels', panel: 'target' },
  { id: 'panel.wind', keys: ['w'], label: 'Wind', category: 'panels', panel: 'wind' },
  { id: 'panel.courses', keys: ['c'], label: 'Courses', category: 'panels', panel: 'courses' },
  { id: 'panel.flocking', keys: ['g'], label: 'Flocking', category: 'panels', panel: 'flocking' },
  { id: 'panel.settings', keys: [','], label: 'Settings', category: 'panels', panel: 'settings' },

  // Pattern
  {
    id: 'pattern.flipSides', keys: ['x'],
    label: 'Flip pattern left/right', category: 'pattern', panel: 'pattern'
  },

  // Manoeuvre
  {
    id: 'manoeuvre.mirror', keys: ['shift+x'],
    label: 'Mirror the turn left/right', category: 'manoeuvre', feature: 'manoeuvre'
  },

  // Winds
  { id: 'winds.refresh', keys: ['r'], label: 'Refresh the forecast', category: 'winds' },
  { id: 'winds.hourBack', keys: ['['], label: 'An hour earlier', category: 'winds' },
  { id: 'winds.hourForward', keys: [']'], label: 'An hour later', category: 'winds' },
  { id: 'winds.now', keys: ['\\'], label: 'Back to now', category: 'winds' },

  // Target
  {
    id: 'target.nudge',
    keys: ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'],
    label: 'Nudge the target',
    category: 'target'
  },
  {
    id: 'target.nudgeFar',
    keys: ['shift+arrowleft', 'shift+arrowright', 'shift+arrowup', 'shift+arrowdown'],
    label: 'Nudge it further',
    category: 'target'
  },
  {
    id: 'target.rotateLeft',
    keys: ['<'], label: 'Turn the final heading left', category: 'target', headingOnly: true
  },
  {
    id: 'target.rotateRight',
    keys: ['>'], label: 'Turn the final heading right', category: 'target', headingOnly: true
  },
  { id: 'target.upwind', keys: ['u'], label: 'Land into wind', category: 'target', headingOnly: true },

  // Gestures — documented, not bound
  {
    id: 'gesture.jumpTarget', keys: [], gestureText: 'Shift-click',
    label: 'Move the target there', category: 'gestures'
  },
  {
    id: 'gesture.dragTarget', keys: [], gestureText: 'Drag',
    label: 'Move the target', category: 'gestures'
  },
  {
    id: 'gesture.rotateTarget', keys: [], gestureText: 'Hover the target',
    label: 'Reveals the heading handle', category: 'gestures', headingOnly: true
  }
];

export interface ShortcutContext {
  /** Panels the current mode exposes. */
  navPanels: readonly PanelId[];
  /** Features the current mode has. */
  features: readonly string[];
  /** Whether the final heading applies in this mode. */
  headingRelevant: boolean;
}

/** The shortcuts that apply right now — what to bind, and what to list. */
export function visibleShortcuts(
  context: ShortcutContext,
  shortcuts: readonly Shortcut[] = SHORTCUTS
): Shortcut[] {
  return shortcuts.filter(shortcut => {
    if (shortcut.panel && !context.navPanels.includes(shortcut.panel)) {
      return false;
    }
    if (shortcut.feature && !context.features.includes(shortcut.feature)) {
      return false;
    }

    return !(shortcut.headingOnly && !context.headingRelevant);
  });
}

/** Group them for display, in the order the categories are declared. */
export function groupShortcuts(shortcuts: readonly Shortcut[]): [ShortcutCategory, Shortcut[]][] {
  const order: ShortcutCategory[] =
    ['panels', 'pattern', 'manoeuvre', 'winds', 'target', 'gestures', 'app'];

  return order
    .map((category): [ShortcutCategory, Shortcut[]] =>
      [category, shortcuts.filter(shortcut => shortcut.category === category)])
    .filter(([, entries]) => entries.length > 0);
}

/** The parts of a KeyboardEvent this needs — keeps the module DOM-free. */
export interface KeyLike {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/**
 * Normalize a key event to a combo string, or null if it should be ignored.
 *
 * Ctrl/Cmd/Alt combos always return null: those belong to the browser and
 * the OS, and stealing them is how a web app earns a bug report.
 *
 * Printable keys match on the CHARACTER, not the physical key, so `?` works
 * wherever the layout happens to put it, and shift is already baked in
 * (`<` is not `shift+,`). Named keys keep their modifiers
 * (`shift+arrowleft`).
 *
 * A SHIFTED letter is its own combo (`shift+x`), because the shifted and
 * unshifted forms of a letter are the same character to a keymap that folds
 * case — which is what made "X flips the pattern, Shift+X mirrors the turn"
 * impossible to express. The test is `shiftKey`, not the case of the
 * character, so caps lock still types plain letters and still triggers the
 * plain bindings. The cost is that a shifted letter no longer falls through
 * to its unshifted binding: Shift+P does not open the Pattern panel.
 */
export function eventToCombo(event: KeyLike): string | null {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }

  const { key } = event;

  if (key.length === 1) {
    const lower = key.toLowerCase();
    const isLetter = lower !== key.toUpperCase();

    return event.shiftKey && isLetter ? `shift+${lower}` : lower;
  }

  return `${event.shiftKey ? 'shift+' : ''}${key.toLowerCase()}`;
}

/** The action a combo triggers, if any. */
export function matchShortcut(
  combo: string | null,
  available: readonly Shortcut[]
): { shortcut: Shortcut; combo: string } | null {
  if (combo === null) {
    return null;
  }

  const shortcut = available.find(entry => entry.keys.includes(combo));

  return shortcut ? { shortcut, combo } : null;
}
