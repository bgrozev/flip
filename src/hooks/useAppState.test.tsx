// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, SCHEMA_VERSION } from '../core/model';

import { AppStateProvider, useAppState } from './useAppState';

const wrapper = ({ children }: { children: ReactNode }) => (
  <AppStateProvider>{children}</AppStateProvider>
);

function renderAppState() {
  return renderHook(() => useAppState(), { wrapper });
}

/** Store a versioned document the way the app's codecs do. */
function store(key: string, doc: unknown) {
  window.localStorage.setItem(key, JSON.stringify({ schemaVersion: SCHEMA_VERSION, doc }));
}

describe('useAppState settings touch tracking', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts with nothing touched for a fresh user', () => {
    const { result } = renderAppState();

    expect(result.current.touchedSettings).toEqual([]);
  });

  it('seeds the touched list for pre-tracking users from non-default values', () => {
    // A legacy user: stored settings differ from the defaults, but no
    // touched list was ever written
    store('flip.settings', { ...DEFAULT_SETTINGS, showPoms: false });

    const { result } = renderAppState();

    expect(result.current.touchedSettings).toEqual(['showPoms']);
  });

  it('marks changed keys touched on setSettings', () => {
    const { result } = renderAppState();

    act(() => result.current.setSettings({
      ...result.current.settings,
      showPoms: false
    }));

    expect(result.current.touchedSettings).toEqual(['showPoms']);
    expect(result.current.settings.showPoms).toBe(false);
  });

  it('keeps a key touched when it is set back to the global default', () => {
    const { result } = renderAppState();

    act(() => result.current.setSettings({
      ...result.current.settings,
      showPoms: false
    }));
    act(() => result.current.setSettings({
      ...result.current.settings,
      showPoms: DEFAULT_SETTINGS.showPoms
    }));

    // The user's explicit choice of the default value must survive —
    // this is what lets them override a mode default back to it
    expect(result.current.touchedSettings).toEqual(['showPoms']);
    expect(result.current.settings.showPoms).toBe(DEFAULT_SETTINGS.showPoms);
  });

  it('persists the touched list across a remount', () => {
    const first = renderAppState();

    act(() => first.result.current.setSettings({
      ...first.result.current.settings,
      showPoms: false
    }));
    first.unmount();

    const second = renderAppState();

    expect(second.result.current.touchedSettings).toEqual(['showPoms']);
  });

  it('resetAll clears the touched list', () => {
    const { result } = renderAppState();

    act(() => result.current.setSettings({
      ...result.current.settings,
      showPoms: false
    }));
    act(() => result.current.resetAll());

    expect(result.current.touchedSettings).toEqual([]);
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('useAppState targets', () => {
  const ZHILLS = { target: { lat: 28.21887, lng: -82.15122 }, finalHeading: 270 };
  const DELAND = { target: { lat: 29.06402, lng: -81.27847 }, finalHeading: 125 };
  const POND = { target: { lat: 28.219, lng: -82.152 }, finalHeading: 300 };

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps a per-mode target separate from the other modes', () => {
    const { result } = renderAppState();

    act(() => result.current.setTargetForMode('swoop', POND));

    expect(result.current.targetForMode('swoop')).toEqual(POND);
    expect(result.current.targetForMode('flocking')).not.toEqual(POND);
  });

  it('setTargetEverywhere moves every mode, including untouched ones', () => {
    const { result } = renderAppState();

    act(() => result.current.setTargetForMode('swoop', POND));
    act(() => result.current.setTargetEverywhere(DELAND));

    expect(result.current.targetForMode('swoop')).toEqual(DELAND);
    expect(result.current.targetForMode('pattern')).toEqual(DELAND);
    expect(result.current.targetForMode('flocking')).toEqual(DELAND);
  });

  it('lets modes diverge again after a place is chosen', () => {
    const { result } = renderAppState();

    act(() => result.current.setTargetEverywhere(DELAND));
    act(() => result.current.setTargetForMode('swoop', POND));

    expect(result.current.targetForMode('swoop')).toEqual(POND);
    expect(result.current.targetForMode('pattern')).toEqual(DELAND);
  });

  it('persists a chosen place across a remount', () => {
    const first = renderAppState();

    act(() => first.result.current.setTargetEverywhere(ZHILLS));
    first.unmount();

    const second = renderAppState();

    expect(second.result.current.targetForMode('flocking')).toEqual(ZHILLS);
  });
});
