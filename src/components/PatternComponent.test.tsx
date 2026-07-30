// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStateProvider } from '../hooks/useAppState';
import { DEFAULT_PATTERN_PARAMS } from '../core/model';
import { LIMITS } from '../core/validation';

import PatternComponent from './PatternComponent';

function renderPattern(onParamsChange = vi.fn()) {
  render(
    <AppStateProvider>
      <PatternComponent params={DEFAULT_PATTERN_PARAMS} onParamsChange={onParamsChange} />
    </AppStateProvider>
  );

  return onParamsChange;
}

describe('PatternComponent', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the pattern controls for the default three-leg pattern', () => {
    renderPattern();

    expect(screen.getByRole('button', { name: 'None' })).toBeTruthy();
    expect(screen.getByLabelText('Descent Rate')).toBeTruthy();
    expect(screen.getByLabelText('Glide Ratio')).toBeTruthy();
    expect(screen.getByText('Final leg')).toBeTruthy();
    expect(screen.getByText('Base leg')).toBeTruthy();
    expect(screen.getByText('Downwind leg')).toBeTruthy();
  });

  it('propagates an in-range glide ratio while typing', () => {
    const onParamsChange = renderPattern();
    const glide = screen.getByLabelText('Glide Ratio');

    fireEvent.change(glide, { target: { value: '2.5' } });

    expect(onParamsChange).toHaveBeenCalledWith({ ...DEFAULT_PATTERN_PARAMS, glideRatio: 2.5 });
  });

  it('never propagates an out-of-range value raw; clamps it on blur', () => {
    const onParamsChange = renderPattern();
    const glide = screen.getByLabelText('Glide Ratio');

    fireEvent.change(glide, { target: { value: '99' } });

    // While typing: invalid, not propagated
    expect(onParamsChange).not.toHaveBeenCalled();

    fireEvent.blur(glide);

    // On blur: clamped into range and propagated
    expect(onParamsChange).toHaveBeenCalledWith({
      ...DEFAULT_PATTERN_PARAMS,
      glideRatio: LIMITS.glideRatio.max
    });
    expect((glide as HTMLInputElement).value).toBe(String(LIMITS.glideRatio.max));
  });

  it('hides the leg-count selector when the mode does not offer it', () => {
    render(
      <AppStateProvider>
        <PatternComponent
          params={DEFAULT_PATTERN_PARAMS}
          onParamsChange={vi.fn()}
          legCountSelectable={false}
        />
      </AppStateProvider>
    );

    expect(screen.queryByRole('button', { name: 'None' })).toBeNull();
    expect(screen.queryByLabelText('Single leg')).toBeNull();
    // ...but the three-leg controls are all still there
    expect(screen.getByText('Final leg')).toBeTruthy();
    expect(screen.getByText('Base leg')).toBeTruthy();
    expect(screen.getByText('Downwind leg')).toBeTruthy();
    expect(screen.getByLabelText('Descent Rate')).toBeTruthy();
  });

  it('hides the leg controls when the pattern type is none', () => {
    render(
      <AppStateProvider>
        <PatternComponent
          params={{ ...DEFAULT_PATTERN_PARAMS, type: 'none' }}
          onParamsChange={vi.fn()}
        />
      </AppStateProvider>
    );

    expect(screen.queryByLabelText('Descent Rate')).toBeNull();
    expect(screen.queryByText('Final leg')).toBeNull();
  });

  describe('per-leg vs. pattern-wide turn controls', () => {
    it('gives a swooper the per-leg switches, no pattern-wide one', () => {
      renderPattern(); // legCountSelectable defaults true (swoop-like)

      expect(screen.queryByText('Pattern turns')).toBeNull();
      expect(screen.getAllByRole('button', { name: 'Left' })).toHaveLength(2);
    });

    it('gives Standard Pattern (non-nerd) the pattern-wide switch only', () => {
      render(
        <AppStateProvider>
          <PatternComponent
            params={DEFAULT_PATTERN_PARAMS}
            onParamsChange={vi.fn()}
            legCountSelectable={false}
            nerd={false}
          />
        </AppStateProvider>
      );

      expect(screen.getByText('Pattern turns')).toBeTruthy();
      // Only the pattern-wide switch's own Left/Right pair, not one per leg.
      expect(screen.getAllByRole('button', { name: 'Left' })).toHaveLength(1);
    });

    it('restores the per-leg switches for Standard Pattern under nerd mode', () => {
      render(
        <AppStateProvider>
          <PatternComponent
            params={DEFAULT_PATTERN_PARAMS}
            onParamsChange={vi.fn()}
            legCountSelectable={false}
            nerd={true}
          />
        </AppStateProvider>
      );

      expect(screen.queryByText('Pattern turns')).toBeNull();
      expect(screen.getAllByRole('button', { name: 'Left' })).toHaveLength(2);
    });

    it('hides the pattern-wide switch when the pattern has no turns', () => {
      render(
        <AppStateProvider>
          <PatternComponent
            params={{ ...DEFAULT_PATTERN_PARAMS, type: 'one-leg' }}
            onParamsChange={vi.fn()}
            legCountSelectable={false}
          />
        </AppStateProvider>
      );

      expect(screen.queryByText('Pattern turns')).toBeNull();
    });
  });

  describe('the pattern-wide switch (Standard Pattern, non-nerd)', () => {
    function renderStandard(params: typeof DEFAULT_PATTERN_PARAMS, onParamsChange = vi.fn()) {
      render(
        <AppStateProvider>
          <PatternComponent
            params={params}
            onParamsChange={onParamsChange}
            legCountSelectable={false}
            nerd={false}
          />
        </AppStateProvider>
      );

      return onParamsChange;
    }

    it('flips two right turns to two left turns', () => {
      // DEFAULT_PATTERN_PARAMS is two right turns. DirectionSwitch's display
      // is inverted (a known, separate issue) so the *inactive* button here
      // reads "Right" — either button triggers the same flip regardless.
      const onParamsChange = renderStandard(DEFAULT_PATTERN_PARAMS);

      fireEvent.click(screen.getByRole('button', { name: 'Right' }));

      expect(onParamsChange).toHaveBeenCalledWith({
        ...DEFAULT_PATTERN_PARAMS,
        legs: [
          DEFAULT_PATTERN_PARAMS.legs[0],
          { ...DEFAULT_PATTERN_PARAMS.legs[1], direction: 90 },
          { ...DEFAULT_PATTERN_PARAMS.legs[2], direction: 90 }
        ]
      });
    });

    it('resolves a mixed (Z) pattern to left-hand', () => {
      const zParams = {
        ...DEFAULT_PATTERN_PARAMS,
        legs: [
          DEFAULT_PATTERN_PARAMS.legs[0],
          { ...DEFAULT_PATTERN_PARAMS.legs[1], direction: 90 },
          { ...DEFAULT_PATTERN_PARAMS.legs[2], direction: 270 }
        ]
      };
      const onParamsChange = renderStandard(zParams);

      fireEvent.click(screen.getByRole('button', { name: 'Right' }));

      expect(onParamsChange).toHaveBeenCalledWith({
        ...zParams,
        legs: [
          zParams.legs[0],
          { ...zParams.legs[1], direction: 90 },
          { ...zParams.legs[2], direction: 90 }
        ]
      });
    });
  });
});
