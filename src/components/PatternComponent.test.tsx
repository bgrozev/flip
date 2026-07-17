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
});
