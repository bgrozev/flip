// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppStateProvider } from '../hooks/useAppState';
import { ManoeuvreConfig } from '../types';
import { samples } from '../samples';

import ManoeuvreAltitudeControl from './ManoeuvreAltitudeControl';

/** The recorded initiation altitude of the first sample, in feet. */
const RECORDED = (() => {
  const path = samples[0].getPath();

  return path[path.length - 1].properties.alt;
})();

function renderControl(config: ManoeuvreConfig) {
  const onChange = vi.fn();
  const view = render(
    <AppStateProvider>
      <ManoeuvreAltitudeControl config={config} onChange={onChange} />
    </AppStateProvider>
  );

  return {
    onChange,
    rerenderWith: (next: ManoeuvreConfig) =>
      view.rerender(
        <AppStateProvider>
          <ManoeuvreAltitudeControl config={next} onChange={onChange} />
        </AppStateProvider>
      )
  };
}

const sample = (offset?: number): ManoeuvreConfig => ({
  type: 'samples',
  sampleIndex: 0,
  sampleLeft: true,
  ...offset === undefined ? {} : { initiationAltitudeOffset: offset }
});

const field = () => screen.queryByLabelText('Initiation altitude') as HTMLInputElement | null;

describe('ManoeuvreAltitudeControl', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  // A parametric turn states its own altitude; this control is for the
  // recorded shapes, and there is nothing to scale until one is loaded.
  it('shows nothing without a recorded path', () => {
    renderControl({ type: 'parameters' });

    expect(field()).toBeNull();
  });

  it('opens at the recorded altitude', () => {
    renderControl(sample());

    expect(Number(field()!.value)).toBe(Math.round(RECORDED));
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  // The offset is stored on the config, so anything that writes the config —
  // a setup load, a preset, Reset itself — has to move the field.
  it('follows an offset applied from outside', () => {
    const { rerenderWith } = renderControl(sample());

    rerenderWith(sample(150));

    expect(Number(field()!.value)).toBe(Math.round(RECORDED) + 150);
    expect(screen.getByText('+150 ft')).toBeTruthy();
  });

  it('says which way it was moved, and offers to put it back', () => {
    const { onChange, rerenderWith } = renderControl(sample(-100));

    expect(screen.getByText('-100 ft')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onChange).toHaveBeenCalledWith(0);

    // Reset reports 0 and the field follows the config back down.
    rerenderWith(sample(0));
    expect(Number(field()!.value)).toBe(Math.round(RECORDED));
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('reports an edit as an offset from the recorded altitude', () => {
    const { onChange } = renderControl(sample());

    fireEvent.change(field()!, { target: { value: String(Math.round(RECORDED) + 50) } });

    expect(onChange).toHaveBeenCalledWith(50);
  });

  // The track can only be scaled so far before the shape stops meaning
  // anything: the field's own bounds are ±15% of what was flown.
  it('bounds the field to what the recorded turn can be scaled to', () => {
    renderControl(sample());

    const min = Number(field()!.getAttribute('min'));
    const max = Number(field()!.getAttribute('max'));

    expect(min).toBeCloseTo(RECORDED * 0.85, -1);
    expect(max).toBeCloseTo(RECORDED * 1.15, -1);
  });
});
