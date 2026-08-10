// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '../core/model';
import { ModeId } from '../modes';

import { migrateReturnModeId, useFlipFlop } from './useFlipFlop';

const KEY = 'flip.mode.beforeFlocking';

function store(doc: unknown) {
  window.localStorage.setItem(KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, doc }));
}

function read(): unknown {
  const raw = window.localStorage.getItem(KEY);

  return raw === null ? null : JSON.parse(raw).doc;
}

/** Renders the hook with a mode id the test controls, as App would. */
function renderFlipFlop(modeId: ModeId) {
  const setModeId = vi.fn();
  const result = renderHook(
    ({ id }: { id: ModeId }) => useFlipFlop(id, setModeId),
    { initialProps: { id: modeId } }
  );

  return { ...result, setModeId };
}

describe('useFlipFlop', () => {
  beforeEach(() => window.localStorage.clear());

  it('switches into flocking from a planning mode', () => {
    const { result, setModeId } = renderFlipFlop('pattern');

    expect(result.current.flocking).toBe(false);

    act(() => result.current.toggle());

    expect(setModeId).toHaveBeenCalledWith('flocking');
  });

  it('returns to the mode it came from, not to the fallback', () => {
    // The fallback is swoop, so a pattern jumper is the case that proves the
    // return mode is remembered rather than guessed.
    const { rerender, result, setModeId } = renderFlipFlop('pattern');

    rerender({ id: 'flocking' });
    expect(result.current.flocking).toBe(true);

    act(() => result.current.toggle());

    expect(setModeId).toHaveBeenCalledWith('pattern');
  });

  it('remembers the return mode across a reload', () => {
    const first = renderFlipFlop('pattern');

    first.rerender({ id: 'flocking' });
    first.unmount();

    // A fresh mount, still in flocking: only storage can say where to go back.
    const { result, setModeId } = renderFlipFlop('flocking');

    act(() => result.current.toggle());

    expect(setModeId).toHaveBeenCalledWith('pattern');
  });

  it('records a mode reached without the wordmark', () => {
    const { rerender } = renderFlipFlop('pattern');

    // The mode menu, a shortcut, a setup or ?mode= — all arrive this way.
    rerender({ id: 'swoop' });

    expect(read()).toBe('swoop');
  });

  it('never records flocking as the mode to return to', () => {
    const { rerender } = renderFlipFlop('pattern');

    expect(read()).toBe('pattern');

    rerender({ id: 'flocking' });

    expect(read()).toBe('pattern');
  });

  it('falls back when storage names flocking, so the switch is never a no-op', () => {
    store('flocking');

    const { result, setModeId } = renderFlipFlop('flocking');

    act(() => result.current.toggle());

    expect(setModeId).toHaveBeenCalledWith('swoop');
  });
});

describe('migrateReturnModeId', () => {
  it('keeps a valid planning mode', () => {
    expect(migrateReturnModeId('pattern')).toBe('pattern');
    expect(migrateReturnModeId('swoop')).toBe('swoop');
  });

  it('rejects flocking, junk and the missing key alike', () => {
    expect(migrateReturnModeId('flocking')).toBe('swoop');
    expect(migrateReturnModeId('nonsense')).toBe('swoop');
    expect(migrateReturnModeId(undefined)).toBe('swoop');
    expect(migrateReturnModeId(42)).toBe('swoop');
  });
});
