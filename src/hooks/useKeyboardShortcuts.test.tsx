// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SHORTCUTS, visibleShortcuts } from '../core/keymap';

import { useKeyboardShortcuts, isInsideOverlay, isTypingTarget } from './useKeyboardShortcuts';

const ALL = visibleShortcuts({
  navPanels: ['pattern', 'manoeuvre', 'target', 'wind', 'courses', 'settings'],
  features: ['presets', 'export'],
  headingRelevant: true
}, SHORTCUTS);

function Harness({
  handlers, enabled = true, children
}: {
  handlers: Record<string, (combo: string) => void>;
  enabled?: boolean;
  children?: React.ReactNode;
}) {
  useKeyboardShortcuts(ALL, handlers, enabled);

  return <div>{children}</div>;
}

describe('useKeyboardShortcuts', () => {
  it('dispatches the action for a bound key', () => {
    const refresh = vi.fn();

    render(<Harness handlers={{ 'winds.refresh': refresh }} />);
    fireEvent.keyDown(window, { key: 'r' });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('passes the combo so one action can serve several keys', () => {
    const nudge = vi.fn();

    render(<Harness handlers={{ 'target.nudge': nudge }} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowUp' });

    expect(nudge).toHaveBeenNthCalledWith(1, 'arrowleft');
    expect(nudge).toHaveBeenNthCalledWith(2, 'arrowup');
  });

  it('ignores keys typed into a field', () => {
    const mode = vi.fn();
    const refresh = vi.fn();
    const { getByRole } = render(
      <Harness handlers={{ 'app.mode.pattern': mode, 'winds.refresh': refresh }}>
        <input aria-label="altitude" />
      </Harness>
    );
    const input = getByRole('textbox');

    input.focus();
    // Typing "1r" into an altitude field must not switch mode or refetch
    fireEvent.keyDown(input, { key: '1' });
    fireEvent.keyDown(input, { key: 'r' });

    expect(mode).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ignores keys inside a menu or dialog, which own their own keys', () => {
    const mode = vi.fn();
    const { getByRole } = render(
      <Harness handlers={{ 'app.mode.pattern': mode }}>
        <div role="menu"><button type="button">A preset</button></div>
      </Harness>
    );

    fireEvent.keyDown(getByRole('button'), { key: '1' });

    expect(mode).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', () => {
    const refresh = vi.fn();

    render(<Harness handlers={{ 'winds.refresh': refresh }} enabled={false} />);
    fireEvent.keyDown(window, { key: 'r' });

    expect(refresh).not.toHaveBeenCalled();
  });

  it('leaves browser and OS combos alone', () => {
    const refresh = vi.fn();

    render(<Harness handlers={{ 'winds.refresh': refresh }} />);
    fireEvent.keyDown(window, { key: 'r', metaKey: true });
    fireEvent.keyDown(window, { key: 'r', ctrlKey: true });

    expect(refresh).not.toHaveBeenCalled();
  });

  it('ignores auto-repeat, so a held key fires once', () => {
    const refresh = vi.fn();

    render(<Harness handlers={{ 'winds.refresh': refresh }} />);
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.keyDown(window, { key: 'r', repeat: true });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('only swallows the key when something handled it', () => {
    const handled = new Set<string>();
    const onWindowKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        handled.add(event.key);
      }
    };

    // Registered AFTER the hook's listener so it observes preventDefault:
    // listeners on the same target fire in registration order.
    render(<Harness handlers={{ 'winds.refresh': vi.fn() }} />);
    window.addEventListener('keydown', onWindowKey);

    fireEvent.keyDown(window, { key: 'r' });   // bound and handled
    fireEvent.keyDown(window, { key: 'e' });   // bound, but no handler given
    fireEvent.keyDown(window, { key: 'q' });   // not bound at all

    expect(handled.has('r')).toBe(true);
    expect(handled.has('e')).toBe(false);
    expect(handled.has('q')).toBe(false);

    window.removeEventListener('keydown', onWindowKey);
  });

  it('stops listening when unmounted', () => {
    const refresh = vi.fn();
    const { unmount } = render(<Harness handlers={{ 'winds.refresh': refresh }} />);

    unmount();
    fireEvent.keyDown(window, { key: 'r' });

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('guards', () => {
  it('recognizes typing targets', () => {
    const input = document.createElement('input');
    const div = document.createElement('div');
    const editable = document.createElement('div');

    editable.contentEditable = 'true';
    // jsdom does not derive isContentEditable from the attribute
    Object.defineProperty(editable, 'isContentEditable', { value: true });

    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(div)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('recognizes menus and dialogs', () => {
    const menu = document.createElement('div');
    const item = document.createElement('button');

    menu.setAttribute('role', 'menu');
    menu.appendChild(item);

    expect(isInsideOverlay(item)).toBe(true);
    expect(isInsideOverlay(document.createElement('button'))).toBe(false);
    expect(isInsideOverlay(null)).toBe(false);
  });
});
