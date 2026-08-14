// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SCHEMA_VERSION } from '../core/model';
import { ModeId } from '../modes';

import { migrateZoomByMode, useModeZoom } from './useModeZoom';

const KEY = 'flip.map.zoomByMode';

function read(): Record<string, number> | null {
  const raw = window.localStorage.getItem(KEY);

  return raw === null ? null : JSON.parse(raw).doc;
}

function store(doc: unknown) {
  window.localStorage.setItem(KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, doc }));
}

/** Renders the hook with a mode the test can switch, as App does. */
function renderModeZoom(modeId: ModeId, defaultZoom?: number) {
  return renderHook(
    ({ id, fallback }: { id: ModeId; fallback?: number }) => useModeZoom(id, fallback),
    { initialProps: { id: modeId, fallback: defaultZoom } }
  );
}

describe('useModeZoom', () => {
  beforeEach(() => window.localStorage.clear());

  it("starts at the mode's own default", () => {
    const { result } = renderModeZoom('flocking', 13);

    expect(result.current.zoom).toBe(13);
  });

  it('has no opinion where the mode declares no default', () => {
    // Undefined, not a number of its own: the map's default then applies.
    expect(renderModeZoom('pattern').result.current.zoom).toBeUndefined();
  });

  // The whole point: a zoom set in flocking survives a trip through another
  // mode instead of being pulled back to the default.
  it('gives a mode back the zoom it was left on', () => {
    const { rerender, result } = renderModeZoom('flocking', 13);

    act(() => result.current.recordZoom(16));
    expect(result.current.zoom).toBe(16);

    rerender({ id: 'pattern', fallback: undefined });
    expect(result.current.zoom).toBeUndefined();

    rerender({ id: 'flocking', fallback: 13 });
    expect(result.current.zoom).toBe(16);
  });

  it('keeps each mode independent', () => {
    const { rerender, result } = renderModeZoom('flocking', 13);

    act(() => result.current.recordZoom(16));
    rerender({ id: 'swoop', fallback: undefined });
    act(() => result.current.recordZoom(19));

    expect(read()).toEqual({ flocking: 16, swoop: 19 });
  });

  it('survives a reload', () => {
    const first = renderModeZoom('flocking', 13);

    act(() => first.result.current.recordZoom(16));
    first.unmount();

    expect(renderModeZoom('flocking', 13).result.current.zoom).toBe(16);
  });

  // The map reports its zoom on load too, so this runs on every mode switch.
  it('does not rewrite a value it already holds', () => {
    const { result } = renderModeZoom('flocking', 13);

    act(() => result.current.recordZoom(16));

    const writes = vi.spyOn(Storage.prototype, 'setItem');

    act(() => result.current.recordZoom(16));

    expect(writes).not.toHaveBeenCalled();
    writes.mockRestore();
  });

  it('reads a stored zoom written before this session', () => {
    store({ flocking: 15 });

    expect(renderModeZoom('flocking', 13).result.current.zoom).toBe(15);
  });
});

describe('migrateZoomByMode', () => {
  it('keeps plausible zooms', () => {
    expect(migrateZoomByMode({ flocking: 16, swoop: 19.5 })).toEqual({ flocking: 16, swoop: 19.5 });
  });

  it('drops entries that are not a usable zoom', () => {
    expect(migrateZoomByMode({
      flocking: 'wide', swoop: NaN, pattern: -3, other: 900, good: 12
    })).toEqual({ good: 12 });
  });

  it('never throws on junk', () => {
    expect(migrateZoomByMode(undefined)).toEqual({});
    expect(migrateZoomByMode(null)).toEqual({});
    expect(migrateZoomByMode([1, 2])).toEqual({});
    expect(migrateZoomByMode('nonsense')).toEqual({});
  });
});
