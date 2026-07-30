// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_MANOEUVRE_CONFIG,
  DEFAULT_PATTERN_PARAMS,
  DEFAULT_TARGET
} from '../core/model';
import { PatternParams, Target } from '../types';

import { usePresets } from './usePresets';

const OTHER_TARGET: Target = {
  target: { lat: 33.62, lng: -111.91 },
  finalHeading: 90
};

function makeSetters() {
  return {
    applyTarget: vi.fn(),
    setPatternParams: vi.fn(),
    setManoeuvreConfig: vi.fn(),
    setSelectedCourseId: vi.fn()
  };
}

function renderPresets(
  setters: ReturnType<typeof makeSetters>,
  overrides: Partial<{ target: Target; patternParams: PatternParams }> = {}
) {
  return renderHook(
    props => usePresets(props),
    {
      initialProps: {
        target: overrides.target ?? DEFAULT_TARGET,
        patternParams: overrides.patternParams ?? DEFAULT_PATTERN_PARAMS,
        manoeuvreConfig: DEFAULT_MANOEUVRE_CONFIG,
        selectedCourseId: null as string | null,
        activePlaceId: null as string | null,
        ...setters
      }
    }
  );
}

describe('usePresets', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts empty with no active preset', () => {
    const { result } = renderPresets(makeSetters());

    expect(result.current.presets).toEqual([]);
    expect(result.current.activePresetId).toBeNull();
  });

  it('create → load round-trips the config through localStorage', () => {
    const setters = makeSetters();
    const first = renderPresets(setters, { target: OTHER_TARGET });

    act(() => first.result.current.createPreset('Eloy'));

    expect(first.result.current.presets).toHaveLength(1);
    expect(first.result.current.presets[0].name).toBe('Eloy');
    expect(first.result.current.activePresetId).toBe(first.result.current.presets[0].id);
    first.unmount();

    // A fresh hook (new session) sees the persisted preset...
    const second = renderPresets(setters);
    const preset = second.result.current.presets[0];

    expect(preset.name).toBe('Eloy');
    expect(preset.target).toEqual(OTHER_TARGET);

    // ...and loading it pushes the snapshot into the app setters
    act(() => second.result.current.loadPreset(preset.id));

    expect(setters.applyTarget).toHaveBeenCalledWith(OTHER_TARGET, null);
    expect(setters.setPatternParams).toHaveBeenCalledWith(DEFAULT_PATTERN_PARAMS);
    expect(setters.setManoeuvreConfig).toHaveBeenCalledWith(DEFAULT_MANOEUVRE_CONFIG);
    expect(setters.setSelectedCourseId).toHaveBeenCalledWith(null);
  });

  // Courses belong to a dropzone, so a preset that names a course has to name
  // the place too — otherwise loading it selects one the panel no longer lists.
  it('round-trips the place a preset was saved at', () => {
    const setters = makeSetters();
    const { result, rerender } = renderPresets(setters);

    rerender({
      target: OTHER_TARGET,
      patternParams: DEFAULT_PATTERN_PARAMS,
      manoeuvreConfig: DEFAULT_MANOEUVRE_CONFIG,
      selectedCourseId: 'skydive-arizona-distance',
      activePlaceId: 'dz:Skydive Arizona',
      ...setters
    });
    act(() => result.current.createPreset('Eloy distance'));

    expect(result.current.presets[0].placeId).toBe('dz:Skydive Arizona');

    act(() => result.current.loadPreset(result.current.presets[0].id));

    expect(setters.applyTarget).toHaveBeenCalledWith(OTHER_TARGET, 'dz:Skydive Arizona');
    expect(setters.setSelectedCourseId).toHaveBeenCalledWith('skydive-arizona-distance');
  });

  it('updatePreset overwrites the snapshot with the current config', () => {
    const setters = makeSetters();
    const { result, rerender } = renderPresets(setters);

    act(() => result.current.createPreset('WIP'));
    const id = result.current.presets[0].id;

    // Config changes, then the user saves over the preset
    rerender({
      target: OTHER_TARGET,
      patternParams: DEFAULT_PATTERN_PARAMS,
      manoeuvreConfig: DEFAULT_MANOEUVRE_CONFIG,
      selectedCourseId: null,
      activePlaceId: null,
      ...setters
    });
    act(() => result.current.updatePreset(id));

    expect(result.current.presets[0].target).toEqual(OTHER_TARGET);
  });

  it('renamePreset changes only the name', () => {
    const { result } = renderPresets(makeSetters());

    act(() => result.current.createPreset('Old name'));
    const before = result.current.presets[0];

    act(() => result.current.renamePreset(before.id, 'New name'));

    expect(result.current.presets[0]).toEqual({ ...before, name: 'New name' });
  });

  it('deletePreset removes it and clears the active id', () => {
    const { result } = renderPresets(makeSetters());

    act(() => result.current.createPreset('Doomed'));
    const id = result.current.presets[0].id;

    expect(result.current.activePresetId).toBe(id);

    act(() => result.current.deletePreset(id));

    expect(result.current.presets).toEqual([]);
    expect(result.current.activePresetId).toBeNull();
  });

  it('loadPreset(null) deselects without touching the config', () => {
    const setters = makeSetters();
    const { result } = renderPresets(setters);

    act(() => result.current.createPreset('Something'));
    act(() => result.current.loadPreset(null));

    expect(result.current.activePresetId).toBeNull();
    expect(setters.applyTarget).not.toHaveBeenCalled();
  });
});
