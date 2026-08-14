/**
 * Binds the keymap to the window.
 *
 * The table and all matching logic live in `core/keymap`; this is the DOM
 * edge — the listener, the guard, and the dispatch.
 *
 * The guard is the whole ballgame for single-key shortcuts. Without it,
 * typing `300` into an altitude field switches modes three times and naming
 * a preset "Wind practice" fires half the map. Keys are ignored whenever the
 * event came from somewhere the user is typing, or from inside a menu or
 * dialog that owns its own keys.
 */
import { useEffect, useRef } from 'react';

import { Shortcut, eventToCombo, matchShortcut } from '../core/keymap';

/** Is the user typing into this element? */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();

  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    // Coerced: `isContentEditable` is undefined, not false, on plain
    // elements in jsdom.
    Boolean(target.isContentEditable)
  );
}

/**
 * Is the event inside a menu or dialog? Those manage their own keys — the
 * preset menu's 1-9, a dialog's Enter/Escape — and the global map must keep
 * out of the way while one is open.
 */
export function isInsideOverlay(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return target.closest('[role="menu"], [role="dialog"], [role="listbox"]') !== null;
}

export type ShortcutHandlers = Record<string, (combo: string) => void>;

/**
 * @param shortcuts what is bound right now (already mode-filtered)
 * @param handlers  action id -> what to do; ids with no handler are ignored
 * @param enabled   false while a full-screen overlay owns the keyboard
 */
export function useKeyboardShortcuts(
  shortcuts: readonly Shortcut[],
  handlers: ShortcutHandlers,
  enabled = true
): void {
  // Keep both in refs so the listener is attached once and never re-attached
  // as the mode, the handlers or their closures change.
  const shortcutsRef = useRef(shortcuts);
  const handlersRef = useRef(handlers);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
    handlersRef.current = handlers;
    enabledRef.current = enabled;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !enabledRef.current ||
        event.defaultPrevented ||
        event.repeat ||
        isTypingTarget(event.target) ||
        isInsideOverlay(event.target)
      ) {
        return;
      }

      const match = matchShortcut(eventToCombo(event), shortcutsRef.current);

      if (!match) {
        return;
      }

      const handler = handlersRef.current[match.shortcut.id];

      if (!handler) {
        return;
      }

      // Only now: an unhandled key must keep its browser behaviour (arrows
      // scroll, '/' opens quick-find), and swallowing it would be worse than
      // not having the shortcut.
      event.preventDefault();
      handler(match.combo);
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
